import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ collection: 'hub_audit_logs', timestamps: true, versionKey: false })
export class HubAuditLog {
  @Prop({ type: String, default: null, index: { unique: true, sparse: true } })
  auditKey: string | null;

  @Prop({ type: String, required: true, trim: true, index: true })
  entityType:
    | 'observation'
    | 'signal'
    | 'alert'
    | 'connector'
    | 'sharing-policy'
    | 'seed'
    | 'scenario'
    | 'report';

  @Prop({ required: true, trim: true, index: true })
  entityId: string;

  @Prop({ required: true, trim: true, maxlength: 80 })
  action: string;

  @Prop({ required: true, trim: true, index: true })
  actorId: string;

  @Prop({ type: String, required: true, enum: ['USER', 'SYSTEM'] })
  actorType: 'USER' | 'SYSTEM';

  @Prop({ type: Object, default: {} })
  metadata: Record<string, unknown>;

  @Prop({ required: true, uppercase: true, length: 2, index: true })
  countryCode: string;

  @Prop({ required: true, default: true, index: true })
  isDemo: boolean;
}

export type HubAuditLogDocument = HydratedDocument<HubAuditLog>;
export const HubAuditLogSchema = SchemaFactory.createForClass(HubAuditLog);

HubAuditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
