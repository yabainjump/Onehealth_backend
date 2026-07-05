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
import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import { join } from 'path';
import type { Request } from 'express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiBodyOptions,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { resolveUploadsRoot } from '../config/uploads-path';
import { UploadService } from './upload.service';

const FILE_UPLOAD_BODY: ApiBodyOptions = {
  schema: {
    type: 'object',
    required: ['file'],
    properties: { file: { type: 'string', format: 'binary' } },
  },
};

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
      cb(null, ensureDir(join(resolveUploadsRoot(), folder)));
    },
    filename: (_req: any, _file: any, cb: any) => {
      cb(null, `${Date.now()}-${randomUUID().replace(/-/g, '')}.uploadtmp`);
    },
  });
}

function imageFileFilter(
  _req: Request,
  file: any,
  cb: (error: Error | null, acceptFile: boolean) => void,
) {
  if (!imageMimeTypes.has((file.mimetype || '').toLowerCase())) {
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
  if (!messageAttachmentMimeTypes.has((file.mimetype || '').toLowerCase())) {
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
  if (!postAttachmentMimeTypes.has((file.mimetype || '').toLowerCase())) {
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

@ApiTags('Upload')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @ApiOperation({
    summary: 'Téléverser une photo de profil',
    description: 'Images uniquement (JPG, PNG, WebP, GIF). 10 Mo max. Converties en WebP.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody(FILE_UPLOAD_BODY)
  @Post('profile')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: storageFor('profile'),
      fileFilter: imageFileFilter,
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async uploadProfile(@UploadedFile() file: any, @Req() _req: Request) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const uploaded = await this.uploadService.finalizeUploadedFile(
      file,
      'profile',
      'profile',
    );

    return {
      url: uploaded.url,
      filename: uploaded.filename,
    };
  }

  @ApiOperation({
    summary: 'Téléverser un média de publication',
    description: 'Images, vidéos ou documents (PDF, DOC, PPT…). 50 Mo max.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody(FILE_UPLOAD_BODY)
  @Post('post')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: storageFor('post'),
      fileFilter: postFileFilter,
      limits: { fileSize: 50 * 1024 * 1024 },
    }),
  )
  async uploadPost(@UploadedFile() file: any, @Req() _req: Request) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const uploaded = await this.uploadService.finalizeUploadedFile(file, 'post', 'post');

    return {
      url: uploaded.url,
      filename: uploaded.filename,
      originalName: uploaded.originalName,
      mimetype: uploaded.mimetype,
      size: uploaded.size,
    };
  }

  @ApiOperation({
    summary: 'Téléverser un fichier de message',
    description: 'Images, vidéos ou documents (PDF, DOC, PPT, XLS, TXT…). 50 Mo max.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody(FILE_UPLOAD_BODY)
  @Post('message')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: storageFor('message'),
      fileFilter: messageFileFilter,
      limits: { fileSize: 50 * 1024 * 1024 },
    }),
  )
  async uploadMessage(@UploadedFile() file: any, @Req() _req: Request) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const uploaded = await this.uploadService.finalizeUploadedFile(
      file,
      'message',
      'message',
    );

    return {
      url: uploaded.url,
      filename: uploaded.filename,
      originalName: uploaded.originalName,
      mimetype: uploaded.mimetype,
      size: uploaded.size,
    };
  }
}
