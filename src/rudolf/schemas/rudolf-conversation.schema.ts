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
    unique: true,
    index: true,
  })
  userId: Types.ObjectId;

  @Prop({ type: [RudolfMessageSchema], default: [] })
  messages: RudolfMessage[];

  createdAt: Date;
  updatedAt: Date;
}

export type RudolfConversationDocument = HydratedDocument<RudolfConversation>;
export const RudolfConversationSchema =
  SchemaFactory.createForClass(RudolfConversation);

// Minimise la conservation des données : une conversation inactive est
// automatiquement supprimée par MongoDB après 180 jours.
RudolfConversationSchema.index(
  { updatedAt: 1 },
  { expireAfterSeconds: 180 * 24 * 60 * 60 },
);
