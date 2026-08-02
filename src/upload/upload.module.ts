import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { UploadRateLimitMiddleware } from './upload-rate-limit.middleware';

@Module({
  controllers: [UploadController],
  providers: [UploadService],
})
export class UploadModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(UploadRateLimitMiddleware)
      .forRoutes(
        { path: 'upload/profile', method: RequestMethod.POST },
        { path: 'upload/post', method: RequestMethod.POST },
        { path: 'upload/message', method: RequestMethod.POST },
      );
  }
}
