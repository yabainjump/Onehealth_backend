import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type NotificationType = 'like' | 'comment' | 'follow' | 'alert';

@Schema({
  collection: 'notifications',
  timestamps: true,
  versionKey: false,
})
export class Notification {
  // Destinataire de la notification.
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  recipientId: Types.ObjectId;

  // Auteur de l'action (celui qui a aimé / commenté / suivi).
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  actorId: Types.ObjectId;

  // Instantané de l'acteur au moment de l'action (évite une jointure à la lecture).
  @Prop({ default: '' })
  actorName: string;

  @Prop({ default: '' })
  actorPhotoURL: string;

  @Prop({ required: true, enum: ['like', 'comment', 'follow', 'alert'] })
  type: NotificationType;

  // Publication concernée (pour like / comment ; null sinon).
  @Prop({ type: Types.ObjectId, ref: 'Post', default: null })
  postId: Types.ObjectId | null;

  // Alerte concernée (pour le type 'alert' ; null sinon).
  @Prop({ type: Types.ObjectId, ref: 'Alert', default: null })
  alertId: Types.ObjectId | null;

  @Prop({ default: false })
  read: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export type NotificationDocument = HydratedDocument<Notification>;
export const NotificationSchema = SchemaFactory.createForClass(Notification);

// Index pour le listing (les plus récentes) et le compteur de non-lues.
NotificationSchema.index({ recipientId: 1, createdAt: -1 });
NotificationSchema.index({ recipientId: 1, read: 1 });
