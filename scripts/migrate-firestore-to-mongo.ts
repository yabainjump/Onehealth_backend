import 'dotenv/config';

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { Timestamp, getFirestore } from 'firebase-admin/firestore';
import bcrypt from 'bcrypt';
import { MongoClient, ObjectId } from 'mongodb';

type JsonObject = Record<string, unknown>;

interface MigrationCounters {
  usersUpserted: number;
  postsUpserted: number;
  roomsUpserted: number;
  messagesUpserted: number;
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

function normalizeValue(value: unknown): unknown {
  if (value instanceof Timestamp) {
    return value.toDate();
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeValue(item));
  }

  if (value && typeof value === 'object') {
    const normalized: JsonObject = {};
    for (const [key, nested] of Object.entries(value)) {
      normalized[key] = normalizeValue(nested);
    }
    return normalized;
  }

  return value;
}

function toDate(value: unknown, fallback: Date): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (value && typeof value === 'object' && 'toDate' in value) {
    const maybeDate = (value as { toDate?: () => Date }).toDate?.();
    if (maybeDate instanceof Date && !Number.isNaN(maybeDate.getTime())) {
      return maybeDate;
    }
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const asDate = new Date(value);
    if (!Number.isNaN(asDate.getTime())) {
      return asDate;
    }
  }

  if (typeof value === 'string' && value.trim()) {
    const asDate = new Date(value);
    if (!Number.isNaN(asDate.getTime())) {
      return asDate;
    }
  }

  return fallback;
}

function safeString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return fallback;
}

