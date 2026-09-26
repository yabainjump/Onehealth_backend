/**
 * Dry-run-first repair for certification evidence previously stored as public
 * post media. Never run this during normal deployment or without a backup.
 */
import 'dotenv/config';
import { promises as fs } from 'node:fs';
import { basename, join } from 'node:path';
import mongoose, { Types } from 'mongoose';
import { resolveUploadsRoot } from '../src/config/uploads-path';

interface LegacyRequest {
  _id: Types.ObjectId;
  documents: string[];
}

const apply = process.argv.includes('--apply');
if (apply && process.env.CERTIFICATION_MEDIA_MIGRATION_CONFIRM !== 'APPLY') {
  throw new Error(
    'Set CERTIFICATION_MEDIA_MIGRATION_CONFIRM=APPLY for --apply',
  );
}

function legacyName(raw: string): string | null {
  try {
    const path = new URL(raw, 'http://local.invalid').pathname;
    const match = /^\/uploads\/post\/([A-Za-z0-9._-]+)$/.exec(path);
    return match && basename(match[1]) === match[1] ? match[1] : null;
  } catch {
    return null;
  }
}

async function present(path: string): Promise<boolean> {
  try {
    await fs.stat(path);
    return true;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is required');
  const root = resolveUploadsRoot();
  const destinationDir = join(root, 'certification');
  await mongoose.connect(uri, {
    dbName: process.env.MONGODB_DB_NAME || 'onehealth',
  });
  const db = mongoose.connection.db;
  if (!db) throw new Error('MongoDB connection is unavailable');
  const requests = db.collection<LegacyRequest>('certification_requests');
  const posts = db.collection('posts');
  const alerts = db.collection('alerts');
  const users = db.collection('users');
  const messages = db.collection('chat_messages');
  const counters = {
    candidates: 0,
    eligible: 0,
    migrated: 0,
    shared: 0,
    missing: 0,
    ambiguous: 0,
  };
  const issues: Array<{
    requestId: string;
    reason: string;
    filename?: string;
  }> = [];

  try {
    for await (const request of requests.find({
      documents: /\/uploads\/post\//,
    })) {
      const updated = [...(request.documents || [])];
      let changed = false;
      for (let index = 0; index < updated.length; index += 1) {
        const name = legacyName(updated[index]);
        if (!name) {
          if (updated[index].includes('/uploads/post/')) {
            counters.ambiguous += 1;
            issues.push({
              requestId: request._id.toString(),
              reason: 'ambiguous',
            });
          }
          continue;
        }
        counters.candidates += 1;
        const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const reference = new RegExp(escaped);
        const shared = await Promise.all([
          posts.findOne({ imageUrls: reference }, { projection: { _id: 1 } }),
          alerts.findOne({ imageUrls: reference }, { projection: { _id: 1 } }),
          users.findOne(
            { $or: [{ photoURL: reference }, { photo: reference }] },
            { projection: { _id: 1 } },
          ),
          messages.findOne(
            { $or: [{ imageUrl: reference }, { fileUrl: reference }] },
            { projection: { _id: 1 } },
          ),
        ]);
        if (shared.some(Boolean)) {
          counters.shared += 1;
          issues.push({
            requestId: request._id.toString(),
            reason: 'shared',
            filename: name,
          });
          continue;
        }

        const source = join(root, 'post', name);
        const destination = join(destinationDir, name);
        const sourceExists = await present(source);
        const targetExists = await present(destination);
        if (!sourceExists && !targetExists) {
          counters.missing += 1;
          issues.push({
            requestId: request._id.toString(),
            reason: 'missing',
            filename: name,
          });
          continue;
        }
        if (sourceExists && targetExists) {
          const [a, b] = await Promise.all([
            fs.stat(source),
            fs.stat(destination),
          ]);
          if (a.dev !== b.dev || a.ino !== b.ino) {
            counters.ambiguous += 1;
            issues.push({
              requestId: request._id.toString(),
              reason: 'target-conflict',
              filename: name,
            });
            continue;
          }
        }

        counters.eligible += 1;
        if (apply) {
          await fs.mkdir(destinationDir, { recursive: true });
          if (sourceExists && !targetExists) await fs.link(source, destination);
          if (sourceExists) await fs.unlink(source);
          updated[index] = `__PRIVATE__${name}`;
          changed = true;
          counters.migrated += 1;
        }
      }

      if (apply && changed) {
        // Keep the existing backend media origin; only change the storage namespace.
        const documents = updated.map((value, index) =>
          value.startsWith('__PRIVATE__')
            ? request.documents[index]
                .replace('/uploads/post/', '/uploads/certification/')
                .replace(/\?.*$/, '')
            : value,
        );
        const result = await requests.updateOne(
          { _id: request._id, documents: request.documents },
          { $set: { documents } },
        );
        if (result.matchedCount !== 1) {
          throw new Error(
            'Certification request changed during migration; rerun after review',
          );
        }
      }
    }
    console.log(
      JSON.stringify({
        mode: apply ? 'apply' : 'dry-run',
        ...counters,
        issues,
      }),
    );
    if (counters.shared || counters.missing || counters.ambiguous) {
      process.exitCode = 2;
    }
  } finally {
    await mongoose.disconnect();
  }
}

void main().catch(() => {
  // Driver errors can include a credential-bearing MongoDB URI.
  console.error(
    'Migration failed. Review the server log securely; do not paste secrets.',
  );
  process.exitCode = 1;
});
