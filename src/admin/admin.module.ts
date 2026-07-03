import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Post, PostSchema } from '../posts/schemas/post.schema';
import { Alert, AlertSchema } from '../alerts/schemas/alert.schema';
import { UsersModule } from '../users/users.module';
import { CertificationsModule } from '../certifications/certifications.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Post.name, schema: PostSchema },
      { name: Alert.name, schema: AlertSchema },
    ]),
    UsersModule,
    CertificationsModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
