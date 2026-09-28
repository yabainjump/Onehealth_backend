import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import type { HubSourceSystem } from '../hub.constants';

@Schema({
  collection: 'hub_data_quality_issues',
  timestamps: true,
  versionKey: false,
})
export class HubDataQualityIssue {
  createdAt: Date;
  updatedAt: Date;

  @Prop({ required: true, unique: true, trim: true, index: true })
  issueId: string;

  @Prop({ required: true, trim: true, index: true })
  batchId: string;

  @Prop({ required: true, min: 1 })
  rowNumber: number;

  @Prop({ default: '', trim: true, maxlength: 120 })
  sourceRecordId: string;

  @Prop({ required: true, uppercase: true, length: 2, index: true })
  countryCode: string;

  @Prop({
    type: String,
    required: true,
    enum: ['DHIS2', 'ARIS 3', 'CAPC-AC'],
    index: true,
  })
  sourceSystem: HubSourceSystem;

  @Prop({ required: true, trim: true, maxlength: 64, index: true })
  code: string;

  @Prop({ required: true, trim: true, maxlength: 80 })
  field: string;

  @Prop({ required: true, trim: true, maxlength: 300 })
  message: string;

  @Prop({
    type: String,
    required: true,
    enum: ['ERROR', 'WARNING'],
    index: true,
  })
  severity: 'ERROR' | 'WARNING';

  @Prop({
    type: String,
    required: true,
    enum: ['OPEN', 'RESOLVED', 'DISMISSED'],
    default: 'OPEN',
    index: true,
  })
  status: 'OPEN' | 'RESOLVED' | 'DISMISSED';

  @Prop({ type: Boolean, required: true, default: true, index: true })
  isDemo: true;
}

export type HubDataQualityIssueDocument = HydratedDocument<HubDataQualityIssue>;
export const HubDataQualityIssueSchema =
  SchemaFactory.createForClass(HubDataQualityIssue);
HubDataQualityIssueSchema.index({ countryCode: 1, status: 1, createdAt: -1 });
HubDataQualityIssueSchema.index({ batchId: 1, rowNumber: 1 });
