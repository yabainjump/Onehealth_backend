import { Injectable, Logger } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { basename, join } from 'path';
import sharp from 'sharp';
import { resolveUploadsRoot } from '../config/uploads-path';

const MAX_DOWNLOAD_BYTES = 5 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const DOWNLOAD_TIMEOUT_MS = 5_000;
const OUTPUT_SIZE = 512;
const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
]);
const ALLOWED_IMAGE_FORMATS = new Set([
  'jpeg',
  'png',
  'webp',
  'gif',
  'avif',
  'heif',
]);

export interface MirroredGoogleAvatar {
  photoURL: string;
  sourceURL: string;
}

/**
 * Copie une photo issue d'un ID token Google vers notre stockage.
 *
 * Le téléchargement est volontairement strict : HTTPS, domaine Google
 * allowlisté, redirections revalidées, limite de taille et décodage réel de
 * l'image avant conversion. Cela évite de transformer ce service en proxy SSRF.
 */
@Injectable()
export class GoogleAvatarService {
  private readonly logger = new Logger(GoogleAvatarService.name);
  private readonly uploadsRoot = resolveUploadsRoot();

  async mirror(
    pictureURL: string,
    googleId: string,
  ): Promise<MirroredGoogleAvatar> {
    const sourceURL = this.parseAllowedGoogleURL(pictureURL).toString();
    const image = await this.downloadImage(sourceURL);
    const metadata = await sharp(image, {
      animated: false,
      limitInputPixels: 25_000_000,
    }).metadata();

    if (!metadata.format || !ALLOWED_IMAGE_FORMATS.has(metadata.format)) {
      throw new Error('Unsupported Google avatar image format');
    }

    const ownerHash = this.ownerHash(googleId);
    const contentHash = createHash('sha256')
      .update(image)
      .digest('hex')
      .slice(0, 16);
    const filename = `google-${ownerHash}-${contentHash}.webp`;
    const profileDirectory = join(this.uploadsRoot, 'profile');
    const finalPath = join(profileDirectory, filename);

    await fs.mkdir(profileDirectory, { recursive: true });

    try {
      await fs.access(finalPath);
    } catch {
      const temporaryPath = join(
        profileDirectory,
        `.google-${ownerHash}-${randomUUID()}.tmp`,
      );

      try {
        await sharp(image, {
          animated: false,
          limitInputPixels: 25_000_000,
        })
          .rotate()
          .resize(OUTPUT_SIZE, OUTPUT_SIZE, {
            fit: 'cover',
            position: 'attention',
            withoutEnlargement: false,
          })
          .webp({ quality: 84 })
          .toFile(temporaryPath);
        await fs.rename(temporaryPath, finalPath);
      } finally {
        await this.removeIfExists(temporaryPath);
      }
    }

    return {
      photoURL: `/uploads/profile/${filename}`,
      sourceURL,
    };
  }

  isGoogleHostedURL(value?: string | null): boolean {
    if (!value) return false;

    try {
      this.parseAllowedGoogleURL(value);
      return true;
    } catch {
      return false;
    }
  }

  async isManagedAvatarAvailable(
    photoURL: string | undefined,
    googleId: string,
  ): Promise<boolean> {
    const filename = this.managedFilename(photoURL, googleId);
    if (!filename) return false;

    try {
      await fs.access(join(this.uploadsRoot, 'profile', filename));
      return true;
    } catch {
      return false;
    }
  }

  async removePreviousManagedAvatar(
    photoURL: string | undefined,
    googleId: string,
    keepPhotoURL: string,
  ): Promise<void> {
    if (!photoURL) return;
    const previousFilename = this.managedFilename(photoURL, googleId);
    if (!previousFilename) return;

    // La même image peut être enregistrée tantôt comme URL absolue, tantôt
    // comme chemin /uploads/... . Comparer les chaînes complètes supprimait
    // alors par erreur le fichier encore utilisé après une reconnexion.
    const keptFilename = this.managedFilename(keepPhotoURL, googleId);
    if (previousFilename === keptFilename) return;

    await this.removeIfExists(
      join(this.uploadsRoot, 'profile', previousFilename),
    );
  }

  private async downloadImage(initialURL: string): Promise<Buffer> {
    let currentURL = initialURL;

    for (
      let redirectCount = 0;
      redirectCount <= MAX_REDIRECTS;
      redirectCount += 1
    ) {
      this.parseAllowedGoogleURL(currentURL);
      const response = await fetch(currentURL, {
        method: 'GET',
        redirect: 'manual',
        signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
        headers: {
          Accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif',
          'User-Agent': 'OneHealthNetwork-GoogleAvatar/1.0',
        },
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location || redirectCount === MAX_REDIRECTS) {
          throw new Error('Invalid Google avatar redirect');
        }
        currentURL = new URL(location, currentURL).toString();
        continue;
      }

      if (!response.ok || !response.body) {
        throw new Error(`Google avatar request failed (${response.status})`);
      }

      const contentType = (response.headers.get('content-type') || '')
        .split(';')[0]
        .trim()
        .toLowerCase();
      if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
        throw new Error('Google avatar response is not an allowed image');
      }

      const declaredSize = Number(response.headers.get('content-length') || 0);
      if (declaredSize > MAX_DOWNLOAD_BYTES) {
        throw new Error('Google avatar exceeds the maximum size');
      }

      return this.readLimitedBody(response.body);
    }

    throw new Error('Too many Google avatar redirects');
  }

  private async readLimitedBody(
    body: ReadableStream<Uint8Array>,
  ): Promise<Buffer> {
    const reader = body.getReader();
    const chunks: Uint8Array[] = [];
    let totalSize = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;

        totalSize += value.byteLength;
        if (totalSize > MAX_DOWNLOAD_BYTES) {
          throw new Error('Google avatar exceeds the maximum size');
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }

    if (totalSize === 0) {
      throw new Error('Google avatar response is empty');
    }

    return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
  }

  private parseAllowedGoogleURL(value: string): URL {
    const url = new URL(`${value || ''}`.trim());
    const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
    const isGoogleHost =
      hostname === 'googleusercontent.com' ||
      hostname.endsWith('.googleusercontent.com');

    if (
      url.protocol !== 'https:' ||
      !isGoogleHost ||
      !!url.username ||
      !!url.password ||
      (url.port !== '' && url.port !== '443')
    ) {
      throw new Error('Google avatar URL is not allowed');
    }

    return url;
  }

  private managedFilename(
    photoURL: string | undefined,
    googleId: string,
  ): string | null {
    const rawValue = `${photoURL || ''}`.trim();
    if (!rawValue) return null;

    let pathname = rawValue;
    try {
      pathname = new URL(rawValue).pathname;
    } catch {
      // Les chemins relatifs /uploads/... sont attendus.
    }

    const filename = basename(pathname);
    const expectedPrefix = `google-${this.ownerHash(googleId)}-`;
    return filename.startsWith(expectedPrefix) && filename.endsWith('.webp')
      ? filename
      : null;
  }

  private ownerHash(googleId: string): string {
    return createHash('sha256')
      .update(`${googleId || ''}`)
      .digest('hex')
      .slice(0, 24);
  }

  private async removeIfExists(path: string): Promise<void> {
    try {
      await fs.unlink(path);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') {
        this.logger.warn(
          `Unable to remove obsolete Google avatar (${code || 'unknown'})`,
        );
      }
    }
  }
}
