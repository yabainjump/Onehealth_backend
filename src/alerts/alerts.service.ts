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
  verificationStatus?: string;
}

const TRIMMED_UPDATE_FIELDS = [
  'title',
  'description',
  'country',
  'city',
] as const;

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
      verificationStatus: 'pending',
      imageUrls: dto.imageUrls ?? [],
    });

    const saved = await alert.save();
    return this.respond(saved, authorId);
  }

  /** Alertes les plus proches d'un point (tri par distance, via index 2dsphere). */
  async near(
    lat: number,
    lng: number,
    radiusKm = 100,
    category?: string,
    verificationStatus?: string,
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
      isHidden: { $ne: true },
      verificationStatus: { $ne: 'rejected' },
    };
    if (category && ['human', 'animal', 'environment'].includes(category)) {
      filter.category = category;
    }
    if (
      verificationStatus &&
      ['pending', 'verified'].includes(verificationStatus)
    ) {
      if (verificationStatus === 'pending') {
        filter.$or = [
          { verificationStatus: 'pending' },
          { verificationStatus: { $exists: false } },
        ];
      } else {
        filter.verificationStatus = verificationStatus;
      }
    }
    const alerts = await this.alertModel
      .find(filter)
      .limit(Math.min(Math.max(limit, 1), 100))
      .exec();
    return this.respondMany(alerts, currentUserId);
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

  /** Notifie les membres concernés uniquement après validation administrative. */
  async notifyVerifiedAlert(alertId: string): Promise<void> {
    const alert = await this.alertModel
      .findOne({
        _id: alertId,
        isHidden: { $ne: true },
        verificationStatus: 'verified',
      })
      .exec();
    if (!alert) {
      return;
    }
    await this.notifyNearbyUsers(alert, alert.authorId.toString());
  }

  async list(query: ListAlertsQuery, currentUserId = '') {
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 100);
    const page = Math.max(query.page ?? 1, 1);
    const skip = (page - 1) * limit;

    // Les alertes mises en pause par un admin sont exclues des fils publics.
    const filter: Record<string, unknown> = {
      isHidden: { $ne: true },
      verificationStatus: { $ne: 'rejected' },
    };
    if (
      query.category &&
      ['human', 'animal', 'environment'].includes(query.category)
    ) {
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
    if (
      query.verificationStatus &&
      ['pending', 'verified'].includes(query.verificationStatus)
    ) {
      if (query.verificationStatus === 'pending') {
        filter.$or = [
          { verificationStatus: 'pending' },
          { verificationStatus: { $exists: false } },
        ];
      } else {
        filter.verificationStatus = query.verificationStatus;
      }
    }

    const alerts = await this.alertModel
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();

    return this.respondMany(alerts, currentUserId);
  }

  async findById(id: string, currentUserId = '') {
    const alert = await this.alertModel
      .findOne({
        _id: id,
        isHidden: { $ne: true },
        verificationStatus: { $ne: 'rejected' },
      })
      .exec();
    if (!alert) {
      throw new NotFoundException('Alert not found');
    }
    return this.respond(alert, currentUserId);
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

    const set: Record<string, unknown> = {};
    const unset: Record<string, ''> = {};

    for (const field of TRIMMED_UPDATE_FIELDS) {
      const value = dto[field];
      if (value !== undefined) {
        set[field] = value.trim();
      }
    }
    if (dto.category !== undefined) {
      set.category = dto.category;
    }
    if (dto.severity !== undefined) {
      set.severity = dto.severity;
    }
    if (dto.imageUrls !== undefined) {
      set.imageUrls = dto.imageUrls;
    }

    // Re-calcule la position GeoJSON si lat/lng sont fournis. `null` efface
    // explicitement la position (distinct de `undefined` = champ non fourni).
    if (dto.lat !== undefined || dto.lng !== undefined) {
      const lat = dto.lat === undefined ? alert.lat : dto.lat;
      const lng = dto.lng === undefined ? alert.lng : dto.lng;
      set.lat = lat;
      set.lng = lng;
      if (typeof lat === 'number' && typeof lng === 'number') {
        set.geo = { type: 'Point', coordinates: [lng, lat] };
      } else {
        unset.geo = '';
      }
    }

    // Toute modification du contenu invalide la vérification précédente.
    if (Object.keys(set).length || Object.keys(unset).length) {
      set.verificationStatus = 'pending';
      set.reviewedAt = null;
      set.reviewedBy = null;
    }

    const updateOps: Record<string, unknown> = {};
    if (Object.keys(set).length) {
      updateOps.$set = set;
    }
    if (Object.keys(unset).length) {
      updateOps.$unset = unset;
    }

    const updated = Object.keys(updateOps).length
      ? await this.alertModel
          .findOneAndUpdate({ _id: id }, updateOps, {
            new: true,
            runValidators: true,
          })
          .exec()
      : alert;
    if (!updated) {
      throw new NotFoundException('Alert not found');
    }
    return this.respond(updated, currentUserId);
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

  /**
   * Réaction « j'aime » (idempotente, atomique via $push filtré). Notifie
   * l'auteur. Le filtre `likedBy: { $ne }` empêche tout doublon même en cas
   * de requêtes concurrentes sur la même alerte.
   */
  async like(id: string, currentUserId: string) {
    const userObjectId = new Types.ObjectId(currentUserId);
    const updated = await this.alertModel
      .findOneAndUpdate(
        {
          _id: id,
          isHidden: { $ne: true },
          verificationStatus: { $ne: 'rejected' },
          likedBy: { $ne: userObjectId },
        },
        { $push: { likedBy: userObjectId } },
        { new: true },
      )
      .exec();
    if (updated) {
      void this.notifyAlertAuthor(updated, currentUserId, 'like');
    }
    const alert =
      updated ??
      (await this.alertModel
        .findOne({
          _id: id,
          isHidden: { $ne: true },
          verificationStatus: { $ne: 'rejected' },
        })
        .exec());
    if (!alert) {
      throw new NotFoundException('Alert not found');
    }
    return this.respond(alert, currentUserId);
  }

  /** Retire la réaction « j'aime » (atomique via $pull). */
  async unlike(id: string, currentUserId: string) {
    const userObjectId = new Types.ObjectId(currentUserId);
    const updated = await this.alertModel
      .findOneAndUpdate(
        {
          _id: id,
          isHidden: { $ne: true },
          verificationStatus: { $ne: 'rejected' },
          likedBy: userObjectId,
        },
        { $pull: { likedBy: userObjectId } },
        { new: true },
      )
      .exec();
    const alert =
      updated ??
      (await this.alertModel
        .findOne({
          _id: id,
          isHidden: { $ne: true },
          verificationStatus: { $ne: 'rejected' },
        })
        .exec());
    if (!alert) {
      throw new NotFoundException('Alert not found');
    }
    return this.respond(alert, currentUserId);
  }

  /** Ajoute un commentaire (atomique via $push). Notifie l'auteur de l'alerte. */
  async addComment(id: string, currentUserId: string, dto: AddAlertCommentDto) {
    const comment = {
      commentId: new Types.ObjectId().toString(),
      authorId: new Types.ObjectId(currentUserId),
      text: dto.text.trim(),
      createdAt: new Date(),
    };
    const alert = await this.alertModel
      .findOneAndUpdate(
        {
          _id: id,
          isHidden: { $ne: true },
          verificationStatus: { $ne: 'rejected' },
        },
        { $push: { comments: comment } },
        { new: true, runValidators: true },
      )
      .exec();
    if (!alert) {
      throw new NotFoundException('Alert not found');
    }
    void this.notifyAlertAuthor(alert, currentUserId, 'comment');
    return this.respond(alert, currentUserId);
  }

  /** Liste les commentaires d'une alerte. */
  async listComments(id: string, currentUserId = '') {
    const alert = await this.alertModel
      .findOne({
        _id: id,
        isHidden: { $ne: true },
        verificationStatus: { $ne: 'rejected' },
      })
      .exec();
    if (!alert) {
      throw new NotFoundException('Alert not found');
    }
    return (await this.respond(alert, currentUserId)).comments;
  }

  /**
   * Supprime un commentaire : autorisé à l'auteur du commentaire OU à
   * l'auteur de l'alerte. La suppression elle-même est un $pull atomique
   * ciblé par commentId : elle ne peut pas écraser un like ou un commentaire
   * ajouté entre-temps par quelqu'un d'autre.
   */
  async deleteComment(id: string, commentId: string, currentUserId: string) {
    const alert = await this.alertModel
      .findOne({
        _id: id,
        isHidden: { $ne: true },
        verificationStatus: { $ne: 'rejected' },
      })
      .exec();
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
    const updated = await this.alertModel
      .findOneAndUpdate(
        { _id: id },
        { $pull: { comments: { commentId } } },
        { new: true },
      )
      .exec();
    const finalAlert = updated ?? alert;
    return this.respond(finalAlert, currentUserId);
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

  /** Construit la réponse publique d'une seule alerte (auteurs résolus). */
  private async respond(alert: AlertDocument, currentUserId = '') {
    const authors = await this.buildAuthorsMap([alert], currentUserId, true);
    return this.toResponse(alert, authors, currentUserId, true);
  }

  /** Construit la réponse publique d'une liste d'alertes (auteurs partagés). */
  private async respondMany(alerts: AlertDocument[], currentUserId = '') {
    const authors = await this.buildAuthorsMap(alerts, currentUserId, false);
    return alerts.map((alert) =>
      this.toResponse(alert, authors, currentUserId, false),
    );
  }

  private async buildAuthorsMap(
    alerts: AlertDocument[],
    currentUserId?: string,
    includeCommentAuthors = true,
  ): Promise<Map<string, PublicUser>> {
    const ids = new Set<string>();
    for (const alert of alerts) {
      ids.add(alert.authorId.toString());
      if (includeCommentAuthors) {
        for (const comment of alert.comments || []) {
          ids.add(comment.authorId.toString());
        }
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
    includeComments = true,
  ) {
    const author = authors.get(alert.authorId.toString()) ?? null;
    const comments = (includeComments ? alert.comments || [] : []).map(
      (comment) => {
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
                isCertified: !!cAuthor.isCertified,
              }
            : null,
          text: comment.text,
          createdAt: comment.createdAt,
        };
      },
    );
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
      verificationStatus: alert.verificationStatus ?? 'pending',
      reviewedAt: alert.reviewedAt ?? null,
      imageUrls: alert.imageUrls,
      author: author
        ? {
            id: author.id,
            firstName: author.firstName,
            lastName: author.lastName,
            username: author.username,
            photoURL: author.photoURL,
            institution: author.institution,
            isCertified: !!author.isCertified,
          }
        : null,
      likesCount: (alert.likedBy || []).length,
      userHasLiked: (alert.likedBy || []).some(
        (userId) => userId.toString() === currentUserId,
      ),
      commentsCount: (alert.comments || []).length,
      comments: includeComments ? comments : undefined,
      createdAt: alert.createdAt,
    };
  }
}
