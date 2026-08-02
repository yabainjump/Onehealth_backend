import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { extname, join } from 'path';
import sharp from 'sharp';
import { resolveUploadsRoot } from '../config/uploads-path';

export type UploadKind = 'profile' | 'post' | 'message';

// Bornes de conversion WebP a l'upload.
const WEBP_MAX_DIMENSION = 1920;
const WEBP_QUALITY = 80;
const IMAGE_SIGNATURES = ['jpeg', 'png', 'webp', 'gif'];

interface UploadedFileLike {
  path: string;
  mimetype: string;
  originalname: string;
  size: number;
}

interface FileRule {
  extensions: string[];
  mimeTypes: string[];
  signature:
    | 'jpeg'
    | 'png'
    | 'webp'
    | 'gif'
    | 'pdf'
    | 'zip'
    | 'ole'
    | 'mp4qt'
    | 'ebml'
    | 'text';
  allowedFor: UploadKind[];
}

interface FinalizedUpload {
  filename: string;
  relativePath: string;
  url: string;
  originalName: string;
  mimetype: string;
  size: number;
}

const FILE_RULES: FileRule[] = [
  {
    extensions: ['.jpg', '.jpeg'],
    mimeTypes: ['image/jpeg', 'image/jpg'],
    signature: 'jpeg',
    allowedFor: ['profile', 'post', 'message'],
  },
  {
    extensions: ['.png'],
    mimeTypes: ['image/png'],
    signature: 'png',
    allowedFor: ['profile', 'post', 'message'],
  },
  {
    extensions: ['.webp'],
    mimeTypes: ['image/webp'],
    signature: 'webp',
    allowedFor: ['profile', 'post', 'message'],
  },
  {
    extensions: ['.gif'],
    mimeTypes: ['image/gif'],
    signature: 'gif',
    allowedFor: ['profile', 'post', 'message'],
  },
  {
    extensions: ['.mp4'],
    mimeTypes: ['video/mp4'],
    signature: 'mp4qt',
    allowedFor: ['post', 'message'],
  },
  {
    extensions: ['.mov'],
    mimeTypes: ['video/quicktime'],
    signature: 'mp4qt',
    allowedFor: ['post', 'message'],
  },
  {
    extensions: ['.webm'],
    mimeTypes: ['video/webm'],
    signature: 'ebml',
    allowedFor: ['post', 'message'],
  },
  {
    extensions: ['.mkv'],
    mimeTypes: ['video/x-matroska'],
    signature: 'ebml',
    allowedFor: ['post', 'message'],
  },
  {
    extensions: ['.pdf'],
    mimeTypes: ['application/pdf'],
    signature: 'pdf',
    allowedFor: ['post', 'message'],
  },
  {
    extensions: ['.doc'],
    mimeTypes: ['application/msword'],
    signature: 'ole',
    allowedFor: ['post', 'message'],
  },
  {
    extensions: ['.docx'],
    mimeTypes: [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    signature: 'zip',
    allowedFor: ['post', 'message'],
  },
  {
    extensions: ['.ppt'],
    mimeTypes: ['application/vnd.ms-powerpoint'],
    signature: 'ole',
    allowedFor: ['post', 'message'],
  },
  {
    extensions: ['.pptx'],
    mimeTypes: [
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ],
    signature: 'zip',
    allowedFor: ['post', 'message'],
  },
  {
    extensions: ['.xls'],
    mimeTypes: ['application/vnd.ms-excel'],
    signature: 'ole',
    allowedFor: ['message'],
  },
  {
    extensions: ['.xlsx'],
    mimeTypes: [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
    signature: 'zip',
    allowedFor: ['message'],
  },
  {
    extensions: ['.txt'],
    mimeTypes: ['text/plain'],
    signature: 'text',
    allowedFor: ['message'],
  },
];

@Injectable()
export class UploadService {
  private readonly uploadsRoot = resolveUploadsRoot();

  constructor(private readonly configService: ConfigService) {}

  async finalizeUploadedFile(
    file: UploadedFileLike,
    folder: 'profile' | 'post' | 'message',
    kind: UploadKind,
  ): Promise<FinalizedUpload> {
    if (!file?.path) {
      throw new BadRequestException('Invalid uploaded file');
    }

    try {
      const normalizedMime = (file.mimetype || '').toLowerCase();
      const originalExtension = extname(file.originalname || '').toLowerCase();

      const matchedRule = FILE_RULES.find(
        (rule) =>
          rule.allowedFor.includes(kind) &&
          rule.extensions.includes(originalExtension) &&
          rule.mimeTypes.includes(normalizedMime),
      );

      if (!matchedRule) {
        throw new BadRequestException('Unsupported or mismatched file type.');
      }

      const sample = await this.readFileSample(file.path, 560);
      if (!this.matchesSignature(sample, matchedRule.signature)) {
        throw new BadRequestException(
          'File content does not match extension/type.',
        );
      }

      const baseName = `${Date.now()}-${randomUUID().replace(/-/g, '')}`;
      const isImage = IMAGE_SIGNATURES.includes(matchedRule.signature);
      // On convertit toutes les images (sauf le WebP deja optimise) en WebP :
      // gain d'espace + chargement plus rapide. Videos/documents inchanges.
      const convertToWebp = isImage && matchedRule.signature !== 'webp';

      let finalFilename: string;
      let finalDiskPath: string;
      let outputMime = normalizedMime;
      let outputSize = file.size;

      if (convertToWebp) {
        finalFilename = `${baseName}.webp`;
        finalDiskPath = join(this.uploadsRoot, folder, finalFilename);
        await sharp(file.path, { animated: matchedRule.signature === 'gif' })
          .rotate()
          .resize({
            width: WEBP_MAX_DIMENSION,
            height: WEBP_MAX_DIMENSION,
            fit: 'inside',
            withoutEnlargement: true,
          })
          .webp({ quality: WEBP_QUALITY })
          .toFile(finalDiskPath);
        await this.removeIfExists(file.path);
        outputMime = 'image/webp';
        outputSize = (await fs.stat(finalDiskPath)).size;
      } else {
        finalFilename = `${baseName}${originalExtension}`;
        finalDiskPath = join(this.uploadsRoot, folder, finalFilename);
        await fs.rename(file.path, finalDiskPath);
      }

      const relativePath = `/uploads/${folder}/${finalFilename}`;

      return {
        filename: finalFilename,
        relativePath,
        url: this.buildFileUrl(relativePath),
        originalName: file.originalname,
        mimetype: outputMime,
        size: outputSize,
      };
    } catch (error) {
      await this.removeIfExists(file.path);
      throw error;
    }
  }

  buildFileUrl(path: string): string {
    const baseUrl = this.resolvePublicBaseUrl();
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${baseUrl}${normalizedPath}`;
  }

  private resolvePublicBaseUrl(): string {
    const configuredPublicBaseUrl = (
      this.configService.get<string>('PUBLIC_BASE_URL') || ''
    ).trim();

    if (configuredPublicBaseUrl) {
      return configuredPublicBaseUrl.replace(/\/+$/, '');
    }

    const firstCorsOrigin = (
      this.configService.get<string>('CORS_ORIGIN') || ''
    )
      .split(',')
      .map((origin) => origin.trim())
      .find((origin) => origin.length > 0);

    if (firstCorsOrigin) {
      return firstCorsOrigin.replace(/\/+$/, '');
    }

    const port = this.configService.get<number>('PORT') || 3000;
    return `http://localhost:${port}`;
  }

  private async readFileSample(
    path: string,
    maxBytes: number,
  ): Promise<Buffer> {
    const handle = await fs.open(path, 'r');

    try {
      const buffer = Buffer.allocUnsafe(maxBytes);
      const { bytesRead } = await handle.read(buffer, 0, maxBytes, 0);
      return buffer.subarray(0, bytesRead);
    } finally {
      await handle.close();
    }
  }

  private matchesSignature(
    buffer: Buffer,
    signature: FileRule['signature'],
  ): boolean {
    if (buffer.length === 0) {
      return false;
    }

    switch (signature) {
      case 'jpeg':
        return this.startsWith(buffer, [0xff, 0xd8, 0xff]);
      case 'png':
        return this.startsWith(
          buffer,
          [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
        );
      case 'webp':
        return (
          buffer.length >= 12 &&
          buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
          buffer.subarray(8, 12).toString('ascii') === 'WEBP'
        );
      case 'gif':
        return (
          buffer.length >= 6 &&
          (buffer.subarray(0, 6).toString('ascii') === 'GIF87a' ||
            buffer.subarray(0, 6).toString('ascii') === 'GIF89a')
        );
      case 'pdf':
        return (
          buffer.length >= 5 &&
          buffer.subarray(0, 5).toString('ascii') === '%PDF-'
        );
      case 'zip':
        return (
          this.startsWith(buffer, [0x50, 0x4b, 0x03, 0x04]) ||
          this.startsWith(buffer, [0x50, 0x4b, 0x05, 0x06]) ||
          this.startsWith(buffer, [0x50, 0x4b, 0x07, 0x08])
        );
      case 'ole':
        return this.startsWith(
          buffer,
          [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1],
        );
      case 'mp4qt':
        return (
          buffer.length >= 12 &&
          buffer.subarray(4, 8).toString('ascii') === 'ftyp'
        );
      case 'ebml':
        return this.startsWith(buffer, [0x1a, 0x45, 0xdf, 0xa3]);
      case 'text':
        return !buffer.includes(0x00);
      default:
        return false;
    }
  }

  private startsWith(buffer: Buffer, bytes: number[]): boolean {
    if (buffer.length < bytes.length) {
      return false;
    }

    for (let i = 0; i < bytes.length; i += 1) {
      if (buffer[i] !== bytes[i]) {
        return false;
      }
    }

    return true;
  }

  private async removeIfExists(path?: string): Promise<void> {
    if (!path) {
      return;
    }

    try {
      await fs.unlink(path);
    } catch {
      // Ignore cleanup errors.
    }
  }
}
