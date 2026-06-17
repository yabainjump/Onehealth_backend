import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UsersService } from '../users/users.service';
import { PublicUser } from '../users/interfaces/public-user.interface';
import { Alert, AlertDocument } from './schemas/alert.schema';
import { CreateAlertDto } from './dto/create-alert.dto';
import { UpdateAlertDto } from './dto/update-alert.dto';
import { AddAlertCommentDto } from './dto/add-alert-comment.dto';
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
    const authors = await this.buildAuthorsMap([saved], authorId);
    return this.toResponse(saved, authors, authorId);
  }

  /** Alertes les plus proches d'un point (tri par distance, via index 2dsphere). */
  async near(
    lat: number,
    lng: number,
    radiusKm = 100,
    category?: string,
    limit = 100,
    currentUserId = '',
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
    const authors = await this.buildAuthorsMap(alerts, currentUserId);
    return alerts.map((alert) => this.toResponse(alert, authors, currentUserId));
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

  async list(query: ListAlertsQuery, currentUserId = '') {
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

    const authors = await this.buildAuthorsMap(alerts, currentUserId);
    return alerts.map((alert) => this.toResponse(alert, authors, currentUserId));
  }

  async findById(id: string, currentUserId = '') {
    const alert = await this.alertModel.findById(id).exec();
    if (!alert) {
      throw new NotFoundException('Alert not found');
    }
    const authors = await this.buildAuthorsMap([alert], currentUserId);
    return this.toResponse(alert, authors, currentUserId);
  }

  /** Modifie une alerte (auteur uniquement). */
  async update(id: string, currentUserId: string, dto: UpdateAlertDto) {
    const alert = await this.alertModel.findById(id).exec();
    if (!alert) {
      throw new NotFoundException('Alert not found');
    }
    if (alert.authorId.toString() !== currentUserId) {
      throw new ForbiddenException('You cannot edit this alert');
    }

    if (dto.category !== undefined) {
      alert.category = dto.category;
    }
    if (dto.title !== undefined) {
      alert.title = dto.title.trim();
    }
    if (dto.description !== undefined) {
      alert.description = dto.description.trim();
    }
    if (dto.country !== undefined) {
      alert.country = dto.country.trim();
    }
    if (dto.city !== undefined) {
      alert.city = dto.city.trim();
    }
    if (dto.severity !== undefined) {
      alert.severity = dto.severity;
    }
    if (dto.imageUrls !== undefined) {
      alert.imageUrls = dto.imageUrls;
    }
    // Re-calcule la position GeoJSON si lat/lng sont fournis.
    if (dto.lat !== undefined || dto.lng !== undefined) {
      const lat = typeof dto.lat === 'number' ? dto.lat : alert.lat;
      const lng = typeof dto.lng === 'number' ? dto.lng : alert.lng;
      alert.lat = lat;
      alert.lng = lng;
      alert.geo =
        lat !== null && lng !== null
          ? { type: 'Point', coordinates: [lng, lat] }
          : undefined;
    }

    await alert.save();
    const authors = await this.buildAuthorsMap([alert], currentUserId);
    return this.toResponse(alert, authors, currentUserId);
  }

  /** Supprime une alerte (auteur uniquement). */
  async remove(id: string, currentUserId: string) {
    const alert = await this.alertModel.findById(id).exec();
    if (!alert) {
      throw new NotFoundException('Alert not found');
    }
    if (alert.authorId.toString() !== currentUserId) {
      throw new ForbiddenException('You cannot delete this alert');
    }
    await alert.deleteOne();
    return { success: true };
  }

  /** Réaction « j'aime » (idempotent). Notifie l'auteur. */
  async like(id: string, currentUserId: string) {
    const alert = await this.alertModel.findById(id).exec();
    if (!alert) {
      throw new NotFoundException('Alert not found');
    }
    const already = alert.likedBy.some(
      (userId) => userId.toString() === currentUserId,
    );
    if (!already) {
      alert.likedBy.push(new Types.ObjectId(currentUserId));
      alert.likesCount += 1;
      await alert.save();
      void this.notifyAlertAuthor(alert, currentUserId, 'like');
    }
    const authors = await this.buildAuthorsMap([alert], currentUserId);
    return this.toResponse(alert, authors, currentUserId);
  }

  /** Retire la réaction « j'aime ». */
  async unlike(id: string, currentUserId: string) {
    const alert = await this.alertModel.findById(id).exec();
    if (!alert) {
      throw new NotFoundException('Alert not found');
    }
    const before = alert.likedBy.length;
    alert.likedBy = alert.likedBy.filter(
      (userId) => userId.toString() !== currentUserId,
    );
    if (alert.likedBy.length !== before) {
      alert.likesCount = Math.max(0, alert.likesCount - 1);
      await alert.save();
    }
    const authors = await this.buildAuthorsMap([alert], currentUserId);
    return this.toResponse(alert, authors, currentUserId);
  }

  /** Ajoute un commentaire. Notifie l'auteur de l'alerte. */
  async addComment(id: string, currentUserId: string, dto: AddAlertCommentDto) {
    const alert = await this.alertModel.findById(id).exec();
    if (!alert) {
      throw new NotFoundException('Alert not found');
    }
    alert.comments.push({
      commentId: new Types.ObjectId().toString(),
      authorId: new Types.ObjectId(currentUserId),
      text: dto.text.trim(),
      createdAt: new Date(),
    });
    await alert.save();
    void this.notifyAlertAuthor(alert, currentUserId, 'comment');

    const authors = await this.buildAuthorsMap([alert], currentUserId);
    return this.toResponse(alert, authors, currentUserId);
  }

  /** Liste les commentaires d'une alerte. */
  async listComments(id: string, currentUserId = '') {
    const alert = await this.alertModel.findById(id).exec();
    if (!alert) {
      throw new NotFoundException('Alert not found');
    }
    const authors = await this.buildAuthorsMap([alert], currentUserId);
    return this.toResponse(alert, authors, currentUserId).comments;
  }

  /**
   * Supprime un commentaire : autorisé à l'auteur du commentaire OU à
   * l'auteur de l'alerte.
   */
  async deleteComment(id: string, commentId: string, currentUserId: string) {
    const alert = await this.alertModel.findById(id).exec();
    if (!alert) {
      throw new NotFoundException('Alert not found');
    }
    const comment = (alert.comments || []).find(
      (item) => `${item.commentId}` === `${commentId}`,
    );
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }
    const isCommentAuthor = comment.authorId.toString() === currentUserId;
    const isAlertAuthor = alert.authorId.toString() === currentUserId;
    if (!isCommentAuthor && !isAlertAuthor) {
      throw new ForbiddenException('You cannot delete this comment');
    }
    alert.comments = alert.comments.filter(
      (item) => `${item.commentId}` !== `${commentId}`,
    );
    await alert.save();
    const authors = await this.buildAuthorsMap([alert], currentUserId);
    return this.toResponse(alert, authors, currentUserId);
  }

  /** Notifie l'auteur de l'alerte (j'aime / commentaire), jamais soi-même. */
  private async notifyAlertAuthor(
    alert: AlertDocument,
    actorId: string,
    type: 'like' | 'comment',
  ): Promise<void> {
    try {
      const recipientId = alert.authorId.toString();
      if (recipientId === actorId) {
        return;
      }
      const actor = await this.usersService.findById(actorId);
      const actorName = actor
        ? `${actor.firstName || ''} ${actor.lastName || ''}`.trim() ||
          actor.username ||
          ''
        : '';
      await this.notificationsService.create({
        recipientId,
        actorId,
        actorName,
        actorPhotoURL: actor?.photoURL || '',
        type,
        alertId: alert._id.toString(),
      });
    } catch {
      // Une notification qui échoue ne casse jamais l'action principale.
    }
  }

  private async buildAuthorsMap(
    alerts: AlertDocument[],
    currentUserId?: string,
  ): Promise<Map<string, PublicUser>> {
    const ids = new Set<string>();
    for (const alert of alerts) {
      ids.add(alert.authorId.toString());
      for (const comment of alert.comments || []) {
        ids.add(comment.authorId.toString());
      }
    }
    const users = await this.usersService.findByIds(Array.from(ids));
    const map = new Map<string, PublicUser>();
    for (const user of users) {
      map.set(
        user._id.toString(),
        this.usersService.toPublicUser(user, currentUserId),
      );
    }
    return map;
  }

  private toResponse(
    alert: AlertDocument,
    authors: Map<string, PublicUser>,
    currentUserId = '',
  ) {
    const author = authors.get(alert.authorId.toString()) ?? null;
    const comments = (alert.comments || []).map((comment) => {
      const cAuthor = authors.get(comment.authorId.toString()) ?? null;
      return {
        id: comment.commentId,
        author: cAuthor
          ? {
              id: cAuthor.id,
              firstName: cAuthor.firstName,
              lastName: cAuthor.lastName,
              username: cAuthor.username,
              photoURL: cAuthor.photoURL,
              institution: cAuthor.institution,
            }
          : null,
        text: comment.text,
        createdAt: comment.createdAt,
      };
    });
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
      likesCount: alert.likesCount || 0,
      userHasLiked: (alert.likedBy || []).some(
        (userId) => userId.toString() === currentUserId,
      ),
      commentsCount: (alert.comments || []).length,
      comments,
      createdAt: alert.createdAt,
    };
  }
}
