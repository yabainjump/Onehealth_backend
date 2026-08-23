import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { RequestLoggerService } from './request-logger.service';

const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{8,128}$/;

export type RequestContext = {
  requestId: string;
  startedAt: bigint;
};

export const REQUEST_CONTEXT = Symbol('onehealth.request-context');

export type RequestWithContext = Request & {
  [REQUEST_CONTEXT]?: RequestContext;
};

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(private readonly requestLogger: RequestLoggerService) {}

  use(request: RequestWithContext, response: Response, next: NextFunction) {
    const requestId = this.resolveRequestId(request.headers['x-request-id']);
    const startedAt = process.hrtime.bigint();
    Object.defineProperty(request, REQUEST_CONTEXT, {
      configurable: false,
      enumerable: false,
      writable: false,
      value: { requestId, startedAt },
    });
    response.setHeader('X-Request-Id', requestId);

    response.once('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
      this.requestLogger.logCompletion({
        requestId,
        method: request.method,
        path: this.safePath(request.originalUrl),
        statusCode: response.statusCode,
        durationMs,
      });
    });
    next();
  }

  private resolveRequestId(value: string | string[] | undefined): string {
    return typeof value === 'string' && SAFE_REQUEST_ID.test(value)
      ? value
      : randomUUID();
  }

  private safePath(originalUrl: string): string {
    return originalUrl.split(/[?#]/, 1)[0].slice(0, 512) || '/';
  }
}
