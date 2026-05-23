import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ _id: false })
export class PostComment {
  @Prop({ required: true, index: true })
  commentId: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  authorId: Types.ObjectId;

  @Prop({ required: true, trim: true, minlength: 1, maxlength: 500 })
  text: string;

  @Prop({ type: Number, default: 0, min: 0 })
  likesCount: number;

  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
  likedBy: Types.ObjectId[];

  @Prop({ default: Date.now })
  createdAt: Date;
}

export const PostCommentSchema = SchemaFactory.createForClass(PostComment);

@Schema({ _id: false })
export class PostAttachment {
  @Prop({ required: true, enum: ['video', 'document'] })
  type: 'video' | 'document';

  @Prop({ required: true })
  url: string;

  @Prop({ required: true })
  fileName: string;

  @Prop({ required: true })
  mimeType: string;

  @Prop({ required: true, min: 1, max: 50 * 1024 * 1024 })
  size: number;
}

export const PostAttachmentSchema = SchemaFactory.createForClass(PostAttachment);

@Schema({
  collection: 'posts',
  timestamps: true,
  versionKey: false,
})
export class Post {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  authorId: Types.ObjectId;

  @Prop({ default: '', trim: true, maxlength: 120 })
  title: string;

  @Prop({ required: true, trim: true, minlength: 1, maxlength: 3000 })
  content: string;

  @Prop({ type: [String], default: [] })
  imageUrls: string[];

  @Prop({ type: PostAttachmentSchema, default: null })
  attachment: PostAttachment | null;

  @Prop({ type: Number, default: 0, min: 0 })
  likesCount: number;

  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
  likedBy: Types.ObjectId[];

  @Prop({ type: [PostCommentSchema], default: [] })
  comments: PostComment[];

  createdAt: Date;
  updatedAt: Date;
}

export type PostDocument = HydratedDocument<Post>;
export const PostSchema = SchemaFactory.createForClass(Post);

PostSchema.index({ createdAt: -1 });
PostSchema.index({ authorId: 1, createdAt: -1 });
