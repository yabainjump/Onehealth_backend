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
import { diskStorage } from 'multer';
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
import type { RequestWithUser } from '../users/interfaces/request-with-user.interface';

const FILE_UPLOAD_BODY: ApiBodyOptions = {
  schema: {
    type: 'object',
    required: ['file'],
    properties: { file: { type: 'string', format: 'binary' } },
  },
};

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

const certificationAttachmentMimeTypes = new Set([
  ...imageMimeTypes,
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

function ensureDir(dir: string) {
  mkdirSync(dir, { recursive: true });
  return dir;
}

function storageFor(folder: string) {
  return diskStorage({
    destination: (request, file, callback) => {
      void request;
      void file;
      callback(null, ensureDir(join(resolveUploadsRoot(), folder)));
    },
    filename: (request, file, callback) => {
      void request;
      void file;
      callback(
        null,
        `${Date.now()}-${randomUUID().replace(/-/g, '')}.uploadtmp`,
      );
    },
  });
}

function imageFileFilter(
  _req: Request,
  file: Express.Multer.File,
  cb: (error: Error | null, acceptFile: boolean) => void,
) {
  void _req;
  if (!imageMimeTypes.has((file.mimetype || '').toLowerCase())) {
    cb(new BadRequestException('Only image files are allowed'), false);
    return;
  }
  cb(null, true);
}

function messageFileFilter(
  _req: Request,
  file: Express.Multer.File,
  cb: (error: Error | null, acceptFile: boolean) => void,
) {
  void _req;
  if (!messageAttachmentMimeTypes.has((file.mimetype || '').toLowerCase())) {
    cb(
      new BadRequestException(
        'Unsupported file type. Allowed: images, pdf, doc, docx, ppt, pptx, xls, xlsx, txt.',
      ),
      false,
    );
    return;
  }
  cb(null, true);
}

function postFileFilter(
  _req: Request,
  file: Express.Multer.File,
  cb: (error: Error | null, acceptFile: boolean) => void,
) {
  void _req;
  if (!postAttachmentMimeTypes.has((file.mimetype || '').toLowerCase())) {
    cb(
      new BadRequestException(
        'Unsupported file type. Allowed: images, videos, pdf, doc, docx, ppt, pptx.',
      ),
      false,
    );
    return;
  }
  cb(null, true);
}

function certificationFileFilter(
  _req: Request,
  file: Express.Multer.File,
  cb: (error: Error | null, acceptFile: boolean) => void,
) {
  void _req;
  if (
    !certificationAttachmentMimeTypes.has((file.mimetype || '').toLowerCase())
  ) {
    cb(
      new BadRequestException(
        'Unsupported certification document. Allowed: images, pdf, doc, docx.',
      ),
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
    description:
      'Images uniquement (JPG, PNG, WebP, GIF). 10 Mo max. Converties en WebP.',
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
  async uploadProfile(@UploadedFile() file?: Express.Multer.File) {
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
  async uploadPost(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const uploaded = await this.uploadService.finalizeUploadedFile(
      file,
      'post',
      'post',
    );

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
    description:
      'Images, vidéos ou documents (PDF, DOC, PPT, XLS, TXT…). 50 Mo max.',
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
  async uploadMessage(
    @Req() req: RequestWithUser,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const uploaded = await this.uploadService.finalizeUploadedFile(
      file,
      'message',
      'message',
      req.user.id,
    );

    return {
      url: uploaded.url,
      filename: uploaded.filename,
      originalName: uploaded.originalName,
      mimetype: uploaded.mimetype,
      size: uploaded.size,
    };
  }

  @ApiOperation({
    summary: 'Téléverser un justificatif privé de certification',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody(FILE_UPLOAD_BODY)
  @Post('certification')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: storageFor('certification'),
      fileFilter: certificationFileFilter,
      limits: { fileSize: 50 * 1024 * 1024 },
    }),
  )
  async uploadCertification(
    @Req() req: RequestWithUser,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('File is required');
    const uploaded = await this.uploadService.finalizeUploadedFile(
      file,
      'certification',
      'certification',
      req.user.id,
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
