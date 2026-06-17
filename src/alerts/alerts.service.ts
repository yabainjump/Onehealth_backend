import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UsersService } from '../users/users.service';
import { PublicUser } from '../users/interfaces/public-user.interface';
import { Alert, AlertDocument } from './schemas/alert.schema';
import { CreateAlertDto } from './dto/create-alert.dto';
import { NotificationsService } from '../notifications/notifications.service';

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
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(authorId: string, dto: CreateAlertDto) {
    const lat = typeof dto.lat === 'number' ? dto.lat : null;
    const lng = typeof dto.lng === 'number' ? dto.lng : null;
    const alert = new this.alertModel({
      authorId: new Types.ObjectId(authorId),
      category: dto.category,
      title: dto.title.trim(),
      description: dto.description?.trim() ?? '',
      country: dto.country?.trim() ?? '',
      city: dto.city?.trim() ?? '',
      lat,
      lng,
      geo:
        lat !== null && lng !== null
          ? { type: 'Point', coordinates: [lng, lat] }
          : undefined,
      severity: dto.severity ?? 'medium',
      imageUrls: dto.imageUrls ?? [],
    });

    const saved = await alert.save();
    // Prévient (en arrière-plan) les utilisateurs du même pays.
    void this.notifyNearbyUsers(saved, authorId);
    const authors = await this.buildAuthorsMap([saved]);
    return this.toResponse(saved, authors);
  }

  /** Alertes les plus proches d'un point (tri par distance, via index 2dsphere). */
  async near(
    lat: number,
    lng: number,
    radiusKm = 100,
    category?: string,
    limit = 100,
  ) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return [];
    }
    const filter: Record<string, unknown> = {
      geo: {
        $near: {
          $geometry: { type: 'Point', coordinates: [lng, lat] },
          $maxDistance: Math.min(Math.max(radiusKm, 1), 5000) * 1000,
        },
      },
    };
    if (category && ['human', 'animal', 'environment'].includes(category)) {
      filter.category = category;
    }
    const alerts = await this.alertModel
      .find(filter)
      .limit(Math.min(Math.max(limit, 1), 100))
      .exec();
    const authors = await this.buildAuthorsMap(alerts);
    return alerts.map((alert) => this.toResponse(alert, authors));
  }

  private async notifyNearbyUsers(
    alert: AlertDocument,
    authorId: string,
  ): Promise<void> {
    try {
      const country = `${alert.country || ''}`.trim();
      if (!country) {
        return;
      }
      const recipientIds = await this.usersService.findIdsByCountry(
        country,
        authorId,
        200,
      );
      if (!recipientIds.length) {
        return;
      }
      const author = await this.usersService.findById(authorId);
      const actorName = author
        ? `${author.firstName || ''} ${author.lastName || ''}`.trim() ||
          author.username ||
          ''
        : '';
      const alertId = alert._id.toString();
      await Promise.all(
        recipientIds.map((recipientId) =>
          this.notificationsService.create({
            recipientId,
            actorId: authorId,
            actorName,
            actorPhotoURL: author?.photoURL || '',
            type: 'alert',
            alertId,
          }),
        ),
      );
    } catch {
      // Une notification qui échoue ne doit jamais casser la création de l'alerte.
    }
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
