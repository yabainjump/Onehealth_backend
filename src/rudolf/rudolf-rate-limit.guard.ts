import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import type { RequestWithUser } from '../users/interfaces/request-with-user.interface';
import { CoordinationUnavailableError } from '../coordination/coordination.errors';
import { DistributedRateLimitService } from '../coordination/distributed-rate-limit.service';

const SHORT_WINDOW_MS = 10 * 60 * 1000;
const DAILY_WINDOW_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class RudolfRateLimitGuard implements CanActivate {
  private readonly shortLimit: number;
  private readonly dailyLimit: number;

  constructor(
    configService: ConfigService,
    private readonly distributedRateLimit: DistributedRateLimitService,
  ) {
    this.shortLimit =
      configService.get<number>('RUDOLF_RATE_LIMIT_PER_10_MIN') ?? 12;
    this.dailyLimit = configService.get<number>('RUDOLF_DAILY_LIMIT') ?? 100;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const response = context.switchToHttp().getResponse<Response>();
    const userId = request.user?.id;
    if (!userId) {
      throw new UnauthorizedException();
    }

    try {
      const daily = await this.distributedRateLimit.consume({
        policy: 'rudolf-daily',
        subject: userId,
        limit: this.dailyLimit,
        windowMs: DAILY_WINDOW_MS,
      });
      if (!daily.allowed) {
        this.throwRateLimit(response, daily.retryAfterSeconds);
      }

      const short = await this.distributedRateLimit.consume({
        policy: 'rudolf-short',
        subject: userId,
        limit: this.shortLimit,
        windowMs: SHORT_WINDOW_MS,
      });
      if (!short.allowed) {
        this.throwRateLimit(response, short.retryAfterSeconds);
      }

      response.setHeader('X-RateLimit-Limit', `${short.limit}`);
      response.setHeader('X-RateLimit-Remaining', `${short.remaining}`);
      return true;
    } catch (error: unknown) {
      if (error instanceof CoordinationUnavailableError) {
        throw new ServiceUnavailableException(
          'Rudolf request controls temporarily unavailable.',
        );
      }
      throw error;
    }
  }

  private throwRateLimit(response: Response, retryAfterSeconds: number): never {
    response.setHeader('Retry-After', `${retryAfterSeconds}`);
    throw new HttpException(
      'Rudolf request limit reached. Please try again later.',
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
