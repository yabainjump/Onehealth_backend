import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({
  collection: 'chat_rooms',
  timestamps: true,
  versionKey: false,
})
export class ChatRoom {
  @Prop({ type: [Types.ObjectId], ref: 'User', required: true, index: true })
  members: Types.ObjectId[];

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  @Prop({ default: '' })
  lastMessage: string;

  @Prop({ type: Map, of: Number, default: {} })
  unreadCounts: Record<string, number>;

  createdAt: Date;
  updatedAt: Date;
}

export type ChatRoomDocument = HydratedDocument<ChatRoom>;
export const ChatRoomSchema = SchemaFactory.createForClass(ChatRoom);
