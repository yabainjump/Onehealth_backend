import {
  BadRequestException,
  Controller,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { extname, join } from 'path';
import { mkdirSync } from 'fs';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UploadService } from './upload.service';

const multer = require('multer');
const diskStorage = multer.diskStorage;

const imageMimeTypes = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const messageAttachmentMimeTypes = new Set([
  ...imageMimeTypes,
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-matroska',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
]);

const postAttachmentMimeTypes = new Set([
  ...imageMimeTypes,
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-matroska',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);

function ensureDir(dir: string) {
  mkdirSync(dir, { recursive: true });
  return dir;
}

function storageFor(folder: string) {
  return diskStorage({
    destination: (_req: any, _file: any, cb: any) => {
      cb(null, ensureDir(join(process.cwd(), 'uploads', folder)));
    },
    filename: (_req: any, file: any, cb: any) => {
      const extension = extname(file.originalname || '').toLowerCase();
      const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`;
      cb(null, filename);
    },
  });
}

function imageFileFilter(
  _req: Request,
  file: any,
  cb: (error: Error | null, acceptFile: boolean) => void,
) {
  if (!imageMimeTypes.has(file.mimetype)) {
    cb(new BadRequestException('Only image files are allowed') as unknown as Error, false);
    return;
  }
  cb(null, true);
}

function messageFileFilter(
  _req: Request,
  file: any,
  cb: (error: Error | null, acceptFile: boolean) => void,
) {
  if (!messageAttachmentMimeTypes.has(file.mimetype)) {
    cb(
      new BadRequestException(
        'Unsupported file type. Allowed: images, pdf, doc, docx, ppt, pptx, xls, xlsx, txt.',
      ) as unknown as Error,
      false,
    );
    return;
  }
  cb(null, true);
}

function postFileFilter(
  _req: Request,
  file: any,
  cb: (error: Error | null, acceptFile: boolean) => void,
) {
  if (!postAttachmentMimeTypes.has(file.mimetype)) {
    cb(
      new BadRequestException(
        'Unsupported file type. Allowed: images, videos, pdf, doc, docx, ppt, pptx.',
      ) as unknown as Error,
      false,
    );
    return;
  }
  cb(null, true);
}

@UseGuards(JwtAuthGuard)
@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('profile')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: storageFor('profile'),
      fileFilter: imageFileFilter,
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  uploadProfile(@UploadedFile() file: any, @Req() req: Request) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const relativePath = `/uploads/profile/${file.filename}`;
    return {
      url: this.uploadService.buildFileUrl(req as any, relativePath),
      filename: file.filename,
    };
  }

  @Post('post')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: storageFor('post'),
      fileFilter: postFileFilter,
      limits: { fileSize: 50 * 1024 * 1024 },
    }),
  )
  uploadPost(@UploadedFile() file: any, @Req() req: Request) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const relativePath = `/uploads/post/${file.filename}`;
    return {
      url: this.uploadService.buildFileUrl(req as any, relativePath),
      filename: file.filename,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    };
  }

  @Post('message')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: storageFor('message'),
      fileFilter: messageFileFilter,
      limits: { fileSize: 50 * 1024 * 1024 },
    }),
  )
  uploadMessage(@UploadedFile() file: any, @Req() req: Request) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const relativePath = `/uploads/message/${file.filename}`;
    return {
      url: this.uploadService.buildFileUrl(req as any, relativePath),
      filename: file.filename,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    };
  }
}
