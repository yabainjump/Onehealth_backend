import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { existsSync, promises as fs } from 'fs';
import { extname, join, normalize, sep } from 'path';
import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';

if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.webm', '.mkv']);

export interface ResolvedMedia {
  filePath: string;
  contentType: string;
}

/**
 * Genere a la volee (et met en cache) des miniatures d'images et des posters de
 * videos a partir des fichiers deja stockes dans /uploads. Aucun changement de
 * base de donnees : tout post (ancien ou nouveau) en beneficie immediatement.
 */
@Injectable()
export class MediaService {
  private static readonly MIN_WIDTH = 16;
  private static readonly MAX_WIDTH = 1600;
  private static readonly DEFAULT_WIDTH = 800;

  private readonly logger = new Logger(MediaService.name);
  private readonly uploadsRoot = join(process.cwd(), 'uploads');
  private readonly cacheRoot = join(process.cwd(), '.media-cache');

  async getThumbnail(rawPath: string, requestedWidth: number): Promise<ResolvedMedia> {
    const sourcePath = this.resolveSourcePath(rawPath);
    const extension = extname(sourcePath).toLowerCase();

    if (!IMAGE_EXTENSIONS.has(extension)) {
      throw new BadRequestException('Unsupported image type');
    }
    if (!existsSync(sourcePath)) {
      throw new NotFoundException('Source image not found');
    }

    const width = this.clampWidth(requestedWidth);
    const cacheDir = join(this.cacheRoot, 'thumb');
    const cacheFile = join(cacheDir, `${this.hash(`${sourcePath}|${width}`)}.webp`);

    if (existsSync(cacheFile)) {
      return { filePath: cacheFile, contentType: 'image/webp' };
    }

    try {
      await fs.mkdir(cacheDir, { recursive: true });
      await sharp(sourcePath, { animated: extension === '.gif' })
        .rotate()
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: 78 })
        .toFile(cacheFile);
      return { filePath: cacheFile, contentType: 'image/webp' };
    } catch (error) {
      // Si la miniaturisation echoue, on sert l'original : jamais d'image cassee.
      this.logger.warn(
        `Thumbnail generation failed for ${sourcePath}: ${this.errorMessage(error)}`,
      );
      return { filePath: sourcePath, contentType: this.imageContentType(extension) };
    }
  }

  async getPoster(rawPath: string): Promise<ResolvedMedia> {
    const sourcePath = this.resolveSourcePath(rawPath);
    const extension = extname(sourcePath).toLowerCase();

    if (!VIDEO_EXTENSIONS.has(extension)) {
      throw new BadRequestException('Unsupported video type');
    }
    if (!existsSync(sourcePath)) {
      throw new NotFoundException('Source video not found');
    }

    const cacheDir = join(this.cacheRoot, 'poster');
    const cacheName = `${this.hash(sourcePath)}.jpg`;
    const cacheFile = join(cacheDir, cacheName);

    if (existsSync(cacheFile)) {
      return { filePath: cacheFile, contentType: 'image/jpeg' };
    }

    await fs.mkdir(cacheDir, { recursive: true });

    try {
      await new Promise<void>((resolve, reject) => {
        ffmpeg(sourcePath)
          .on('end', () => resolve())
          .on('error', (err: Error) => reject(err))
          .screenshots({
            timestamps: ['50%'],
            filename: cacheName,
            folder: cacheDir,
            size: '?x720',
          });
      });
    } catch (error) {
      this.logger.warn(
        `Poster generation failed for ${sourcePath}: ${this.errorMessage(error)}`,
      );
      throw new NotFoundException('Could not generate poster');
    }

    if (!existsSync(cacheFile)) {
      throw new NotFoundException('Could not generate poster');
    }

    return { filePath: cacheFile, contentType: 'image/jpeg' };
  }

  private resolveSourcePath(rawPath: string): string {
    const value = `${rawPath || ''}`.trim();
    if (!value) {
      throw new BadRequestException('Missing media path');
    }

    const uploadsIndex = value.indexOf('/uploads/');
    const relative =
      uploadsIndex >= 0
        ? value.substring(uploadsIndex + '/uploads/'.length)
        : value.replace(/^\/+/, '');

    // Empeche toute traversee de repertoire (../).
    const safeRelative = normalize(relative).replace(/^(\.\.(\/|\\|$))+/, '');
    const absolutePath = join(this.uploadsRoot, safeRelative);

    if (
      absolutePath !== this.uploadsRoot &&
      !absolutePath.startsWith(this.uploadsRoot + sep)
    ) {
      throw new BadRequestException('Invalid media path');
    }

    return absolutePath;
  }

  private clampWidth(value: number): number {
    const width = Math.floor(Number(value)) || MediaService.DEFAULT_WIDTH;
    return Math.min(
      Math.max(width, MediaService.MIN_WIDTH),
      MediaService.MAX_WIDTH,
    );
  }

  private hash(value: string): string {
    return createHash('sha1').update(value).digest('hex');
  }

  private imageContentType(extension: string): string {
    switch (extension) {
      case '.png':
        return 'image/png';
      case '.webp':
        return 'image/webp';
      case '.gif':
        return 'image/gif';
      default:
        return 'image/jpeg';
    }
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
