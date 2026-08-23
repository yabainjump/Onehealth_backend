import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export const RATE_LIMIT_POLICIES = [
  'auth-login',
  'auth-register',
  'auth-google',
  'auth-forgot-password',
  'auth-reset-password',
  'upload',
  'rudolf-short',
  'rudolf-daily',
] as const;

export type RateLimitPolicy = (typeof RATE_LIMIT_POLICIES)[number];
export type RateLimitBucketDocument = HydratedDocument<RateLimitBucket>;

@Schema({
  collection: 'coordination_rate_limit_buckets',
  timestamps: true,
  versionKey: false,
})
export class RateLimitBucket {
  @Prop({ required: true, type: String })
  _id!: string;

  @Prop({ required: true, enum: RATE_LIMIT_POLICIES, type: String })
  policy!: RateLimitPolicy;

  @Prop({ required: true, match: /^[a-f0-9]{64}$/ })
  subjectHash!: string;

  @Prop({ required: true, type: Date })
  windowStartedAt!: Date;

  @Prop({ required: true, type: Date })
  resetAt!: Date;

  @Prop({ required: true, min: 0, type: Number })
  count!: number;

  @Prop({ required: true, min: 1, type: Number })
  limitSnapshot!: number;

  @Prop({ required: true, type: Date })
  expiresAt!: Date;

  createdAt!: Date;
  updatedAt!: Date;
}

export const RateLimitBucketSchema =
  SchemaFactory.createForClass(RateLimitBucket);

RateLimitBucketSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
