import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { existsSync, promises as fs } from 'fs';
import { dirname, extname, join, normalize, sep } from 'path';
import sharp from 'sharp';
import { resolveUploadsRoot } from '../config/uploads-path';
import { MediaSignatureService } from '../media-access/media-signature.service';

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.webm', '.mkv']);
const CACHEABLE_WIDTHS = [64, 128, 256, 400, 640, 800, 1200, 1600] as const;

export interface ResolvedMedia {
  filePath: string;
  contentType: string;
}

interface FfmpegCommandLike {
  on(event: 'end', listener: () => void): this;
  on(event: 'error', listener: (error: Error) => void): this;
  screenshots(options: {
    timestamps: string[];
    filename: string;
    folder: string;
    size: string;
  }): void;
}

interface FfmpegFactory {
  (input: string): FfmpegCommandLike;
  setFfmpegPath(path: string): unknown;
}

/**
 * Genere a la volee (et met en cache) des miniatures d'images et des posters de
 * videos a partir des fichiers deja stockes dans /uploads. Aucun changement de
 * base de donnees : tout post (ancien ou nouveau) en beneficie immediatement.
 */
@Injectable()
export class MediaService {
  // `/api/media/*` est public et non authentifie. Servir un fichier deja en
  // cache est bon marche, mais chaque generation mobilise sharp ou ffmpeg. On
  // borne les generations simultanees pour qu'un afflux de requetes ne puisse
  // pas saturer le CPU de l'hote mutualise ; au-dela, on renvoie 503 et le
  // client retombe sur le media d'origine.
  private static readonly MAX_CONCURRENT_GENERATIONS = 4;

  private static readonly MIN_WIDTH = 16;
  private static readonly MAX_WIDTH = 1600;
  private static readonly DEFAULT_WIDTH = 800;

  private readonly logger = new Logger(MediaService.name);
  private readonly uploadsRoot = resolveUploadsRoot();
  private readonly cacheRoot = join(process.cwd(), '.media-cache');
  // ffmpeg est une dependance OPTIONNELLE : chargee paresseusement, l'app
  // demarre meme si elle est absente (les posters video sont alors desactives).
  private ffmpegLib: FfmpegFactory | null | undefined = undefined;

  async getThumbnail(
    rawPath: string,
    requestedWidth: number,
  ): Promise<ResolvedMedia> {
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
    const cacheFile = join(
      cacheDir,
      `${this.hash(`${sourcePath}|${width}`)}.webp`,
    );

    if (existsSync(cacheFile)) {
      return { filePath: cacheFile, contentType: 'image/webp' };
    }

    this.beginGeneration();
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
      return {
        filePath: sourcePath,
        contentType: this.imageContentType(extension),
      };
    } finally {
      this.endGeneration();
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
    const fallbackFile = join(
      cacheDir,
      `${this.hash(sourcePath)}-fallback.jpg`,
    );

    if (existsSync(cacheFile)) {
      return { filePath: cacheFile, contentType: 'image/jpeg' };
    }

    const ffmpeg = await this.loadFfmpeg();
    if (!ffmpeg) {
      return this.createFallbackPoster(fallbackFile);
    }

    await fs.mkdir(cacheDir, { recursive: true });

    this.beginGeneration();
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
      return this.createFallbackPoster(fallbackFile);
    } finally {
      this.endGeneration();
    }

    if (!existsSync(cacheFile)) {
      return this.createFallbackPoster(fallbackFile);
    }

