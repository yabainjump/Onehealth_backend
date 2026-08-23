import { ConfigService } from '@nestjs/config';
import { RuntimeLifecycleService } from './runtime-lifecycle.service';

describe('RuntimeLifecycleService', () => {
  const createService = (timeoutMs = 50) =>
    new RuntimeLifecycleService(
      new ConfigService({ shutdownTimeoutMs: timeoutMs }),
    );

  it('gates application traffic until ready while keeping health public', () => {
    const service = createService();

    expect(service.canAccept('/api/posts')).toBe(false);
    expect(service.canAccept('/api/health')).toBe(true);
    expect(service.canAccept('/api/health/ready?probe=1')).toBe(true);
    expect(service.canAccept('/api/healthcheck')).toBe(false);

    service.markReady();
    expect(service.canAccept('/api/posts')).toBe(true);
  });

  it('drains tracked requests and rejects new work', async () => {
    const service = createService();
    service.markReady();
    const finish = service.trackRequest();

    service.beginDrain();
    const drained = service.waitForDrain();

    expect(service.canAccept('/api/posts')).toBe(false);
    expect(service.getActiveRequestCount()).toBe(1);
    finish();
    finish();

    await expect(drained).resolves.toBe(true);
    expect(service.getActiveRequestCount()).toBe(0);
  });

  it('bounds shutdown when a request never completes', async () => {
    const service = createService(10);
    service.trackRequest();
    service.beginDrain();

    await expect(service.waitForDrain()).resolves.toBe(false);
  });

  it('aborts remaining provider work only after the graceful drain timeout', async () => {
    const service = createService(10);
    service.trackRequest();

    expect(service.shutdownSignal.aborted).toBe(false);
    await service.beforeApplicationShutdown();
    expect(service.shutdownSignal.aborted).toBe(true);
  });
});
