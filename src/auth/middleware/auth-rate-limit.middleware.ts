import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

interface AttemptBucket {
  attempts: number;
  resetAt: number;
}

const WINDOW_MS = 15 * 60 * 1000;
const ROUTE_LIMITS: Record<string, number> = {
  '/auth/login': 10,
  '/auth/register': 5,
  '/auth/forgot-password': 5,
  '/auth/reset-password': 10,
};

@Injectable()
export class AuthRateLimitMiddleware implements NestMiddleware {
  private readonly buckets = new Map<string, AttemptBucket>();

  use(req: Request, res: Response, next: NextFunction): void {
    const routeKey = this.resolveRouteKey(req);
    const maxAttempts = ROUTE_LIMITS[routeKey];

    if (!maxAttempts) {
      next();
      return;
    }

    const clientId = this.resolveClientId(req);
    const bucketKey = `${routeKey}:${clientId}`;
    const now = Date.now();

    const bucket = this.buckets.get(bucketKey);
    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(bucketKey, {
        attempts: 1,
        resetAt: now + WINDOW_MS,
      });
      next();
      return;
    }

    if (bucket.attempts >= maxAttempts) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((bucket.resetAt - now) / 1000),
      );

      res.setHeader('Retry-After', `${retryAfterSeconds}`);
      res.status(429).json({
        statusCode: 429,
        message: 'Too many attempts. Please try again later.',
      });
      return;
    }

    bucket.attempts += 1;

    if (Math.random() < 0.01) {
      this.cleanupExpiredBuckets(now);
    }

    next();
  }

  private resolveRouteKey(request: Request): string {
    const url = request.originalUrl || request.url || '';
    const [pathWithoutQuery] = url.split('?');
    return pathWithoutQuery.replace(/^\/api/, '');
  }

  private resolveClientId(request: Request): string {
    // `req.ip` est resolu par Express via le proxy de confiance
    // (`trust proxy: 1` configure dans main.ts) : c'est la vraie IP client,
    // NON usurpable via un header `X-Forwarded-For` falsifie (contrairement a
    // un parsing manuel de l'en-tete, qui prend la valeur la plus a gauche
    // controlee par le client).
    return request.ip || 'unknown';
  }

  private cleanupExpiredBuckets(now: number): void {
    for (const [key, bucket] of this.buckets.entries()) {
      if (bucket.resetAt <= now) {
        this.buckets.delete(key);
      }
    }
  }
}
