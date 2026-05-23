import 'dotenv/config';

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import bcrypt from 'bcrypt';
import { MongoClient, ObjectId } from 'mongodb';

interface FirebaseAuthUser {
  localId?: string;
  email?: string;
  displayName?: string;
  photoUrl?: string;
  emailVerified?: boolean;
  phoneNumber?: string;
  createdAt?: string;
  lastSignedInAt?: string;
  providerUserInfo?: Array<{
    providerId?: string;
  }>;
}

interface FirebaseAuthExport {
  users?: FirebaseAuthUser[];
}

interface ImportCounters {
  processed: number;
  upserted: number;
  inserted: number;
  updated: number;
  skipped: number;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value.trim();
}

function deterministicObjectId(namespace: string, value: string): ObjectId {
  const hex = createHash('md5')
    .update(`${namespace}:${value}`)
    .digest('hex')
    .slice(0, 24);
  return new ObjectId(hex);
}

function safeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function parseFirebaseMillis(value: unknown): Date | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value === 'string' && value.trim()) {
    const asNumber = Number(value);
    if (Number.isFinite(asNumber)) {
      const date = new Date(asNumber);
      if (!Number.isNaN(date.getTime())) {
        return date;
      }
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

function splitDisplayName(displayName: string): { firstName: string; lastName: string } {
  const clean = displayName.trim();
  if (!clean) {
    return { firstName: 'Unknown', lastName: 'Unknown' };
  }

  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: 'Unknown' };
  }

  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

async function run(): Promise<void> {
  const mongodbUri = requireEnv('MONGODB_URI');
  const dbName = (process.env.MONGODB_DB_NAME ?? 'onehealth').trim();
  const authExportPath = resolve(requireEnv('FIREBASE_AUTH_EXPORT_PATH'));
  const migrationPassword =
    process.env.MIGRATION_DEFAULT_PASSWORD ?? `OneHealth-${Date.now()}-ResetMe`;

  const fileContent = JSON.parse(
    readFileSync(authExportPath, 'utf8'),
  ) as FirebaseAuthExport;
  const users = Array.isArray(fileContent.users) ? fileContent.users : [];

  const mongoClient = new MongoClient(mongodbUri);
  await mongoClient.connect();

  const db = mongoClient.db(dbName);
  const usersCollection = db.collection('users');
  const placeholderHash = await bcrypt.hash(migrationPassword, 12);

  const counters: ImportCounters = {
    processed: 0,
    upserted: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
  };

  try {
    for (const user of users) {
      counters.processed += 1;

      const uid = safeString(user.localId);
      if (!uid) {
        counters.skipped += 1;
        continue;
      }

      const emailRaw = safeString(user.email).toLowerCase();
      const email = emailRaw || `missing-email+${uid}@onehealth.local`;
      const displayName = safeString(user.displayName);
      const names = splitDisplayName(displayName);
      const username =
        displayName.replace(/\s+/g, '.').toLowerCase() ||
        (emailRaw ? emailRaw.split('@')[0] : `user_${uid.slice(0, 10)}`);

      const createdAt = parseFirebaseMillis(user.createdAt) ?? new Date();
      const lastSignedInAt = parseFirebaseMillis(user.lastSignedInAt) ?? createdAt;
      const providers = Array.isArray(user.providerUserInfo)
        ? user.providerUserInfo
            .map((provider) => safeString(provider?.providerId))
            .filter(Boolean)
        : [];

      const expectedId = deterministicObjectId('user', uid);
      const lookup: Array<Record<string, unknown>> = [
        { _id: expectedId },
        { 'migration.firebaseUid': uid },
      ];
      if (emailRaw) {
        lookup.push({ email: emailRaw });
      }

      const existing = await usersCollection.findOne(
        { $or: lookup },
        { projection: { _id: 1, passwordHash: 1, createdAt: 1 } },
      );

      const targetId = (existing?._id as ObjectId | undefined) ?? expectedId;
      const passwordHash =
        typeof existing?.passwordHash === 'string' && existing.passwordHash.length > 0
          ? existing.passwordHash
          : placeholderHash;

      const updateResult = await usersCollection.updateOne(
        { _id: targetId },
        {
          $set: {
            email,
            username,
            firstName: names.firstName,
            lastName: names.lastName,
            institution: 'Unknown',
            typeMedecin: '',
            country: '',
            city: '',
            bio: '',
            photoURL: safeString(user.photoUrl),
            role: 'user',
            passwordHash,
            createdAt:
              existing?.createdAt instanceof Date ? existing.createdAt : createdAt,
            updatedAt: lastSignedInAt,
            migration: {
              source: 'firebase-auth-export',
              firebaseUid: uid,
              emailVerified: user.emailVerified === true,
              phoneNumber: safeString(user.phoneNumber),
              providers,
              passwordResetRequired: true,
              migratedAt: new Date(),
            },
          },
        },
        { upsert: true },
      );

      counters.upserted += 1;
      if (updateResult.upsertedCount > 0) {
        counters.inserted += 1;
      } else {
        counters.updated += 1;
      }
    }

    console.log('Firebase Auth import completed successfully.');
    console.log(JSON.stringify(counters, null, 2));
    console.log(
      'Note: Firebase password hashes are not migrated to bcrypt. Users must reset their password in OneHealth.',
    );
  } finally {
    await mongoClient.close();
  }
}

void run().catch((error: unknown) => {
  console.error('Firebase Auth import failed:', error);
  process.exitCode = 1;
});
