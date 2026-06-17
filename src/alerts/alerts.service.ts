import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UsersService } from '../users/users.service';
import { PublicUser } from '../users/interfaces/public-user.interface';
import { Alert, AlertDocument } from './schemas/alert.schema';
import { CreateAlertDto } from './dto/create-alert.dto';

export interface ListAlertsQuery {
  category?: string;
  severity?: string;
  country?: string;
  limit?: number;
  page?: number;
}

@Injectable()
export class AlertsService {
  constructor(
    @InjectModel(Alert.name) private readonly alertModel: Model<Alert>,
    private readonly usersService: UsersService,
  ) {}

  async create(authorId: string, dto: CreateAlertDto) {
    const alert = new this.alertModel({
      authorId: new Types.ObjectId(authorId),
      category: dto.category,
      title: dto.title.trim(),
      description: dto.description?.trim() ?? '',
      country: dto.country?.trim() ?? '',
      city: dto.city?.trim() ?? '',
      lat: typeof dto.lat === 'number' ? dto.lat : null,
      lng: typeof dto.lng === 'number' ? dto.lng : null,
      severity: dto.severity ?? 'medium',
      imageUrls: dto.imageUrls ?? [],
    });

    const saved = await alert.save();
    const authors = await this.buildAuthorsMap([saved]);
    return this.toResponse(saved, authors);
  }

  async list(query: ListAlertsQuery) {
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 100);
    const page = Math.max(query.page ?? 1, 1);
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};
    if (query.category && ['human', 'animal', 'environment'].includes(query.category)) {
      filter.category = query.category;
    }
    if (query.severity && ['low', 'medium', 'high'].includes(query.severity)) {
      filter.severity = query.severity;
    }
    if (query.country && `${query.country}`.trim()) {
      filter.country = new RegExp(
        `${query.country}`.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        'i',
      );
    }

    const alerts = await this.alertModel
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();

    const authors = await this.buildAuthorsMap(alerts);
    return alerts.map((alert) => this.toResponse(alert, authors));
  }

  async findById(id: string) {
    const alert = await this.alertModel.findById(id).exec();
    if (!alert) {
      throw new NotFoundException('Alert not found');
    }
    const authors = await this.buildAuthorsMap([alert]);
    return this.toResponse(alert, authors);
  }

  private async buildAuthorsMap(
    alerts: AlertDocument[],
  ): Promise<Map<string, PublicUser>> {
    const ids = Array.from(
      new Set(alerts.map((alert) => alert.authorId.toString())),
    );
    const users = await this.usersService.findByIds(ids);
    const map = new Map<string, PublicUser>();
    for (const user of users) {
      map.set(user._id.toString(), this.usersService.toPublicUser(user));
    }
    return map;
  }

  private toResponse(alert: AlertDocument, authors: Map<string, PublicUser>) {
    const author = authors.get(alert.authorId.toString()) ?? null;
    return {
      id: alert._id.toString(),
      category: alert.category,
      title: alert.title,
      description: alert.description,
      country: alert.country,
      city: alert.city,
      lat: alert.lat,
      lng: alert.lng,
      severity: alert.severity,
      imageUrls: alert.imageUrls,
      author: author
        ? {
            id: author.id,
            firstName: author.firstName,
            lastName: author.lastName,
            username: author.username,
            photoURL: author.photoURL,
            institution: author.institution,
          }
        : null,
      createdAt: alert.createdAt,
    };
  }
}
