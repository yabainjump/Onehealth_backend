import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({
  collection: 'chat_messages',
  timestamps: true,
  versionKey: false,
})
export class ChatMessage {
  @Prop({ type: Types.ObjectId, ref: 'ChatRoom', required: true, index: true })
  roomId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  senderId: Types.ObjectId;

  @Prop({ default: '', trim: true, maxlength: 1000 })
  text: string;

  @Prop({ default: '' })
  imageUrl: string;

  @Prop({ default: '' })
  fileUrl: string;

  @Prop({ default: '' })
  fileName: string;

  @Prop({ default: '' })
  fileMimeType: string;

  @Prop({ type: Number, default: 0, min: 0 })
  fileSize: number;

  @Prop({
    type: [{ type: Types.ObjectId, ref: 'User' }],
    default: [],
  })
  readBy: Types.ObjectId[];

  createdAt: Date;
  updatedAt: Date;
}

export type ChatMessageDocument = HydratedDocument<ChatMessage>;
export const ChatMessageSchema = SchemaFactory.createForClass(ChatMessage);

ChatMessageSchema.index({ roomId: 1, createdAt: -1 });
