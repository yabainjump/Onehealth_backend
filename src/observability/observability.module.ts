import {
  Global,
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RequestContextMiddleware } from './request-context.middleware';
import { RequestLoggerService } from './request-logger.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [RequestLoggerService, RequestContextMiddleware],
  exports: [RequestLoggerService],
})
export class ObservabilityModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes({
      path: '*splat',
      method: RequestMethod.ALL,
    });
  }
}
