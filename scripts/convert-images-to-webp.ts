/**
 * Migration : convertit les images existantes (PNG/JPG/GIF) de /uploads en WebP
 * et met a jour les references en base (posts.imageUrls, users.photoURL/coverPhotoURL,
 * chat_messages.imageUrl/fileUrl).
 *
 * - Idempotent : si le .webp existe deja, on reutilise (pas de reconversion).
 * - SANS PERTE de donnees : l'original est conserve par defaut (mettre
 *   DELETE_ORIGINALS=true pour supprimer les fichiers source apres conversion).
 *
 * Lancer :  npm run migrate:webp
 */
import 'dotenv/config';
import { existsSync, promises as fs } from 'fs';
import { join } from 'path';
import { resolveUploadsRoot } from '../src/config/uploads-path';
import mongoose from 'mongoose';
import sharp from 'sharp';

const UPLOADS_ROOT = resolveUploadsRoot();
const IMG_EXT = /\.(png|jpe?g|gif)$/i;
const MAX_DIMENSION = 1920;
const QUALITY = 80;
const DELETE_ORIGINALS =
  (process.env.DELETE_ORIGINALS ?? 'false').toLowerCase() === 'true';

let convertedFiles = 0;
let updatedDocs = 0;

function uploadsDiskPath(url: string): string | null {
  const index = url.indexOf('/uploads/');
  if (index < 0) {
    return null;
  }
  const relative = url.substring(index + '/uploads/'.length);
  if (relative.includes('..')) {
    return null;
  }
  return join(UPLOADS_ROOT, relative);
}

function toWebpUrl(url: string): string {
  return url.replace(IMG_EXT, '.webp');
}

/** Convertit le fichier disque en .webp si necessaire. Renvoie true si l'URL doit etre reecrite. */
async function convertOnDisk(diskPath: string): Promise<boolean> {
  const webpPath = diskPath.replace(IMG_EXT, '.webp');
  if (existsSync(webpPath)) {
    return true; // deja converti
  }
  if (!existsSync(diskPath)) {
    return false; // fichier source absent -> on ne touche pas l'URL
  }
  await sharp(diskPath, { animated: /\.gif$/i.test(diskPath) })
    .rotate()
    .resize({
      width: MAX_DIMENSION,
      height: MAX_DIMENSION,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: QUALITY })
    .toFile(webpPath);
  convertedFiles += 1;
  if (DELETE_ORIGINALS) {
    await fs.unlink(diskPath).catch(() => undefined);
  }
  return true;
}

/** Si l'URL pointe vers une image /uploads non-webp, convertit et renvoie la nouvelle URL .webp. */
async function processUrl(url: unknown): Promise<string | null> {
  if (typeof url !== 'string' || !IMG_EXT.test(url) || !url.includes('/uploads/')) {
    return null;
  }
  const disk = uploadsDiskPath(url);
  if (!disk) {
    return null;
  }
  const ok = await convertOnDisk(disk);
  return ok ? toWebpUrl(url) : null;
}

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is required');
  }
  await mongoose.connect(uri, {
    dbName: process.env.MONGODB_DB_NAME ?? 'onehealth',
  });
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Database connection unavailable');
  }

  // ---- POSTS (imageUrls[]) ----
  const posts = db.collection('posts');
  for await (const post of posts.find({ imageUrls: { $exists: true, $type: 'array' } })) {
    const imageUrls: string[] = Array.isArray(post.imageUrls) ? post.imageUrls : [];
    let changed = false;
    const next: string[] = [];
    for (const url of imageUrls) {
      const webp = await processUrl(url);
      if (webp) {
        next.push(webp);
        changed = true;
      } else {
        next.push(url);
      }
    }
    if (changed) {
      await posts.updateOne({ _id: post._id }, { $set: { imageUrls: next } });
      updatedDocs += 1;
    }
  }

  // ---- USERS (photoURL, coverPhotoURL) ----
  const users = db.collection('users');
  for await (const user of users.find({
    $or: [{ photoURL: IMG_EXT }, { coverPhotoURL: IMG_EXT }],
  })) {
    const set: Record<string, string> = {};
    const photo = await processUrl(user.photoURL);
    if (photo) set.photoURL = photo;
    const cover = await processUrl(user.coverPhotoURL);
    if (cover) set.coverPhotoURL = cover;
    if (Object.keys(set).length > 0) {
      await users.updateOne({ _id: user._id }, { $set: set });
      updatedDocs += 1;
    }
  }

  // ---- CHAT MESSAGES (imageUrl, fileUrl si image) ----
  const messages = db.collection('chat_messages');
  for await (const message of messages.find({
    $or: [{ imageUrl: IMG_EXT }, { fileUrl: IMG_EXT }],
  })) {
    const set: Record<string, string> = {};
    const image = await processUrl(message.imageUrl);
    if (image) set.imageUrl = image;
    const file = await processUrl(message.fileUrl);
    if (file) set.fileUrl = file;
    if (Object.keys(set).length > 0) {
      await messages.updateOne({ _id: message._id }, { $set: set });
      updatedDocs += 1;
    }
  }

  console.log(
    `WebP migration done. Converted ${convertedFiles} file(s), updated ${updatedDocs} document(s).` +
      (DELETE_ORIGINALS ? ' Originals deleted.' : ' Originals kept.'),
  );

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error('WebP migration failed:', error);
  process.exit(1);
});
