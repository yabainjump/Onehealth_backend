import 'dotenv/config';

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

interface ExportedProvider {
  providerId: string;
  rawId: string;
  email?: string;
  displayName?: string;
  photoUrl?: string;
}

interface ExportedUser {
  localId: string;
  email?: string;
  emailVerified: boolean;
  displayName?: string;
  photoUrl?: string;
  createdAt: string;
  lastSignedInAt: string;
  phoneNumber?: string;
  providerUserInfo: ExportedProvider[];
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value.trim();
}

function toMillisString(value: string | null | undefined): string {
  if (!value) {
    return String(Date.now());
  }
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? String(time) : String(Date.now());
}

async function run(): Promise<void> {
  const serviceAccountPath = resolve(requireEnv('FIREBASE_SERVICE_ACCOUNT_PATH'));
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const outputPath = resolve(
    process.env.FIREBASE_AUTH_EXPORT_PATH ?? './exports/firebase-auth-users.json',
  );

  const serviceAccount = JSON.parse(
    readFileSync(serviceAccountPath, 'utf8'),
  ) as Parameters<typeof cert>[0];

  if (!getApps().length) {
    initializeApp({
      credential: cert(serviceAccount),
      projectId: projectId || undefined,
    });
  }

  const auth = getAuth();
  const users: ExportedUser[] = [];
  let nextPageToken: string | undefined;

  do {
    const page = await auth.listUsers(1000, nextPageToken);

    for (const record of page.users) {
      users.push({
        localId: record.uid,
        email: record.email,
        emailVerified: record.emailVerified,
        displayName: record.displayName,
        photoUrl: record.photoURL,
        createdAt: toMillisString(record.metadata.creationTime),
        lastSignedInAt: toMillisString(record.metadata.lastSignInTime),
        phoneNumber: record.phoneNumber,
        providerUserInfo: (record.providerData ?? []).map((provider) => ({
          providerId: provider.providerId,
          rawId: provider.uid,
          email: provider.email ?? undefined,
          displayName: provider.displayName ?? undefined,
          photoUrl: provider.photoURL ?? undefined,
        })),
      });
    }

    nextPageToken = page.pageToken;
  } while (nextPageToken);

  writeFileSync(outputPath, JSON.stringify({ users }, null, 2), 'utf8');

  console.log(`Firebase Auth export completed via service account.`);
  console.log(`Output: ${outputPath}`);
  console.log(`Users exported: ${users.length}`);
  console.log(
    'Note: passwordHash/salt are not exported via Admin SDK. Password reset is required after migration.',
  );
}

void run().catch((error: unknown) => {
  console.error('Firebase Auth export failed:', error);
  process.exitCode = 1;
});
