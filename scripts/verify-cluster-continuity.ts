import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const confirmation = process.env.CLUSTER_VERIFY_CONFIRM;
const allowProduction = process.env.CLUSTER_VERIFY_ALLOW_PRODUCTION === 'true';
const configuredBaseUrl =
  process.env.CLUSTER_VERIFY_BASE_URL ?? 'http://127.0.0.1:3000/api';
const baseUrl = new URL(
  configuredBaseUrl.endsWith('/') ? configuredBaseUrl : `${configuredBaseUrl}/`,
);
const pm2Bin = process.env.PM2_BIN ?? 'pm2';
const appName = process.env.PM2_APP_NAME ?? 'onehealth-backend';
const ecosystemPath = process.env.PM2_ECOSYSTEM ?? 'ecosystem.config.cjs';
const replacementDeadlineMs = 10_000;

interface Pm2ProcessDescription {
  name?: string;
  pid?: number;
  pm_id?: number;
  pm2_env?: { status?: string };
}

interface ReadyResponse {
  status?: string;
  instanceId?: string;
}

const sleep = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

const progress = (
  step: string,
  details: Record<string, unknown> = {},
): void => {
  console.log(
    JSON.stringify({
      type: 'cluster-verification-progress',
      step,
      at: new Date().toISOString(),
      ...details,
    }),
  );
};

const refusesProduction = (): boolean => {
  const productionHost = /(?:^|\.)onehealthnetwork\.yaba-in\.com$/i.test(
    baseUrl.hostname,
  );
  return (process.env.NODE_ENV === 'production' || productionHost) && !allowProduction;
};

const getProcesses = async (): Promise<Pm2ProcessDescription[]> => {
  const { stdout } = await execFileAsync(pm2Bin, ['jlist'], {
    maxBuffer: 4 * 1024 * 1024,
  });
  const processes = JSON.parse(stdout) as Pm2ProcessDescription[];
  return processes.filter((item) => item.name === appName);
};

const probeReady = async (): Promise<ReadyResponse | undefined> => {
  try {
    const response = await fetch(new URL('health/ready', baseUrl), {
      signal: AbortSignal.timeout(2_000),
      cache: 'no-store',
      headers: { connection: 'close' },
    });
    if (!response.ok) return undefined;
    return (await response.json()) as ReadyResponse;
  } catch {
    return undefined;
  }
};

const waitForTwoReadyWorkers = async (
  timeoutMs: number,
): Promise<{ elapsedMs: number; instanceIds: string[] }> => {
  const startedAt = Date.now();
  const instanceIds = new Set<string>();

  while (Date.now() - startedAt < timeoutMs) {
    const [processes, ready] = await Promise.all([getProcesses(), probeReady()]);
    if (ready?.instanceId) instanceIds.add(ready.instanceId);

    const onlineCount = processes.filter(
      (item) => item.pm2_env?.status === 'online',
    ).length;
    if (onlineCount === 2 && instanceIds.size >= 2) {
      return {
        elapsedMs: Date.now() - startedAt,
        instanceIds: [...instanceIds],
      };
    }
    await sleep(200);
  }

  throw new Error('Two distinct ready workers were not observed before timeout.');
};

const reloadUnderReadTraffic = async (): Promise<{
  requests: number;
  failures: number;
  elapsedMs: number;
}> => {
  const startedAt = Date.now();
  let completed = false;
  let reloadError: unknown;
  const reload = execFileAsync(
    pm2Bin,
    ['reload', ecosystemPath, '--only', appName, '--update-env'],
    { maxBuffer: 4 * 1024 * 1024, timeout: 90_000 },
  )
    .catch((error: unknown) => {
      reloadError = error;
    })
    .finally(() => {
      completed = true;
    });

  let requests = 0;
  let failures = 0;
  while (!completed) {
    requests += 1;
    if (!(await probeReady())) failures += 1;
    await sleep(50);
  }
  await reload;
  if (reloadError) throw reloadError;
  await waitForTwoReadyWorkers(60_000);

  return { requests, failures, elapsedMs: Date.now() - startedAt };
};

const main = async (): Promise<void> => {
  if (confirmation !== 'RUN_DISPOSABLE_CLUSTER_TEST') {
    throw new Error(
      'Refusing destructive worker tests. Set CLUSTER_VERIFY_CONFIRM=RUN_DISPOSABLE_CLUSTER_TEST.',
    );
  }
  if (refusesProduction()) {
    throw new Error(
      'Production verification is refused by default. Use a disposable environment.',
    );
  }

  progress('baseline-waiting');
  const baseline = await waitForTwoReadyWorkers(60_000);
  progress('baseline-ready', {
    instanceIds: baseline.instanceIds,
    elapsedMs: baseline.elapsedMs,
  });
  const processes = await getProcesses();
  const victim = processes.find(
    (item) => item.pm2_env?.status === 'online' && item.pid && item.pid > 0,
  );
  if (!victim?.pid) throw new Error('No replaceable PM2 worker was found.');

  progress('worker-termination-starting', { pmId: victim.pm_id });
  process.kill(victim.pid, 'SIGKILL');
  const replacement = await waitForTwoReadyWorkers(replacementDeadlineMs);
  const afterReplacement = await getProcesses();
  if (afterReplacement.some((item) => item.pid === victim.pid)) {
    throw new Error('PM2 did not replace the terminated worker process.');
  }
  progress('worker-replaced', {
    elapsedMs: replacement.elapsedMs,
    instanceIds: replacement.instanceIds,
  });

  let requests = 0;
  let failures = 0;
  for (let reload = 1; reload <= 10; reload += 1) {
    progress('reload-starting', { reload, total: 10 });
    const result = await reloadUnderReadTraffic();
    requests += result.requests;
    failures += result.failures;
    progress('reload-completed', {
      reload,
      total: 10,
      elapsedMs: result.elapsedMs,
      readinessRequests: result.requests,
      readinessFailures: result.failures,
    });
  }

  console.log(
    JSON.stringify(
      {
        result: 'pass',
        baselineWorkers: baseline.instanceIds,
        replacementObservedInMs: replacement.elapsedMs,
        reloads: 10,
        readinessRequests: requests,
        readinessFailures: failures,
        note: 'Read-only verifier; Nginx proxy_next_upstream is disabled to prevent infrastructure replay of writes.',
      },
      null,
      2,
    ),
  );
};

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(`Cluster verification failed: ${message}`);
  process.exitCode = 1;
});
