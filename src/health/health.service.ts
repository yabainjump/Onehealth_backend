import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RuntimeReadinessService } from '../runtime/runtime-readiness.service';
import { RuntimeReadinessSnapshot } from '../runtime/runtime.types';

@Injectable()
export class HealthService {
  constructor(
    @Optional() private readonly readiness?: RuntimeReadinessService,
    @Optional() private readonly configService?: ConfigService,
  ) {}

  getLiveness() {
    return {
      status: 'ok' as const,
      kind: 'live' as const,
      timestamp: new Date().toISOString(),
      version: process.env.APP_VERSION?.trim() || '0.0.1',
      instanceId:
        this.configService?.get<string>('instanceId') ??
        `process-${process.pid}`,
    };
  }

  getReadiness(): RuntimeReadinessSnapshot {
    if (this.readiness) return this.readiness.getSnapshot();

    return {
      status: 'unavailable',
      kind: 'ready',
      timestamp: new Date().toISOString(),
      version: process.env.APP_VERSION?.trim() || '0.0.1',
      instanceId: `process-${process.pid}`,
      checks: {
        primaryDatabase: 'down',
        hubDatabase: 'down',
        mediaStorage: 'down',
      },
      degradedCapabilities: [],
    };
  }
}
