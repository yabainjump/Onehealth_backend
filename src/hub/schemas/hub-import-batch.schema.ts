import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import type { HubImportFormat } from '../ingestion/hub-import.constants';
import type { HubSourceSystem } from '../hub.constants';

export type HubImportBatchStatus =
  | 'PREVIEW'
  | 'INGESTING'
  | 'COMPLETED'
  | 'FAILED';

@Schema({
  collection: 'hub_import_batches',
  timestamps: true,
  versionKey: false,
})
export class HubImportBatch {
  createdAt: Date;
  updatedAt: Date;

  @Prop({ required: true, unique: true, trim: true, index: true })
  batchId: string;

  @Prop({ required: true, trim: true, index: true })
  actorId: string;

  @Prop({ required: true, trim: true, maxlength: 120 })
  fileName: string;

  @Prop({ type: String, required: true, enum: ['CSV', 'JSON', 'GEOJSON'] })
  format: HubImportFormat;

  @Prop({
    type: String,
    required: true,
    enum: ['DHIS2', 'ARIS 3', 'CAPC-AC'],
    index: true,
  })
  sourceSystem: HubSourceSystem;

  @Prop({ required: true, trim: true, maxlength: 64 })
  sourceInstance: string;

  @Prop({ required: true, uppercase: true, length: 2, index: true })
  countryCode: string;

  @Prop({ required: true, trim: true, maxlength: 80 })
  sharingPolicyId: string;

  @Prop({ required: true, trim: true, length: 64 })
  contentSha256: string;

  @Prop({ required: true, trim: true })
  mappingVersion: string;

  @Prop({ type: [Object], default: [] })
  mapping: Array<{ sourceField: string; targetField: string }>;

  @Prop({ type: [Object], default: [], select: false })
  candidates: Array<Record<string, unknown>>;

  @Prop({ required: true, min: 0 })
  totalRecords: number;

  @Prop({ required: true, min: 0 })
  acceptedRecords: number;

  @Prop({ required: true, min: 0 })
  rejectedRecords: number;

  @Prop({ required: true, min: 0, default: 0 })
  duplicateRecords: number;

  @Prop({
    type: String,
    required: true,
    enum: ['PREVIEW', 'INGESTING', 'COMPLETED', 'FAILED'],
    index: true,
  })
  status: HubImportBatchStatus;

  @Prop({ type: Boolean, required: true, default: true, index: true })
  isDemo: true;

  @Prop({ required: true, index: { expires: 0 } })
  expiresAt: Date;

  @Prop({ type: Date, default: null })
  confirmedAt: Date | null;

  @Prop({ default: '', trim: true, maxlength: 64 })
  failureCode: string;
}

export type HubImportBatchDocument = HydratedDocument<HubImportBatch>;
export const HubImportBatchSchema =
  SchemaFactory.createForClass(HubImportBatch);
HubImportBatchSchema.index({ countryCode: 1, createdAt: -1 });
HubImportBatchSchema.index({ actorId: 1, contentSha256: 1, status: 1 });