async function run(): Promise<void> {
  const mongodbUri = requireEnv('MONGODB_URI');
  const serviceAccountPath = resolve(requireEnv('FIREBASE_SERVICE_ACCOUNT_PATH'));
  const migrationPassword =
    process.env.MIGRATION_DEFAULT_PASSWORD ?? `OneHealth-${Date.now()}-ResetMe`;
  const dbName = (process.env.MONGODB_DB_NAME ?? 'onehealth').trim();

  const serviceAccount = JSON.parse(
    readFileSync(serviceAccountPath, 'utf8'),
  ) as Record<string, unknown>;

  if (!getApps().length) {
    initializeApp({
      credential: cert(serviceAccount as Parameters<typeof cert>[0]),
      projectId:
        (process.env.FIREBASE_PROJECT_ID ?? safeString(serviceAccount.project_id)) ||
        undefined,
    });
  }

  const firestore = getFirestore();
  const mongoClient = new MongoClient(mongodbUri);
  const counters: MigrationCounters = {
    usersUpserted: 0,
    postsUpserted: 0,
    roomsUpserted: 0,
    messagesUpserted: 0,
  };

  const userIdMap = new Map<string, ObjectId>();
  const roomIdMap = new Map<string, ObjectId>();
  const placeholderHash = await bcrypt.hash(migrationPassword, 12);

  await mongoClient.connect();
  const db = mongoClient.db(dbName);

  const usersCollection = db.collection('users');
  const postsCollection = db.collection('posts');
  const roomsCollection = db.collection('chat_rooms');
  const messagesCollection = db.collection('chat_messages');

  try {
    const userSnapshot = await firestore.collection('user').get();
    for (const doc of userSnapshot.docs) {
      const raw = normalizeValue(doc.data()) as JsonObject;
      const firebaseUid = safeString(raw.uid, doc.id) || doc.id;
      const userId = deterministicObjectId('user', firebaseUid);

      userIdMap.set(doc.id, userId);
      userIdMap.set(firebaseUid, userId);

      const email = safeString(raw.email).toLowerCase();
      const username =
        safeString(raw.username) ||
        safeString(raw.name) ||
        (email ? email.split('@')[0] : `user_${doc.id.slice(0, 8)}`);

      const createdAt = toDate(raw.createdAt, doc.createTime.toDate());
      const updatedAt = toDate(raw.updatedAt, doc.updateTime.toDate());

      await usersCollection.updateOne(
        { _id: userId },
        {
          $set: {
            email,
            username,
            firstName: safeString(raw.firstName, 'Unknown'),
            lastName: safeString(raw.lastName, 'Unknown'),
            institution: safeString(raw.institution, 'Unknown'),
            typeMedecin: safeString(raw.typeMedecin),
            country: safeString(raw.country),
            city: safeString(raw.city),
            bio: safeString(raw.bio),
            photoURL:
              safeString(raw.photoURL) ||
              safeString(raw.photo) ||
              'assets/default-profile.png',
            role: safeString(raw.role, 'user') === 'admin' ? 'admin' : 'user',
            createdAt,
            updatedAt,
            migration: {
              source: 'firestore',
              firebaseUid,
              passwordResetRequired: true,
              migratedAt: new Date(),
            },
          },
          $setOnInsert: {
            passwordHash: placeholderHash,
          },
        },
        { upsert: true },
      );

      counters.usersUpserted += 1;
    }

    const postsSnapshot = await firestore.collection('posts').get();
    for (const doc of postsSnapshot.docs) {
      const raw = normalizeValue(doc.data()) as JsonObject;
      const postId = deterministicObjectId('post', doc.id);

      const firebaseAuthorId = safeString(raw.authorId);
      const authorId =
        userIdMap.get(firebaseAuthorId) ??
        deterministicObjectId('user', firebaseAuthorId || `missing-${doc.id}`);

      const likedByRaw = Array.isArray(raw.likedBy) ? raw.likedBy : [];
      const likedBy = likedByRaw
        .map((uid) => safeString(uid))
        .filter(Boolean)
        .map(
          (uid) => userIdMap.get(uid) ?? deterministicObjectId('user', uid),
        );

      const commentsRaw = Array.isArray(raw.comments) ? raw.comments : [];
      const comments = commentsRaw
        .map((entry) => {
          if (typeof entry === 'string') {
            return {
              authorId,
              text: entry,
              createdAt: toDate(undefined, doc.updateTime.toDate()),
            };
          }
          const value = normalizeValue(entry) as JsonObject;
          const commentUserId = safeString(value.userId);
          const commentAuthorId =
            userIdMap.get(commentUserId) ??
            deterministicObjectId('user', commentUserId || firebaseAuthorId);
          return {
            authorId: commentAuthorId,
            text: safeString(value.comment, safeString(value.text)),
            createdAt: toDate(value.createdAt, doc.updateTime.toDate()),
          };
        })
        .filter((comment) => comment.text.length > 0);

      const createdAt = toDate(
        raw.createdAt ?? raw.timestamp,
        doc.createTime.toDate(),
      );
      const updatedAt = toDate(
        raw.updatedAt ?? raw.timestamp,
        doc.updateTime.toDate(),
      );

      await postsCollection.updateOne(
        { _id: postId },
        {
          $set: {
            authorId,
            title: safeString(raw.title),
            content: safeString(raw.content),
            imageUrls: Array.isArray(raw.imageUrls)
              ? raw.imageUrls.map((item) => safeString(item)).filter(Boolean)
              : safeString(raw.imageUrl)
                ? [safeString(raw.imageUrl)]
                : [],
            likesCount:
              typeof raw.likes === 'number'
                ? raw.likes
                : typeof raw.likesCount === 'number'
                  ? raw.likesCount
                  : likedBy.length,
            likedBy,
            comments,
            createdAt,
            updatedAt,
          },
        },
        { upsert: true },
      );

      counters.postsUpserted += 1;
    }

    const roomsSnapshot = await firestore.collection('chatRooms').get();
    for (const doc of roomsSnapshot.docs) {
      const raw = normalizeValue(doc.data()) as JsonObject;
      const roomId = deterministicObjectId('room', doc.id);
      roomIdMap.set(doc.id, roomId);

      const firebaseMembers = Array.isArray(raw.members) ? raw.members : [];
      const members = firebaseMembers
        .map((member) => safeString(member))
        .filter(Boolean)
        .map(
          (uid) => userIdMap.get(uid) ?? deterministicObjectId('user', uid),
        );

      if (!members.length) {
        continue;
      }

      const createdBy = members[0];
      const createdAt = toDate(raw.createdAt, doc.createTime.toDate());
      const updatedAt = toDate(raw.updatedAt, doc.updateTime.toDate());

      const unreadRaw =
        raw.unread && typeof raw.unread === 'object'
          ? (raw.unread as JsonObject)
          : {};
      const unreadCounts: Record<string, number> = {};
      for (const [firebaseUid, count] of Object.entries(unreadRaw)) {
        const mappedUserId =
          userIdMap.get(firebaseUid) ??
          deterministicObjectId('user', firebaseUid);
        unreadCounts[mappedUserId.toString()] =
          typeof count === 'number' ? count : 0;
      }

      await roomsCollection.updateOne(
        { _id: roomId },
        {
          $set: {
            members,
            createdBy,
            lastMessage: safeString(raw.lastMessage),
            unreadCounts,
            createdAt,
            updatedAt,
          },
        },
        { upsert: true },
      );

      counters.roomsUpserted += 1;

      const messagesSnapshot = await firestore
        .collection('chats')
        .doc(doc.id)
        .collection('messages')
        .get();

      for (const messageDoc of messagesSnapshot.docs) {
        const messageRaw = normalizeValue(messageDoc.data()) as JsonObject;
        const messageId = deterministicObjectId('message', messageDoc.id);

        const firebaseSender = safeString(messageRaw.sender);
        const senderId =
          userIdMap.get(firebaseSender) ??
          deterministicObjectId('user', firebaseSender || 'unknown');

        const createdAt = toDate(
          messageRaw.createdAt,
          messageDoc.createTime.toDate(),
        );
        const updatedAt = toDate(
          messageRaw.updatedAt ?? messageRaw.createdAt,
          messageDoc.updateTime.toDate(),
        );

        await messagesCollection.updateOne(
          { _id: messageId },
          {
            $set: {
              roomId,
              senderId,
              text: safeString(messageRaw.message),
              imageUrl: safeString(messageRaw.imageUrl),
              createdAt,
              updatedAt,
            },
          },
          { upsert: true },
        );

        counters.messagesUpserted += 1;
      }
    }

    console.log('Migration completed successfully.');
    console.log(JSON.stringify(counters, null, 2));
    console.log(
      'Note: Imported users have a placeholder bcrypt password. Trigger a password reset flow for migrated accounts.',
    );
  } finally {
    await mongoClient.close();
  }
}

void run().catch((error: unknown) => {
  console.error('Migration failed:', error);
  process.exitCode = 1;
});
