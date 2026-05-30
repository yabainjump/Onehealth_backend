import {
  BadRequestException,
  Controller,
  Get,
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
    if (!path) {
      throw new BadRequestException('Missing path');
    }

    const resolved = await this.mediaService.getThumbnail(path, Number(width));
    this.sendFile(res, resolved.filePath, resolved.contentType);
  }

  @Get('poster')
  async getPoster(
    @Query('path') path: string,
    @Res() res: Response,
  ): Promise<void> {
    if (!path) {
      throw new BadRequestException('Missing path');
    }

    const resolved = await this.mediaService.getPoster(path);
    this.sendFile(res, resolved.filePath, resolved.contentType);
  }

  private sendFile(res: Response, filePath: string, contentType: string): void {
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.sendFile(filePath);
  }
}
