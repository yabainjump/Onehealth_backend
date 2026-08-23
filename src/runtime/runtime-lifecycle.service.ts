import { BeforeApplicationShutdown, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RuntimeState } from './runtime.types';

const HEALTH_PATH = /^\/api\/health(?:\/|$)/;

@Injectable()
export class RuntimeLifecycleService implements BeforeApplicationShutdown {
  private state: RuntimeState = 'starting';
  private activeRequests = 0;
  private readonly drainWaiters = new Set<() => void>();
  private readonly shutdownTimeoutMs: number;
  private readonly shutdownController = new AbortController();

  constructor(configService: ConfigService) {
    this.shutdownTimeoutMs =
      configService.get<number>('shutdownTimeoutMs') ?? 15_000;
  }

  getState(): RuntimeState {
    return this.state;
  }

  getActiveRequestCount(): number {
    return this.activeRequests;
  }

  get shutdownSignal(): AbortSignal {
    return this.shutdownController.signal;
  }

  isHealthRequest(path: string): boolean {
    return HEALTH_PATH.test(path.split('?')[0]);
  }

  canAccept(path: string): boolean {
    return this.isHealthRequest(path) || this.state === 'ready';
  }

  markReady(): void {
    if (this.state !== 'draining') {
      this.state = 'ready';
    }
  }

  markNotReady(): void {
    if (this.state !== 'draining') {
      this.state = 'not_ready';
    }
  }

  beginDrain(): void {
    this.state = 'draining';
    this.resolveDrainWaitersWhenIdle();
  }

  trackRequest(): () => void {
    this.activeRequests += 1;
    let finished = false;

    return () => {
      if (finished) return;
      finished = true;
      this.activeRequests = Math.max(0, this.activeRequests - 1);
      this.resolveDrainWaitersWhenIdle();
    };
  }

  async waitForDrain(): Promise<boolean> {
    if (this.activeRequests === 0) return true;

    return new Promise<boolean>((resolve) => {
      let settled = false;
      const complete = (drained: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        this.drainWaiters.delete(onDrained);
        resolve(drained);
      };
      const onDrained = () => complete(true);

      this.drainWaiters.add(onDrained);
      const timeout = setTimeout(() => complete(false), this.shutdownTimeoutMs);
      timeout.unref();
    });
  }

  async beforeApplicationShutdown(): Promise<void> {
    this.beginDrain();
    const drained = await this.waitForDrain();
    if (!drained) this.shutdownController.abort();
  }

  private resolveDrainWaitersWhenIdle(): void {
    if (this.activeRequests !== 0) return;
    for (const resolve of [...this.drainWaiters]) resolve();
  }
}
