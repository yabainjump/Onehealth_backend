import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { RuntimeReadinessSnapshot } from '../runtime/runtime.types';

describe('HealthController', () => {
  const ready: RuntimeReadinessSnapshot = {
    status: 'ok',
    kind: 'ready',
    timestamp: '2026-08-23T00:00:00.000Z',
    version: '0.0.1',
    instanceId: 'worker-0',
    checks: {
      primaryDatabase: 'up',
      hubDatabase: 'up',
      mediaStorage: 'up',
    },
    degradedCapabilities: [],
  };

  const createResponse = () => {
    const setHeader = jest.fn();
    const status = jest.fn();
    return {
      response: { setHeader, status } as unknown as Response,
      setHeader,
      status,
    };
  };

  it('preserves the legacy route as a liveness response', () => {
    const service = {
      getLiveness: jest.fn().mockReturnValue({ status: 'ok', kind: 'live' }),
    };
    const controller = new HealthController(
      service as unknown as HealthService,
      new ConfigService(),
    );

    expect(controller.getHealth()).toEqual({ status: 'ok', kind: 'live' });
    expect(controller.getLiveness()).toEqual({ status: 'ok', kind: 'live' });
  });

  it('returns ready dependencies with no-store semantics', () => {
    const service = { getReadiness: jest.fn().mockReturnValue(ready) };
    const controller = new HealthController(
      service as unknown as HealthService,
      new ConfigService({ readinessRetryAfterSeconds: 7 }),
    );
    const { response, setHeader, status } = createResponse();

    expect(controller.getReadiness(response)).toEqual(ready);
    expect(setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(status).not.toHaveBeenCalled();
  });

  it('returns 503 and Retry-After when essential dependencies are down', () => {
    const unavailable = {
      ...ready,
      status: 'unavailable' as const,
      checks: { ...ready.checks, primaryDatabase: 'down' as const },
    };
    const service = { getReadiness: jest.fn().mockReturnValue(unavailable) };
    const controller = new HealthController(
      service as unknown as HealthService,
      new ConfigService({ readinessRetryAfterSeconds: 7 }),
    );
    const { response, setHeader, status } = createResponse();

    expect(controller.getReadiness(response)).toEqual(unavailable);
    expect(status).toHaveBeenCalledWith(503);
    expect(setHeader).toHaveBeenCalledWith('Retry-After', '7');
  });
});
