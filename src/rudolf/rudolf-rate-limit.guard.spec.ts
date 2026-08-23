import {
  ExecutionContext,
  HttpException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { CoordinationUnavailableError } from '../coordination/coordination.errors';
import {
  DistributedRateLimitService,
  RateLimitDecision,
} from '../coordination/distributed-rate-limit.service';
import type { RequestWithUser } from '../users/interfaces/request-with-user.interface';
import { RudolfRateLimitGuard } from './rudolf-rate-limit.guard';

const allowed = (limit: number, remaining: number): RateLimitDecision => ({
  allowed: true,
  count: limit - remaining,
  limit,
  remaining,
  resetAt: new Date(Date.now() + 60_000),
  retryAfterSeconds: 60,
});

const blocked = (
  limit: number,
  retryAfterSeconds: number,
): RateLimitDecision => ({
  allowed: false,
  count: limit + 1,
  limit,
  remaining: 0,
  resetAt: new Date(Date.now() + retryAfterSeconds * 1_000),
  retryAfterSeconds,
});

const createContext = (userId?: string) => {
  const setHeader = jest.fn();
  const request = {
    user: userId ? { id: userId } : undefined,
  } as RequestWithUser;
  const response = { setHeader } as unknown as Response;
  const context = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as ExecutionContext;
  return { context, setHeader };
};

describe('RudolfRateLimitGuard', () => {
  const config = new ConfigService({
    RUDOLF_RATE_LIMIT_PER_10_MIN: 12,
    RUDOLF_DAILY_LIMIT: 100,
  });

  it('consumes shared daily and short windows and exposes short headers', async () => {
    const consume = jest
      .fn()
      .mockResolvedValueOnce(allowed(100, 99))
      .mockResolvedValueOnce(allowed(12, 11));
    const limiter = { consume } as unknown as DistributedRateLimitService;
    const guard = new RudolfRateLimitGuard(config, limiter);
    const { context, setHeader } = createContext('user-1');

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(consume).toHaveBeenNthCalledWith(1, {
      policy: 'rudolf-daily',
      subject: 'user-1',
      limit: 100,
      windowMs: 24 * 60 * 60 * 1_000,
    });
    expect(consume).toHaveBeenNthCalledWith(2, {
      policy: 'rudolf-short',
      subject: 'user-1',
      limit: 12,
      windowMs: 10 * 60 * 1_000,
    });
    expect(setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', '12');
    expect(setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', '11');
  });

  it('blocks on the daily shared window before consuming the short window', async () => {
    const consume = jest.fn().mockResolvedValue(blocked(100, 3_600));
    const limiter = { consume } as unknown as DistributedRateLimitService;
    const guard = new RudolfRateLimitGuard(config, limiter);
    const { context, setHeader } = createContext('user-2');

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      status: 429,
    } satisfies Partial<HttpException>);
    expect(consume).toHaveBeenCalledTimes(1);
    expect(setHeader).toHaveBeenCalledWith('Retry-After', '3600');
  });

  it('blocks on the short shared window with its own Retry-After', async () => {
    const limiter = {
      consume: jest
        .fn()
        .mockResolvedValueOnce(allowed(100, 50))
        .mockResolvedValueOnce(blocked(12, 300)),
    } as unknown as DistributedRateLimitService;
    const guard = new RudolfRateLimitGuard(config, limiter);
    const { context, setHeader } = createContext('user-3');

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      status: 429,
    } satisfies Partial<HttpException>);
    expect(setHeader).toHaveBeenCalledWith('Retry-After', '300');
  });

  it('fails closed when shared quota storage is unavailable', async () => {
    const limiter = {
      consume: jest.fn().mockRejectedValue(new CoordinationUnavailableError()),
    } as unknown as DistributedRateLimitService;
    const guard = new RudolfRateLimitGuard(config, limiter);

    await expect(
      guard.canActivate(createContext('user-4').context),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('rejects a missing authenticated user before quota storage', async () => {
    const consume = jest.fn();
    const limiter = { consume } as unknown as DistributedRateLimitService;
    const guard = new RudolfRateLimitGuard(config, limiter);

    await expect(
      guard.canActivate(createContext().context),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(consume).not.toHaveBeenCalled();
  });
});
