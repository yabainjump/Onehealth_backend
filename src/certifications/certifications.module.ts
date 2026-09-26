import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../users/schemas/user.schema';
import {
  CertificationRequest,
  CertificationRequestSchema,
} from './schemas/certification-request.schema';
import { CertificationsController } from './certifications.controller';
import { CertificationsService } from './certifications.service';
import { UploadModule } from '../upload/upload.module';

@Module({
  imports: [
    UploadModule,
    MongooseModule.forFeature([
      { name: CertificationRequest.name, schema: CertificationRequestSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [CertificationsController],
  providers: [CertificationsService],
  exports: [CertificationsService, MongooseModule],
})
export class CertificationsModule {}
