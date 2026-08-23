const confirmation = process.env.CLUSTER_SECURITY_CONFIRM;
const configuredBaseUrl =
  process.env.CLUSTER_SECURITY_BASE_URL ?? 'http://127.0.0.1:3000/api';
const baseUrl = new URL(
  configuredBaseUrl.endsWith('/') ? configuredBaseUrl : `${configuredBaseUrl}/`,
);
const accessToken = process.env.CLUSTER_SECURITY_ACCESS_TOKEN?.trim();
const allowProduction = process.env.CLUSTER_SECURITY_ALLOW_PRODUCTION === 'true';

type ProbeResult = {
  status: number;
  retryAfter: string | null;
};

const positiveInteger = (name: string, fallback: number): number => {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < 1 || value > 1_000) {
    throw new Error(`${name} must be an integer between 1 and 1000.`);
  }
  return value;
};

const assertDisposableTarget = (): void => {
  if (confirmation !== 'RUN_DISPOSABLE_SECURITY_TEST') {
    throw new Error(
      'Refusing quota mutation. Set CLUSTER_SECURITY_CONFIRM=RUN_DISPOSABLE_SECURITY_TEST.',
    );
  }

  const productionHost = /(?:^|\.)onehealthnetwork\.yaba-in\.com$/i.test(
    baseUrl.hostname,
  );
  if ((process.env.NODE_ENV === 'production' || productionHost) && !allowProduction) {
    throw new Error(
      'Production quota verification is refused by default. Use a disposable environment.',
    );
  }
  if (!accessToken) {
    throw new Error(
      'CLUSTER_SECURITY_ACCESS_TOKEN is required for a dedicated disposable test user.',
    );
  }
};

const request = async (
  path: string,
  body: Record<string, unknown>,
  token?: string,
): Promise<ProbeResult> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Connection: 'close',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(new URL(path, baseUrl), {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5_000),
  });
  await response.arrayBuffer();
  return {
    status: response.status,
    retryAfter: response.headers.get('retry-after'),
  };
};

const verifyLimit = async (
  name: string,
  limit: number,
  probe: () => Promise<ProbeResult>,
): Promise<void> => {
  for (let attempt = 1; attempt <= limit; attempt += 1) {
    const result = await probe();
    if (result.status === 429 || result.status === 503) {
      throw new Error(
        `${name} blocked too early on attempt ${attempt} with HTTP ${result.status}.`,
      );
    }
  }

  const blocked = await probe();
  if (blocked.status !== 429 || !blocked.retryAfter) {
    throw new Error(
      `${name} expected HTTP 429 with Retry-After after ${limit} attempts; received HTTP ${blocked.status}.`,
    );
  }
};

const observeWorkers = async (): Promise<string[]> => {
  const ids = new Set<string>();
  for (let attempt = 0; attempt < 20 && ids.size < 2; attempt += 1) {
    const response = await fetch(new URL('health/ready', baseUrl), {
      headers: { Connection: 'close' },
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) {
      throw new Error(`Readiness failed with HTTP ${response.status}.`);
    }
    const health = (await response.json()) as { instanceId?: string };
    if (health.instanceId) ids.add(health.instanceId);
  }
  if (ids.size < 2) {
    throw new Error('Two distinct ready worker identifiers were not observed.');
  }
  return [...ids];
};

const main = async (): Promise<void> => {
  assertDisposableTarget();
  const rudolfShortLimit = positiveInteger(
    'CLUSTER_SECURITY_RUDOLF_SHORT_LIMIT',
    12,
  );
  const workers = await observeWorkers();

  await verifyLimit('auth-login', 10, () =>
    request('auth/login', { invalid: true }),
  );
  await verifyLimit('upload', 30, () =>
    request('upload/profile', { invalid: true }),
  );
  await verifyLimit('rudolf-short', rudolfShortLimit, () =>
    request('rudolf/messages', { message: '' }, accessToken),
  );

  console.log(
    JSON.stringify(
      {
        result: 'pass',
        workers,
        policies: {
          authLogin: 10,
          upload: 30,
          rudolfShort: rudolfShortLimit,
        },
        providerCalls: 0,
        filesCreated: 0,
      },
      null,
      2,
    ),
  );
};

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(`Cluster security verification failed: ${message}`);
  process.exitCode = 1;
});
