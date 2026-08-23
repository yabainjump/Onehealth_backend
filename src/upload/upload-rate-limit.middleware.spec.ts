import type { NextFunction, Request, Response } from 'express';
import { CoordinationUnavailableError } from '../coordination/coordination.errors';
import {
  ConsumeRateLimitInput,
  DistributedRateLimitService,
  RateLimitDecision,
} from '../coordination/distributed-rate-limit.service';
import { UploadRateLimitMiddleware } from './upload-rate-limit.middleware';

const decision = (
  count: number,
  limit: number,
  allowed = count <= limit,
): RateLimitDecision => ({
  allowed,
  count,
  limit,
  remaining: Math.max(0, limit - count),
  resetAt: new Date(Date.now() + 60_000),
  retryAfterSeconds: 60,
});

const createResponse = () => {
  const setHeader = jest.fn();
  const status = jest.fn().mockReturnThis();
  const json = jest.fn();
  return {
    response: { setHeader, status, json } as unknown as Response,
    setHeader,
    status,
    json,
  };
};

const createRequest = () => ({ ip: '203.0.113.20' }) as Request;

describe('UploadRateLimitMiddleware', () => {
  it('shares the 30-upload allowance across middleware instances', async () => {
    let count = 0;
    const consume = jest.fn((input: ConsumeRateLimitInput) =>
      Promise.resolve(decision(++count, input.limit)),
    );
    const limiter = { consume } as unknown as DistributedRateLimitService;
    const workers = [
      new UploadRateLimitMiddleware(limiter),
      new UploadRateLimitMiddleware(limiter),
    ];
    const next = jest.fn() as NextFunction;

    for (let attempt = 0; attempt < 31; attempt += 1) {
      await workers[attempt % workers.length].use(
        createRequest(),
        createResponse().response,
        next,
      );
    }

    expect(next).toHaveBeenCalledTimes(30);
    expect(consume).toHaveBeenLastCalledWith({
      policy: 'upload',
      subject: '203.0.113.20',
      limit: 30,
      windowMs: 15 * 60 * 1_000,
    });
  });

  it('returns the shared Retry-After when blocked', async () => {
    const limiter = {
      consume: jest.fn().mockResolvedValue(decision(31, 30, false)),
    } as unknown as DistributedRateLimitService;
    const middleware = new UploadRateLimitMiddleware(limiter);
    const { response, setHeader, status } = createResponse();
    const next = jest.fn() as NextFunction;

    await middleware.use(createRequest(), response, next);

    expect(setHeader).toHaveBeenCalledWith('Retry-After', '60');
    expect(status).toHaveBeenCalledWith(429);
    expect(next).not.toHaveBeenCalled();
  });

  it('fails closed with 503 when coordination is unavailable', async () => {
    const limiter = {
      consume: jest.fn().mockRejectedValue(new CoordinationUnavailableError()),
    } as unknown as DistributedRateLimitService;
    const middleware = new UploadRateLimitMiddleware(limiter);
    const { response, status, json } = createResponse();
    const next = jest.fn() as NextFunction;

    await middleware.use(createRequest(), response, next);

    expect(status).toHaveBeenCalledWith(503);
    expect(json).toHaveBeenCalledWith({
      statusCode: 503,
      message: 'Security controls temporarily unavailable.',
    });
    expect(next).not.toHaveBeenCalled();
  });
});
