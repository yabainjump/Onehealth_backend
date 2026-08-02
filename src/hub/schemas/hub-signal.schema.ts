import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import type { HubRiskLevel, HubSignalStatus } from '../hub.constants';

@Schema({ collection: 'hub_signals', timestamps: true, versionKey: false })
export class HubSignal {
  @Prop({ required: true, unique: true, trim: true, index: true })
  signalCode: string;

  @Prop({ required: true, unique: true, trim: true, index: true })
  observationId: string;

  @Prop({
    type: String,
    required: true,
    enum: ['low', 'medium', 'high', 'critical'],
  })
  riskLevel: HubRiskLevel;

  @Prop({ required: true, min: 0, max: 1 })
  confidenceScore: number;

  @Prop({ required: true, trim: true, maxlength: 1500 })
  explanation: string;

  @Prop({
    type: String,
    required: true,
    enum: [
      'SIGNAL_DETECTED',
      'UNDER_VERIFICATION',
      'VERIFIED',
      'REJECTED',
      'CLOSED',
    ],
    default: 'SIGNAL_DETECTED',
    index: true,
  })
  status: HubSignalStatus;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null, index: true })
  assignedTo: Types.ObjectId | null;

  @Prop({ required: true })
  detectedAt: Date;

  @Prop({ type: Date, default: null })
  reviewStartedAt: Date | null;

  @Prop({ type: Date, default: null })
  decidedAt: Date | null;

  @Prop({ default: '', trim: true, maxlength: 1000 })
  decisionNote: string;

  @Prop({ required: true, uppercase: true, length: 2, index: true })
  countryCode: string;

  @Prop({ required: true, trim: true, index: true })
  sharingPolicyId: string;

  @Prop({ required: true, default: true, index: true })
  isDemo: boolean;
}

export type HubSignalDocument = HydratedDocument<HubSignal>;
export const HubSignalSchema = SchemaFactory.createForClass(HubSignal);

HubSignalSchema.index({ countryCode: 1, status: 1, detectedAt: -1 });
