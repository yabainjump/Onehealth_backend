import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

interface UploadBucket {
  attempts: number;
  resetAt: number;
}

const WINDOW_MS = 15 * 60 * 1000;
const MAX_UPLOADS_PER_WINDOW = 30;
const MAX_BUCKETS = 10_000;

@Injectable()
export class UploadRateLimitMiddleware implements NestMiddleware {
  private readonly buckets = new Map<string, UploadBucket>();

  use(req: Request, res: Response, next: NextFunction): void {
    const now = Date.now();
    const key = req.ip || 'unknown';
    const bucket = this.buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      this.ensureCapacity(now);
      this.buckets.set(key, { attempts: 1, resetAt: now + WINDOW_MS });
      next();
      return;
    }

    if (bucket.attempts >= MAX_UPLOADS_PER_WINDOW) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.setHeader('Retry-After', `${retryAfter}`);
      res.status(429).json({
        statusCode: 429,
        message: 'Too many uploads. Please try again later.',
      });
      return;
    }

    bucket.attempts += 1;
    next();
  }

  private ensureCapacity(now: number): void {
    for (const [key, bucket] of this.buckets.entries()) {
      if (bucket.resetAt <= now) {
        this.buckets.delete(key);
      }
    }

    while (this.buckets.size >= MAX_BUCKETS) {
      const oldestKey = this.buckets.keys().next().value as string | undefined;
      if (!oldestKey) {
        break;
      }
      this.buckets.delete(oldestKey);
    }
  }
}
