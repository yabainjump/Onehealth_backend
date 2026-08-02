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

@Injectable()
export class CertificationsService {
  constructor(
    @InjectModel(CertificationRequest.name)
    private readonly requestModel: Model<CertificationRequest>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
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

    const request = await new this.requestModel({
      userId: new Types.ObjectId(userId),
      documents: dto.documents,
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
      documents: request.documents,
      message: request.message,
      status: request.status,
      adminNotes: request.adminNotes,
      reviewedAt: request.reviewedAt,
      createdAt: request.createdAt,
    };
  }
}
