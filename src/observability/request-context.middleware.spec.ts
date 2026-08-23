import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter } from 'node:events';
import type { NextFunction, Request, Response } from 'express';
import { RequestContextMiddleware } from './request-context.middleware';
import { RequestLoggerService } from './request-logger.service';

describe('RequestContextMiddleware', () => {
  const createSubject = () => {
    const logCompletion = jest.fn();
    const logger = { logCompletion } as unknown as RequestLoggerService;
    return {
      middleware: new RequestContextMiddleware(logger),
      logCompletion,
    };
  };

  const execute = (incomingId?: string) => {
    const { middleware, logCompletion } = createSubject();
    let responseRequestId: string | undefined;
    const setHeader = jest.fn((name: string, value: string) => {
      if (name === 'X-Request-Id') responseRequestId = value;
    });
    const response = Object.assign(new EventEmitter(), {
      statusCode: 200,
      setHeader,
    }) as unknown as Response;
    const request = {
      method: 'GET',
      originalUrl: '/api/posts?token=secret',
      headers: {
        'x-request-id': incomingId,
        authorization: 'Bearer must-never-be-logged',
      },
      body: { password: 'must-never-be-logged' },
    } as unknown as Request;
    const next = jest.fn() as NextFunction;

    middleware.use(request, response, next);
    response.emit('finish');
    return {
      request,
      response,
      next,
      logCompletion,
      setHeader,
      getResponseRequestId: () => responseRequestId,
    };
  };

  it('reuses only a valid bounded inbound request ID', () => {
    const result = execute('dashboard:request-123');

    expect(result.setHeader).toHaveBeenCalledWith(
      'X-Request-Id',
      'dashboard:request-123',
    );
    expect(result.next).toHaveBeenCalledTimes(1);
  });

  it.each([
    'short',
    'contains spaces',
    '<script>alert(1)</script>',
    'x'.repeat(129),
  ])('replaces an invalid inbound ID: %s', (incomingId) => {
    const result = execute(incomingId);
    const generated = result.getResponseRequestId();

    expect(generated).toMatch(/^[0-9a-f-]{36}$/);
    expect(generated).not.toBe(incomingId);
  });

  it('passes only safe context to structured logging', () => {
    const result = execute('safe-request-123');
    const serialized = JSON.stringify(result.logCompletion.mock.calls);

    expect(result.logCompletion).toHaveBeenCalledTimes(1);
    expect(serialized).toContain('safe-request-123');
    expect(serialized).not.toContain('must-never-be-logged');
    expect(serialized).not.toContain('?token=secret');
  });
});

describe('RequestLoggerService', () => {
  it('emits bounded JSON with instance identity and no arbitrary payload', () => {
    const service = new RequestLoggerService(
      new ConfigService({ instanceId: 'worker-1' }),
    );
    let serialized: unknown;
    const log = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation((value) => {
        serialized = value;
      });

    service.logCompletion({
      requestId: 'safe-request-123',
      method: 'POST',
      path: '/api/auth/login',
      statusCode: 400,
      durationMs: 12.345,
    });

    const parsed = JSON.parse(
      typeof serialized === 'string' ? serialized : '',
    ) as unknown;
    expect(parsed).toEqual({
      event: 'http_request_completed',
      requestId: 'safe-request-123',
      instanceId: 'worker-1',
      method: 'POST',
      path: '/api/auth/login',
      statusCode: 400,
      durationMs: 12.35,
    });
    log.mockRestore();
  });
});
