import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import type { RequestWithUser } from '../users/interfaces/request-with-user.interface';

type RateBucket = {
  shortCount: number;
  shortResetAt: number;
  dailyCount: number;
  dailyResetAt: number;
};

const SHORT_WINDOW_MS = 10 * 60 * 1000;
const DAILY_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_BUCKETS = 10_000;

@Injectable()
export class RudolfRateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, RateBucket>();
  private readonly shortLimit: number;
  private readonly dailyLimit: number;

  constructor(configService: ConfigService) {
    this.shortLimit =
      configService.get<number>('RUDOLF_RATE_LIMIT_PER_10_MIN') ?? 12;
    this.dailyLimit = configService.get<number>('RUDOLF_DAILY_LIMIT') ?? 100;
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const response = context.switchToHttp().getResponse<Response>();
    const userId = request.user?.id;
    if (!userId) {
      throw new UnauthorizedException();
    }

    const now = Date.now();
    let bucket = this.buckets.get(userId);
    if (!bucket) {
      this.ensureCapacity(now);
      bucket = {
        shortCount: 0,
        shortResetAt: now + SHORT_WINDOW_MS,
        dailyCount: 0,
        dailyResetAt: now + DAILY_WINDOW_MS,
      };
      this.buckets.set(userId, bucket);
    }

    if (bucket.shortResetAt <= now) {
      bucket.shortCount = 0;
      bucket.shortResetAt = now + SHORT_WINDOW_MS;
    }
    if (bucket.dailyResetAt <= now) {
      bucket.dailyCount = 0;
      bucket.dailyResetAt = now + DAILY_WINDOW_MS;
    }

    const shortBlocked = bucket.shortCount >= this.shortLimit;
    const dailyBlocked = bucket.dailyCount >= this.dailyLimit;
    if (shortBlocked || dailyBlocked) {
      const resetAt = dailyBlocked ? bucket.dailyResetAt : bucket.shortResetAt;
      response.setHeader(
        'Retry-After',
        `${Math.max(1, Math.ceil((resetAt - now) / 1000))}`,
      );
      throw new HttpException(
        'Rudolf request limit reached. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    bucket.shortCount += 1;
    bucket.dailyCount += 1;
    response.setHeader('X-RateLimit-Limit', `${this.shortLimit}`);
    response.setHeader(
      'X-RateLimit-Remaining',
      `${Math.max(0, this.shortLimit - bucket.shortCount)}`,
    );
    return true;
  }

  private ensureCapacity(now: number): void {
    for (const [key, bucket] of this.buckets) {
      if (bucket.dailyResetAt <= now) {
        this.buckets.delete(key);
      }
    }
    while (this.buckets.size >= MAX_BUCKETS) {
      const oldest = this.buckets.keys().next().value as string | undefined;
      if (!oldest) break;
      this.buckets.delete(oldest);
    }
  }
}
