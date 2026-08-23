import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RuntimeDependencyProbeService } from './runtime-dependency-probe.service';
import { RuntimeLifecycleService } from './runtime-lifecycle.service';
import { RuntimeProcessService } from './runtime-process.service';
import {
  areEssentialDependenciesUp,
  RuntimeReadinessSnapshot,
} from './runtime.types';

@Injectable()
export class RuntimeReadinessService implements OnModuleDestroy {
  private snapshot: RuntimeReadinessSnapshot;
  private consecutiveFailures = 0;
  private probeInFlight = false;
  private replacementRequested = false;
  private monitor?: NodeJS.Timeout;
  private readonly probeIntervalMs: number;
  private readonly failureThreshold: number;

  constructor(
    private readonly dependencyProbe: RuntimeDependencyProbeService,
    private readonly lifecycle: RuntimeLifecycleService,
    private readonly runtimeProcess: RuntimeProcessService,
    private readonly configService: ConfigService,
  ) {
    this.probeIntervalMs =
      this.configService.get<number>('readinessProbeIntervalMs') ?? 2_000;
    this.failureThreshold =
      this.configService.get<number>('readinessFailureThreshold') ?? 3;
    this.snapshot = this.createSnapshot(
      {
        primaryDatabase: 'down',
        hubDatabase: 'down',
        mediaStorage: 'down',
      },
      [],
    );
  }

  async initialize(): Promise<boolean> {
    const ready = await this.refresh(false);
    if (ready) this.startMonitoring();
    return ready;
  }

  getSnapshot(): RuntimeReadinessSnapshot {
    return {
      ...this.snapshot,
      checks: { ...this.snapshot.checks },
      degradedCapabilities: [...this.snapshot.degradedCapabilities],
    };
  }

  onModuleDestroy(): void {
    if (this.monitor) clearInterval(this.monitor);
  }

  async refresh(allowReplacement = true): Promise<boolean> {
    if (this.probeInFlight || this.lifecycle.getState() === 'draining') {
      return this.snapshot.status !== 'unavailable';
    }

    this.probeInFlight = true;
    try {
      const checks = await this.dependencyProbe.probeEssential();
      const degraded = this.dependencyProbe.getDegradedCapabilities();
      const ready = areEssentialDependenciesUp(checks);
      this.snapshot = this.createSnapshot(checks, degraded);

      if (ready) {
        this.consecutiveFailures = 0;
        this.lifecycle.markReady();
      } else {
        this.consecutiveFailures += 1;
        this.lifecycle.markNotReady();
        if (
          allowReplacement &&
          this.consecutiveFailures >= this.failureThreshold
        ) {
          this.requestReplacementAfterDrain();
        }
      }

      return ready;
    } finally {
      this.probeInFlight = false;
    }
  }

  private startMonitoring(): void {
    if (this.monitor) return;
    this.monitor = setInterval(() => {
      void this.refresh();
    }, this.probeIntervalMs);
    this.monitor.unref();
  }

  private requestReplacementAfterDrain(): void {
    if (this.replacementRequested) return;
    this.replacementRequested = true;
    this.lifecycle.beginDrain();

    void this.lifecycle.waitForDrain().then(() => {
      this.runtimeProcess.requestReplacement();
    });
  }

  private createSnapshot(
    checks: RuntimeReadinessSnapshot['checks'],
    degradedCapabilities: RuntimeReadinessSnapshot['degradedCapabilities'],
  ): RuntimeReadinessSnapshot {
    const essentialsReady = areEssentialDependenciesUp(checks);
    return {
      status: !essentialsReady
        ? 'unavailable'
        : degradedCapabilities.length > 0
          ? 'degraded'
          : 'ok',
      kind: 'ready',
      timestamp: new Date().toISOString(),
      version: process.env.APP_VERSION?.trim() || '0.0.1',
      instanceId:
        this.configService.get<string>('instanceId') ??
        `process-${process.pid}`,
      checks,
      degradedCapabilities,
    };
  }
}
