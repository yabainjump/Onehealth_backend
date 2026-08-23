import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type CompletedRequestLog = {
  requestId: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
};

@Injectable()
export class RequestLoggerService {
  private readonly logger = new Logger('HttpRequest');
  private readonly instanceId: string;

  constructor(configService: ConfigService) {
    this.instanceId =
      configService.get<string>('instanceId') ?? `process-${process.pid}`;
  }

  logCompletion(input: CompletedRequestLog): void {
    this.logger.log(
      JSON.stringify({
        event: 'http_request_completed',
        requestId: input.requestId,
        instanceId: this.instanceId,
        method: input.method.slice(0, 16),
        path: input.path.slice(0, 512),
        statusCode: input.statusCode,
        durationMs: Math.round(input.durationMs * 100) / 100,
      }),
    );
  }
}
