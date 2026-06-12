import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Notification,
  NotificationDocument,
  NotificationType,
} from './schemas/notification.schema';

export interface CreateNotificationInput {
  recipientId: string;
  actorId: string;
  actorName?: string;
  actorPhotoURL?: string;
  type: NotificationType;
  postId?: string | null;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<Notification>,
  ) {}

  /**
   * Crée une notification. Ne notifie jamais l'utilisateur de sa propre action,
   * et n'échoue jamais bruyamment (l'action principale ne doit pas casser).
   */
  async create(input: CreateNotificationInput): Promise<void> {
    const recipientId = `${input.recipientId || ''}`.trim();
    const actorId = `${input.actorId || ''}`.trim();

    if (
      !recipientId ||
      !actorId ||
      recipientId === actorId ||
      !Types.ObjectId.isValid(recipientId) ||
      !Types.ObjectId.isValid(actorId)
    ) {
      return;
    }

    try {
      await this.notificationModel.create({
        recipientId: new Types.ObjectId(recipientId),
        actorId: new Types.ObjectId(actorId),
        actorName: input.actorName || '',
        actorPhotoURL: input.actorPhotoURL || '',
        type: input.type,
        postId:
          input.postId && Types.ObjectId.isValid(input.postId)
            ? new Types.ObjectId(input.postId)
            : null,
        read: false,
      });
    } catch (error) {
      this.logger.warn(
        `Échec de création de notification: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async list(recipientId: string, limit = 30, page = 1) {
    const safeLimit = Math.min(Math.max(limit, 1), 50);
    const safePage = Math.max(page, 1);
    const skip = (safePage - 1) * safeLimit;

    const docs = await this.notificationModel
      .find({ recipientId: new Types.ObjectId(recipientId) })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .exec();

    return docs.map((doc) => this.toResponse(doc));
  }

  async unreadCount(recipientId: string): Promise<number> {
    return this.notificationModel
      .countDocuments({
        recipientId: new Types.ObjectId(recipientId),
        read: false,
      })
      .exec();
  }

  async markAllRead(recipientId: string): Promise<void> {
    await this.notificationModel
      .updateMany(
        { recipientId: new Types.ObjectId(recipientId), read: false },
        { $set: { read: true } },
      )
      .exec();
  }

  private toResponse(doc: NotificationDocument) {
    return {
      id: doc._id.toString(),
      type: doc.type,
      actorId: doc.actorId.toString(),
      actorName: doc.actorName,
      actorPhotoURL: doc.actorPhotoURL,
      postId: doc.postId ? doc.postId.toString() : null,
      read: doc.read,
      createdAt: doc.createdAt,
    };
  }
}
