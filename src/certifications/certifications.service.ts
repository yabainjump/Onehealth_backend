import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User } from '../users/schemas/user.schema';
import {
  CertificationRequest,
  CertificationRequestDocument,
} from './schemas/certification-request.schema';
import { CreateCertificationRequestDto } from './dto/create-certification-request.dto';
import { UploadService } from '../upload/upload.service';
import { MediaSignatureService } from '../media-access/media-signature.service';

@Injectable()
export class CertificationsService {
  constructor(
    @InjectModel(CertificationRequest.name)
    private readonly requestModel: Model<CertificationRequest>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly uploads: UploadService,
    private readonly mediaSignature: MediaSignatureService,
  ) {}

  /** Soumet une demande de certification (une seule demande active à la fois). */
  async create(userId: string, dto: CreateCertificationRequestDto) {
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.isCertified) {
      throw new BadRequestException('Profile is already certified');
    }
    const existing = await this.requestModel
      .findOne({ userId: new Types.ObjectId(userId), status: 'pending' })
      .exec();
    if (existing) {
      throw new BadRequestException(
        'A certification request is already pending',
      );
    }

    const documents = dto.documents.map((url) => {
      const canonical = this.uploads.verifyPrivateUpload(
        url,
        userId,
        'certification',
      );
      if (!canonical) {
        throw new BadRequestException('Invalid certification document');
      }
      return canonical;
    });

    const request = await new this.requestModel({
      userId: new Types.ObjectId(userId),
      documents,
      message: dto.message?.trim() ?? '',
    }).save();

    await this.userModel
      .updateOne(
        { _id: userId },
        {
          $set: {
            certificationStatus: 'pending',
            certificationRequestedAt: new Date(),
          },
        },
      )
      .exec();

    return this.toResponse(request);
  }

  /** Dernière demande de l'utilisateur courant (pour afficher le statut). */
  async findMine(userId: string) {
    const request = await this.requestModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .exec();
    return request ? this.toResponse(request) : null;
  }

  toResponse(request: CertificationRequestDocument) {
    return {
      id: request._id.toString(),
      userId: request.userId.toString(),
      documents: request.documents.map((url) => this.documentForResponse(url)),
      message: request.message,
      status: request.status,
      adminNotes: request.adminNotes,
      reviewedAt: request.reviewedAt,
      createdAt: request.createdAt,
    };
  }

  private documentForResponse(rawUrl: string): string {
    let path: string;
    try {
      path = new URL(rawUrl, 'http://local.invalid').pathname;
    } catch {
      return '';
    }
    if (/^\/uploads\/certification\/[A-Za-z0-9._-]+$/.test(path)) {
      return this.mediaSignature.sign(this.uploads.buildFileUrl(path));
    }
    // Legacy requests were not validated. Never refresh a chat attachment
    // merely because its URL was saved as a certification document.
    if (MediaSignatureService.isProtectedPath(path)) return '';
    return rawUrl;
  }
}