    return { filePath: cacheFile, contentType: 'image/jpeg' };
  }

  private async createFallbackPoster(
    cacheFile: string,
  ): Promise<ResolvedMedia> {
    if (existsSync(cacheFile)) {
      return { filePath: cacheFile, contentType: 'image/jpeg' };
    }

    const playIcon = Buffer.from(`
      <svg width="1280" height="720" xmlns="http://www.w3.org/2000/svg">
        <circle cx="640" cy="360" r="82" fill="rgba(255,255,255,0.92)"/>
        <path d="M620 310 L620 410 L700 360 Z" fill="#17407f"/>
      </svg>
    `);

    await fs.mkdir(dirname(cacheFile), { recursive: true });
    await sharp({
      create: {
        width: 1280,
        height: 720,
        channels: 3,
        background: '#17407f',
      },
    })
      .composite([{ input: playIcon }])
      .jpeg({ quality: 82 })
      .toFile(cacheFile);

    return { filePath: cacheFile, contentType: 'image/jpeg' };
  }

  /**
   * Produit une version JPEG (carrée, fond blanc) d'une image stockée, pour les
   * aperçus de partage social. Les robots WhatsApp/Facebook n'affichent pas le
   * WebP : on convertit donc en JPEG, redimensionné et mis en cache.
   */
  async getSocialImage(rawPath: string): Promise<ResolvedMedia> {
    const sourcePath = this.resolveSourcePath(rawPath);
    const extension = extname(sourcePath).toLowerCase();

    if (!IMAGE_EXTENSIONS.has(extension)) {
      throw new BadRequestException('Unsupported image type');
    }
    if (!existsSync(sourcePath)) {
      throw new NotFoundException('Source image not found');
    }

    const cacheDir = join(this.cacheRoot, 'social');
    const cacheFile = join(cacheDir, `${this.hash(sourcePath)}.jpg`);

    if (existsSync(cacheFile)) {
      return { filePath: cacheFile, contentType: 'image/jpeg' };
    }

    this.beginGeneration();
    try {
      await fs.mkdir(cacheDir, { recursive: true });
      await sharp(sourcePath, { animated: false })
        .rotate()
        .resize(800, 800, { fit: 'cover', position: 'centre' })
        .flatten({ background: '#ffffff' })
        .jpeg({ quality: 82 })
        .toFile(cacheFile);
      return { filePath: cacheFile, contentType: 'image/jpeg' };
    } catch (error) {
      this.logger.warn(
        `Social image generation failed for ${sourcePath}: ${this.errorMessage(error)}`,
      );
      // En cas d'echec, on sert l'original : jamais d'image cassee.
      return {
        filePath: sourcePath,
        contentType: this.imageContentType(extension),
      };
    } finally {
      this.endGeneration();
    }
  }

  private async loadFfmpeg(): Promise<FfmpegFactory | null> {
    if (this.ffmpegLib !== undefined) {
      return this.ffmpegLib;
    }

    try {
      const ffmpegModule: unknown = await import('fluent-ffmpeg');
      const ffmpegCandidate = this.defaultExport(ffmpegModule);
      if (!this.isFfmpegFactory(ffmpegCandidate)) {
        throw new Error('Invalid fluent-ffmpeg module shape.');
      }

      const ffmpegStaticModule: unknown = await import('ffmpeg-static');
      const ffmpegStatic = this.defaultExport(ffmpegStaticModule);
      if (typeof ffmpegStatic === 'string' && ffmpegStatic.length > 0) {
        const ffmpeg = ffmpegCandidate;
        ffmpeg.setFfmpegPath(ffmpegStatic);
      }
      this.ffmpegLib = ffmpegCandidate;
    } catch {
      this.logger.warn(
        'ffmpeg indisponible — generation des posters video desactivee.',
      );
      this.ffmpegLib = null;
    }

    return this.ffmpegLib;
  }

  private defaultExport(moduleValue: unknown): unknown {
    if (
      (typeof moduleValue === 'object' || typeof moduleValue === 'function') &&
      moduleValue !== null &&
      'default' in moduleValue
    ) {
      return moduleValue.default;
    }
    return moduleValue;
  }

  private isFfmpegFactory(value: unknown): value is FfmpegFactory {
    return (
      typeof value === 'function' &&
      'setFfmpegPath' in value &&
      typeof value.setFfmpegPath === 'function'
    );
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
    // Les pieces jointes privees ne passent pas par la generation d'images :
    // sinon `/api/media/thumb` renverrait une copie redimensionnee d'un media
    // que le service statique protege pourtant par signature. `sep` est
    // normalise en `/` pour que le prefixe se compare aussi sous Windows.
    const posixRelative = safeRelative.split(sep).join('/');
    if (MediaSignatureService.isProtectedPath(`/uploads/${posixRelative}`)) {
      throw new BadRequestException('Invalid media path');
    }

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
    const clamped = Math.min(
      Math.max(width, MediaService.MIN_WIDTH),
      MediaService.MAX_WIDTH,
    );
    return (
      CACHEABLE_WIDTHS.find((candidate) => candidate >= clamped) ??
      CACHEABLE_WIDTHS[CACHEABLE_WIDTHS.length - 1]
    );
  }

  private activeGenerations = 0;

  private beginGeneration(): void {
    if (this.activeGenerations >= MediaService.MAX_CONCURRENT_GENERATIONS) {
      throw new ServiceUnavailableException('Media generation is saturated');
    }
    this.activeGenerations += 1;
  }

  private endGeneration(): void {
    this.activeGenerations = Math.max(0, this.activeGenerations - 1);
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
