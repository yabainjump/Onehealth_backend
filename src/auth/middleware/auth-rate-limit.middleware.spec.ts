import type { NextFunction, Request, Response } from 'express';
import { CoordinationUnavailableError } from '../../coordination/coordination.errors';
import {
  ConsumeRateLimitInput,
  DistributedRateLimitService,
  RateLimitDecision,
} from '../../coordination/distributed-rate-limit.service';
import { AuthRateLimitMiddleware } from './auth-rate-limit.middleware';

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

const createRequest = (path = '/api/auth/login') =>
  ({ originalUrl: path, url: path, ip: '198.51.100.10' }) as Request;

describe('AuthRateLimitMiddleware', () => {
  it('applies one shared allowance across middleware instances', async () => {
    let count = 0;
    const consume = jest.fn((input: ConsumeRateLimitInput) =>
      Promise.resolve(decision(++count, input.limit)),
    );
    const limiter = { consume } as unknown as DistributedRateLimitService;
    const workers = [
      new AuthRateLimitMiddleware(limiter),
      new AuthRateLimitMiddleware(limiter),
    ];
    const next = jest.fn() as NextFunction;

    for (let attempt = 0; attempt < 11; attempt += 1) {
      const { response } = createResponse();
      await workers[attempt % workers.length].use(
        createRequest(),
        response,
        next,
      );
    }

    expect(next).toHaveBeenCalledTimes(10);
    expect(consume).toHaveBeenCalledTimes(11);
    expect(consume).toHaveBeenLastCalledWith(
      expect.objectContaining({
        policy: 'auth-login',
        subject: '198.51.100.10',
        limit: 10,
      }),
    );
  });

  it('returns 429 and Retry-After from the shared decision', async () => {
    const limiter = {
      consume: jest.fn().mockResolvedValue(decision(11, 10, false)),
    } as unknown as DistributedRateLimitService;
    const middleware = new AuthRateLimitMiddleware(limiter);
    const { response, setHeader, status, json } = createResponse();
    const next = jest.fn() as NextFunction;

    await middleware.use(createRequest(), response, next);

    expect(setHeader).toHaveBeenCalledWith('Retry-After', '60');
    expect(status).toHaveBeenCalledWith(429);
    expect(json).toHaveBeenCalledWith({
      statusCode: 429,
      message: 'Too many attempts. Please try again later.',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('fails closed with 503 when shared coordination is unavailable', async () => {
    const limiter = {
      consume: jest.fn().mockRejectedValue(new CoordinationUnavailableError()),
    } as unknown as DistributedRateLimitService;
    const middleware = new AuthRateLimitMiddleware(limiter);
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

  // Express atteint le contrôleur de connexion quelle que soit la casse, une
  // barre oblique finale ou un segment « . ». Chaque variante doit donc être
  // comptée dans le même compartiment, sinon la limite est contournable.
  it.each([
    ['/api/auth/login/', 'auth-login'],
    ['/api/AUTH/LOGIN', 'auth-login'],
    ['/api/Auth/Login', 'auth-login'],
    ['/api/auth/./login', 'auth-login'],
    ['/api/auth//login', 'auth-login'],
    ['/api/AUTH/FORGOT-PASSWORD', 'auth-forgot-password'],
    ['/api/auth/register/', 'auth-register'],
  ])('rate limits the equivalent route %s', async (path, policy) => {
    const consume = jest.fn().mockResolvedValue(decision(1, 10));
    const limiter = { consume } as unknown as DistributedRateLimitService;
    const middleware = new AuthRateLimitMiddleware(limiter);
    const next = jest.fn() as NextFunction;

    await middleware.use(createRequest(path), createResponse().response, next);

    expect(consume).toHaveBeenCalledWith(expect.objectContaining({ policy }));
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('does not rate limit unrelated routes', async () => {
    const consume = jest.fn();
    const limiter = { consume } as unknown as DistributedRateLimitService;
    const middleware = new AuthRateLimitMiddleware(limiter);
    const next = jest.fn() as NextFunction;

    await middleware.use(
      createRequest('/api/auth/me'),
      createResponse().response,
      next,
    );

    expect(next).toHaveBeenCalledTimes(1);
    expect(consume).not.toHaveBeenCalled();
  });
});
