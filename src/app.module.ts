import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { AppConfigModule } from './config/app-config.module';
import { HealthModule } from './health/health.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { PostsModule } from './posts/posts.module';
import { ChatModule } from './chat/chat.module';
import { UploadModule } from './upload/upload.module';
import { ShareModule } from './share/share.module';
import { MediaModule } from './media/media.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AlertsModule } from './alerts/alerts.module';
import { CertificationsModule } from './certifications/certifications.module';
import { AdminModule } from './admin/admin.module';
import { RudolfModule } from './rudolf/rudolf.module';
import { HubModule } from './hub/hub.module';
import { HUB_CONNECTION } from './hub/hub.constants';
import { RuntimeModule } from './runtime/runtime.module';
import { ObservabilityModule } from './observability/observability.module';

@Module({
  imports: [
    AppConfigModule,
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.getOrThrow<string>('mongodbUri'),
        dbName: configService.get<string>('mongodbDbName') ?? 'onehealth',
        maxPoolSize: configService.get<number>('mongodbMaxPoolSize') ?? 10,
      }),
    }),
    MongooseModule.forRootAsync({
      connectionName: HUB_CONNECTION,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.getOrThrow<string>('hubMongodbUri'),
        dbName:
          configService.get<string>('hubMongodbDbName') ?? 'onehealth_hub',
        maxPoolSize: configService.get<number>('hubMongodbMaxPoolSize') ?? 10,
      }),
    }),
    RuntimeModule,
    ObservabilityModule,
    HealthModule,
    UsersModule,
    AuthModule,
    PostsModule,
    ChatModule,
    UploadModule,
    ShareModule,
    MediaModule,
    NotificationsModule,
    AlertsModule,
    CertificationsModule,
    AdminModule,
    RudolfModule,
    HubModule,
  ],
})
export class AppModule {}
