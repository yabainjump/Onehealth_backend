import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type RudolfMessageRole = 'user' | 'assistant';

@Schema({ _id: false, versionKey: false })
export class RudolfMessage {
  @Prop({ required: true, enum: ['user', 'assistant'] })
  role: RudolfMessageRole;

  @Prop({ required: true, maxlength: 12_000 })
  content: string;

  @Prop({ required: true, default: Date.now })
  createdAt: Date;
}

export const RudolfMessageSchema = SchemaFactory.createForClass(RudolfMessage);

@Schema({
  collection: 'rudolf_conversations',
  timestamps: true,
  versionKey: false,
})
export class RudolfConversation {
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
  })
  userId: Types.ObjectId;

  @Prop({
    required: true,
    trim: true,
    maxlength: 80,
    default: 'Conversation One Health',
  })
  title: string;

  @Prop({ type: [RudolfMessageSchema], default: [] })
  messages: RudolfMessage[];

  @Prop({ type: Date, default: Date.now })
  lastMessageAt: Date;

  createdAt: Date;
  updatedAt: Date;
}

export type RudolfConversationDocument = HydratedDocument<RudolfConversation>;
export const RudolfConversationSchema =
  SchemaFactory.createForClass(RudolfConversation);

RudolfConversationSchema.index({ userId: 1, updatedAt: -1 });

// Minimise la conservation des données : une conversation inactive est
// automatiquement supprimée par MongoDB après 180 jours.
RudolfConversationSchema.index(
  { updatedAt: 1 },
  { expireAfterSeconds: 180 * 24 * 60 * 60 },
);
