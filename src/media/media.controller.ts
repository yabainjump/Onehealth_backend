import {
  BadRequestException,
  Controller,
  Get,
  HttpException,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { MediaService } from './media.service';

@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Get('thumb')
  async getThumbnail(
    @Query('path') path: string,
    @Query('w') width: string,
    @Res() res: Response,
  ): Promise<void> {
    try {
      if (!path) {
        throw new BadRequestException('Missing path');
      }
      const resolved = await this.mediaService.getThumbnail(path, Number(width));
      this.sendFile(res, resolved.filePath, resolved.contentType);
    } catch (error) {
      this.sendError(res, error);
    }
  }

  @Get('poster')
  async getPoster(
    @Query('path') path: string,
    @Res() res: Response,
  ): Promise<void> {
    try {
      if (!path) {
        throw new BadRequestException('Missing path');
      }
      const resolved = await this.mediaService.getPoster(path);
      this.sendFile(res, resolved.filePath, resolved.contentType);
    } catch (error) {
      this.sendError(res, error);
    }
  }

  private sendFile(res: Response, filePath: string, contentType: string): void {
    res.sendFile(
      filePath,
      {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=2592000, immutable',
          'X-Content-Type-Options': 'nosniff',
        },
      },
      (error) => {
        if (error && !res.headersSent) {
          this.sendError(res, error);
        }
      },
    );
  }

  // Les erreurs ne doivent JAMAIS etre mises en cache (sinon un 404 transitoire
  // reste fige cote proxy/CDN). On force donc no-store.
  private sendError(res: Response, error: unknown): void {
    if (res.headersSent) {
      return;
    }
    const status = error instanceof HttpException ? error.getStatus() : 404;
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.status(status).json({ statusCode: status, message: 'Media not found' });
  }
}
