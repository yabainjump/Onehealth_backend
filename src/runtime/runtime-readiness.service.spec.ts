import { ConfigService } from '@nestjs/config';
import { RuntimeDependencyProbeService } from './runtime-dependency-probe.service';
import { RuntimeLifecycleService } from './runtime-lifecycle.service';
import { RuntimeReadinessService } from './runtime-readiness.service';
import { EssentialDependencyChecks } from './runtime.types';

const UP: EssentialDependencyChecks = {
  primaryDatabase: 'up',
  hubDatabase: 'up',
  mediaStorage: 'up',
};

const DOWN: EssentialDependencyChecks = {
  primaryDatabase: 'down',
  hubDatabase: 'up',
  mediaStorage: 'up',
};

describe('RuntimeReadinessService', () => {
  const services: RuntimeReadinessService[] = [];

  const createSubject = () => {
    const probe = {
      probeEssential: jest.fn<Promise<EssentialDependencyChecks>, []>(),
      getDegradedCapabilities: jest.fn().mockReturnValue([]),
    };
    const config = new ConfigService({
      shutdownTimeoutMs: 50,
      readinessProbeIntervalMs: 60_000,
      readinessFailureThreshold: 2,
      instanceId: 'test-worker-0',
    });
    const lifecycle = new RuntimeLifecycleService(config);
    const runtimeProcess = {
      requestReplacement: jest.fn(),
    };
    const subject = new RuntimeReadinessService(
      probe as unknown as RuntimeDependencyProbeService,
      lifecycle,
      runtimeProcess,
      config,
    );
    services.push(subject);

    return { subject, probe, lifecycle, runtimeProcess };
  };

  afterEach(() => {
    for (const service of services.splice(0)) service.onModuleDestroy();
  });

  it('signals readiness only after every essential dependency succeeds', async () => {
    const { subject, probe, lifecycle } = createSubject();
    probe.probeEssential.mockResolvedValue(UP);
    probe.getDegradedCapabilities.mockReturnValue(['email']);

    await expect(subject.initialize()).resolves.toBe(true);
    expect(lifecycle.getState()).toBe('ready');
    expect(subject.getSnapshot()).toMatchObject({
      status: 'degraded',
      instanceId: 'test-worker-0',
      checks: UP,
      degradedCapabilities: ['email'],
    });
  });

  it('keeps a failed startup out of traffic without requesting a restart', async () => {
    const { subject, probe, lifecycle, runtimeProcess } = createSubject();
    probe.probeEssential.mockResolvedValue(DOWN);

    await expect(subject.initialize()).resolves.toBe(false);
    expect(lifecycle.getState()).toBe('not_ready');
    expect(runtimeProcess.requestReplacement).not.toHaveBeenCalled();
  });

  it('self-drains once after consecutive runtime failures', async () => {
    const { subject, probe, lifecycle, runtimeProcess } = createSubject();
    probe.probeEssential
      .mockResolvedValueOnce(UP)
      .mockResolvedValueOnce(DOWN)
      .mockResolvedValueOnce(DOWN);

    await subject.initialize();
    const finish = lifecycle.trackRequest();
    await subject.refresh();
    await subject.refresh();

    expect(lifecycle.getState()).toBe('draining');
    expect(runtimeProcess.requestReplacement).not.toHaveBeenCalled();

    finish();
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(runtimeProcess.requestReplacement).toHaveBeenCalledTimes(1);

    await subject.refresh();
    expect(runtimeProcess.requestReplacement).toHaveBeenCalledTimes(1);
  });

  it('resets the failure count after recovery to avoid flapping', async () => {
    const { subject, probe, lifecycle, runtimeProcess } = createSubject();
    probe.probeEssential
      .mockResolvedValueOnce(UP)
      .mockResolvedValueOnce(DOWN)
      .mockResolvedValueOnce(UP)
      .mockResolvedValueOnce(DOWN);

    await subject.initialize();
    await subject.refresh();
    await subject.refresh();
    await subject.refresh();

    expect(lifecycle.getState()).toBe('not_ready');
    expect(runtimeProcess.requestReplacement).not.toHaveBeenCalled();
  });
});
