import {
  BadRequestException,
  Controller,
  Get,
  HttpException,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { MediaService } from './media.service';

@ApiTags('Media')
@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @ApiOperation({
    summary: 'Miniature WebP générée à la volée',
    description: 'Renvoie une image (binaire) redimensionnée et mise en cache.',
  })
  @ApiQuery({
    name: 'path',
    description: "Chemin /uploads/... de l'image source",
  })
  @ApiQuery({
    name: 'w',
    required: false,
    description: 'Largeur cible en pixels (ex. 1000)',
  })
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
      const resolved = await this.mediaService.getThumbnail(
        path,
        Number(width),
      );
      this.sendFile(res, resolved.filePath, resolved.contentType);
    } catch (error) {
      this.sendError(res, error);
    }
  }

  @ApiOperation({
    summary: "Poster (vignette) d'une vidéo",
    description:
      'Renvoie une image (binaire) extraite de la vidéo et mise en cache.',
  })
  @ApiQuery({
    name: 'path',
    description: 'Chemin /uploads/... de la vidéo source',
  })
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

  @ApiOperation({
    summary: 'Image JPEG pour aperçu de partage social',
    description:
      'Convertit une image (souvent WebP) en JPEG carré — compatible avec les robots WhatsApp/Facebook/LinkedIn.',
  })
  @ApiQuery({
    name: 'path',
    description: "Chemin /uploads/... de l'image source",
  })
  @Get('social')
  async getSocialImage(
    @Query('path') path: string,
    @Res() res: Response,
  ): Promise<void> {
    try {
      if (!path) {
        throw new BadRequestException('Missing path');
      }
      const resolved = await this.mediaService.getSocialImage(path);
      this.sendFile(res, resolved.filePath, resolved.contentType);
    } catch (error) {
      this.sendError(res, error);
    }
  }

  private sendFile(res: Response, filePath: string, contentType: string): void {
    res.sendFile(
      filePath,
      {
        // Le cache est dans `.media-cache` (dossier commencant par un point) :
        // sans cette option, Express/`send` renvoie 404 sur les "dotfiles".
        dotfiles: 'allow',
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
