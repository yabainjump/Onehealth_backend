import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export const LEASE_NAMESPACES = ['rudolf-conversation'] as const;
export type LeaseNamespace = (typeof LEASE_NAMESPACES)[number];
export type DistributedLeaseDocument = HydratedDocument<DistributedLease>;

@Schema({
  collection: 'coordination_distributed_leases',
  timestamps: true,
  versionKey: false,
})
export class DistributedLease {
  @Prop({ required: true, type: String })
  _id!: string;

  @Prop({ required: true, enum: LEASE_NAMESPACES, type: String })
  namespace!: LeaseNamespace;

  @Prop({ required: true, match: /^[a-f0-9]{64}$/ })
  resourceHash!: string;

  @Prop({ required: true, match: /^[a-f0-9]{64}$/ })
  ownerToken!: string;

  @Prop({ required: true, minlength: 1, maxlength: 96 })
  instanceId!: string;

  @Prop({ required: true, type: Date })
  acquiredAt!: Date;

  @Prop({ required: true, type: Date })
  expiresAt!: Date;

  createdAt!: Date;
  updatedAt!: Date;
}

export const DistributedLeaseSchema =
  SchemaFactory.createForClass(DistributedLease);

DistributedLeaseSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
