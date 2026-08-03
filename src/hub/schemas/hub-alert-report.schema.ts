import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import type { HubReportStatus, HubSector } from '../hub.constants';

@Schema({
  collection: 'hub_alert_reports',
  timestamps: true,
  versionKey: false,
})
export class HubAlertReport {
  @Prop({ required: true, unique: true, trim: true, index: true })
  reportId: string;

  @Prop({ required: true, trim: true, index: true })
  alertCode: string;

  @Prop({ required: true, trim: true, index: true })
  observationId: string;

  @Prop({ required: true, uppercase: true, length: 2, index: true })
  countryCode: string;

  @Prop({ required: true, min: 1 })
  version: number;

  @Prop({
    type: String,
    required: true,
    enum: ['DRAFT', 'IN_REVIEW', 'VALIDATED', 'PUBLISHED'],
    default: 'DRAFT',
    index: true,
  })
  status: HubReportStatus;

  @Prop({ required: true, trim: true, maxlength: 220 })
  title: string;

  @Prop({ required: true, trim: true, maxlength: 3000 })
  executiveSummary: string;

  @Prop({ type: [String], default: [] })
  findings: string[];

  @Prop({ type: [String], default: [] })
  recommendations: string[];

  @Prop({ type: [String], default: [] })
  sources: string[];

  @Prop({
    type: [String],
    enum: ['human', 'animal', 'environment'],
    default: [],
  })
  sectors: HubSector[];

  @Prop({ required: true, trim: true })
  generatedBy: string;

  @Prop({ required: true })
  generatedAt: Date;

  @Prop({ default: '', trim: true })
  validatedBy: string;

  @Prop({ type: Date, default: null })
  validatedAt: Date | null;

  @Prop({ default: '', trim: true })
  publishedBy: string;

  @Prop({ type: Date, default: null })
  publishedAt: Date | null;

  @Prop({ required: true, default: true, index: true })
  isDemo: boolean;
}

export type HubAlertReportDocument = HydratedDocument<HubAlertReport>;
export const HubAlertReportSchema =
  SchemaFactory.createForClass(HubAlertReport);
HubAlertReportSchema.index({ alertCode: 1, version: 1 }, { unique: true });
