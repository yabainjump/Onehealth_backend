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

@Module({
  imports: [
    AppConfigModule,
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI'),
        dbName: configService.get<string>('MONGODB_DB_NAME') ?? 'onehealth',
      }),
    }),
    HealthModule,
    UsersModule,
    AuthModule,
    PostsModule,
    ChatModule,
    UploadModule,
    ShareModule,
  ],
})
export class AppModule {}
