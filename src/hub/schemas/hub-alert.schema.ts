import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import type { HubRiskLevel } from '../hub.constants';

@Schema({ collection: 'hub_alerts', timestamps: true, versionKey: false })
export class HubAlert {
  @Prop({ required: true, unique: true, trim: true, index: true })
  alertCode: string;

  @Prop({ required: true, unique: true, trim: true, index: true })
  signalCode: string;

  @Prop({ required: true, unique: true, trim: true, index: true })
  observationId: string;

  @Prop({ required: true, trim: true, maxlength: 180 })
  title: string;

  @Prop({ required: true, trim: true, maxlength: 1500 })
  summary: string;

  @Prop({
    type: String,
    required: true,
    enum: ['low', 'medium', 'high', 'critical'],
  })
  riskLevel: HubRiskLevel;

  @Prop({ required: true, uppercase: true, length: 2, index: true })
  countryCode: string;

  @Prop({
    type: String,
    required: true,
    enum: ['VERIFIED', 'CLOSED'],
    default: 'VERIFIED',
  })
  status: 'VERIFIED' | 'CLOSED';

  @Prop({ required: true, trim: true })
  verifiedBy: string;

  @Prop({ required: true })
  verifiedAt: Date;

  @Prop({ required: true, trim: true, maxlength: 1000 })
  verificationNote: string;

  @Prop({ required: true, trim: true, index: true })
  sharingPolicyId: string;

  @Prop({ required: true, default: true, index: true })
  isDemo: boolean;
}

export type HubAlertDocument = HydratedDocument<HubAlert>;
export const HubAlertSchema = SchemaFactory.createForClass(HubAlert);

HubAlertSchema.index({ countryCode: 1, verifiedAt: -1 });
