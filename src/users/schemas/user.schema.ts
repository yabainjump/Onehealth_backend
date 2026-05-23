import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
}

@Schema({
  collection: 'users',
  timestamps: true,
  versionKey: false,
})
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true, select: false })
  passwordHash: string;

  @Prop({ default: '', select: false })
  passwordResetTokenHash: string;

  @Prop({ type: Date, default: null, select: false })
  passwordResetExpiresAt: Date | null;

  @Prop({ type: Date, default: null, select: false })
  passwordResetRequestedAt: Date | null;

  @Prop({ required: true, trim: true, minlength: 3, maxlength: 40 })
  username: string;

  @Prop({ required: true, trim: true })
  firstName: string;

  @Prop({ required: true, trim: true })
  lastName: string;

  @Prop({ required: true, trim: true })
  institution: string;

  @Prop({ default: '' })
  typeMedecin: string;

  @Prop({ default: '' })
  country: string;

  @Prop({ default: '' })
  city: string;

  @Prop({ default: '' })
  phone: string;

  @Prop({ default: '' })
  bio: string;

  @Prop({ default: '' })
  photoURL: string;

  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
  followers: Types.ObjectId[];

  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
  following: Types.ObjectId[];

  @Prop({ type: String, enum: UserRole, default: UserRole.USER })
  role: UserRole;

  @Prop({ type: Boolean, default: false })
  isOnline: boolean;

  @Prop({ type: Date, default: Date.now })
  lastSeenAt: Date;

  createdAt: Date;
  updatedAt: Date;
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);

