import { createHash, randomBytes } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { ensureUploadsRootReady } from '../src/config/uploads-path';

const CONFIRMATION = 'RUN_CLUSTER_MEDIA_RUDOLF_TEST';
const apiUrl = `${process.env.API_URL ?? ''}`.replace(/\/$/, '');
const email = `${process.env.ADMIN_EMAIL ?? ''}`.trim();
const password = `${process.env.OHN_ADMIN_PASSWORD ?? ''}`;

function requiredConfiguration(): void {
  if (process.env.CLUSTER_TEST_CONFIRM !== CONFIRMATION) {
    throw new Error(
      `Refusing to modify test data. Set CLUSTER_TEST_CONFIRM=${CONFIRMATION}.`,
    );
  }
  if (!apiUrl || !email || !password) {
    throw new Error('API_URL, ADMIN_EMAIL and OHN_ADMIN_PASSWORD are required.');
  }
  if (password.length > 128) throw new Error('Administrator password is invalid.');
}

async function jsonRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<{ response: Response; body: T }> {
  const response = await fetch(`${apiUrl}${path}`, init);
  const text = await response.text();
  let body: T;
  try {
    body = (text ? JSON.parse(text) : {}) as T;
  } catch {
    throw new Error(`Non-JSON response from ${path} (HTTP ${response.status}).`);
  }
  return { response, body };
}

async function discoverWorkers(): Promise<Set<string>> {
  const workers = new Set<string>();
  for (let index = 0; index < 30 && workers.size < 2; index += 1) {
    const { response, body } = await jsonRequest<{ instanceId?: string }>(
      '/health/ready',
    );
    if (!response.ok) throw new Error(`Readiness failed with HTTP ${response.status}.`);
    if (body.instanceId) workers.add(body.instanceId);
  }
  if (workers.size !== 2) {
    throw new Error(`Expected two ready workers, observed ${workers.size}.`);
  }
  return workers;
}

async function verifySharedMedia(): Promise<void> {
  const uploadsRoot = ensureUploadsRootReady();
  if (!isAbsolute(uploadsRoot)) throw new Error('UPLOADS_DIR is not absolute.');
  const probeDirectory = join(uploadsRoot, 'cluster-verification');
  const filename = `probe-${randomBytes(12).toString('hex')}.txt`;
  const filePath = join(probeDirectory, filename);
  const content = randomBytes(96);
  const expectedHash = createHash('sha256').update(content).digest('hex');
  const publicOrigin = new URL(apiUrl).origin;

  await mkdir(probeDirectory, { recursive: true });
  await writeFile(filePath, content, { flag: 'wx', mode: 0o600 });
  try {
    for (let index = 0; index < 12; index += 1) {
      const response = await fetch(
        `${publicOrigin}/uploads/cluster-verification/${filename}`,
        { cache: 'no-store' },
      );
      if (!response.ok) throw new Error(`Media read failed with HTTP ${response.status}.`);
      const received = Buffer.from(await response.arrayBuffer());
      const hash = createHash('sha256').update(received).digest('hex');
      if (hash !== expectedHash) throw new Error('Shared media content changed between reads.');
    }
  } finally {
    await rm(filePath, { force: true });
  }
}

async function verifyRudolfLease(token: string): Promise<void> {
  const authorization = { Authorization: `Bearer ${token}` };
  const created = await jsonRequest<{
    conversation?: { id?: string };
  }>('/rudolf/conversations', { method: 'POST', headers: authorization });
  if (!created.response.ok || !created.body.conversation?.id) {
    throw new Error(`Conversation creation failed with HTTP ${created.response.status}.`);
  }
  const conversationId = created.body.conversation.id;
  try {
    const send = () =>
      fetch(`${apiUrl}/rudolf/conversations/${conversationId}/messages/stream`, {
        method: 'POST',
        headers: {
          ...authorization,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: 'Résume en une phrase le principe One Health.',
        }),
      });
    const responses = await Promise.all([send(), send()]);
    const statuses = responses.map((response) => response.status).sort();
    const bodies = await Promise.all(responses.map((response) => response.text()));
    if (statuses.some((status) => status !== 200 && status !== 409)) {
      throw new Error(`Unexpected Rudolf statuses: ${statuses.join(', ')}.`);
    }
    const conflicts = responses.filter((response) => response.status === 409);
    for (const conflict of conflicts) {
      if (!conflict.headers.get('retry-after')) {
        throw new Error('Rudolf conflict is missing Retry-After.');
      }
    }
    if (
      conflicts.length > 0 &&
      !bodies.some((body) => body.includes('"code":"conversation_busy"'))
    ) {
      throw new Error('Rudolf conflict is missing conversation_busy.');
    }

    const loaded = await jsonRequest<{ messages?: unknown[] }>(
      `/rudolf/conversations/${conversationId}`,
      { headers: authorization },
    );
    const successfulRequests = statuses.filter((status) => status === 200).length;
    if (!loaded.response.ok || loaded.body.messages?.length !== successfulRequests * 2) {
      throw new Error('Rudolf history contains a missing or duplicate exchange.');
    }
  } finally {
    await fetch(`${apiUrl}/rudolf/conversations/${conversationId}`, {
      method: 'DELETE',
      headers: authorization,
    });
  }
}

async function main(): Promise<void> {
  requiredConfiguration();
  const login = await jsonRequest<{ accessToken?: string }>('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!login.response.ok || !login.body.accessToken) {
    throw new Error(`Administrator login failed with HTTP ${login.response.status}.`);
  }

  const workers = await discoverWorkers();
  await verifySharedMedia();
  await verifyRudolfLease(login.body.accessToken);
  console.log(`PASS: two workers (${[...workers].join(', ')}), shared media and Rudolf lease.`);
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown verification error.';
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
});
