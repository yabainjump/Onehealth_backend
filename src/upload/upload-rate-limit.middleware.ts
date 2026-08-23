import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { CoordinationUnavailableError } from '../coordination/coordination.errors';
import { DistributedRateLimitService } from '../coordination/distributed-rate-limit.service';

const WINDOW_MS = 15 * 60 * 1000;
const MAX_UPLOADS_PER_WINDOW = 30;

@Injectable()
export class UploadRateLimitMiddleware implements NestMiddleware {
  constructor(
    private readonly distributedRateLimit: DistributedRateLimitService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rateLimit = await this.distributedRateLimit.consume({
        policy: 'upload',
        subject: req.ip || req.socket.remoteAddress || 'unknown',
        limit: MAX_UPLOADS_PER_WINDOW,
        windowMs: WINDOW_MS,
      });

      if (!rateLimit.allowed) {
        res.setHeader('Retry-After', `${rateLimit.retryAfterSeconds}`);
        res.status(429).json({
          statusCode: 429,
          message: 'Too many uploads. Please try again later.',
        });
        return;
      }

      next();
    } catch (error: unknown) {
      if (error instanceof CoordinationUnavailableError) {
        res.status(503).json({
          statusCode: 503,
          message: 'Security controls temporarily unavailable.',
        });
        return;
      }
      next(error);
    }
  }
}
