import { Controller, Get, Param, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  buildShareHtml,
  isLikelyCrawler,
  SharePageMetadata,
} from './share-metadata.util';
import { ShareService } from './share.service';

@Controller('share')
export class ShareController {
  constructor(private readonly shareService: ShareService) {}

  @Get()
  getSiteShare(@Req() req: Request, @Res() res: Response): void {
    const metadata = this.shareService.getSiteShareMetadata();
    this.replyWithShareHtml(req, res, metadata);
  }

  @Get('post/:postId')
  async getPostShare(
    @Req() req: Request,
    @Res() res: Response,
    @Param('postId') postId: string,
  ): Promise<void> {
    const metadata = await this.shareService.getPostShareMetadata(postId);
    this.replyWithShareHtml(req, res, metadata);
  }

  @Get('profile/:userId')
  async getProfileShare(
    @Req() req: Request,
    @Res() res: Response,
    @Param('userId') userId: string,
  ): Promise<void> {
    const metadata = await this.shareService.getProfileShareMetadata(userId);
    this.replyWithShareHtml(req, res, metadata);
  }

  private replyWithShareHtml(
    req: Request,
    res: Response,
    metadata: SharePageMetadata,
  ): void {
    const userAgent = `${req.headers['user-agent'] || ''}`.trim();
    const shouldAutoRedirect = !isLikelyCrawler(userAgent);
    const html = buildShareHtml({
      ...metadata,
      shouldAutoRedirect,
    });

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');
    res.status(200).send(html);
  }
}
