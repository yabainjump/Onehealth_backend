import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type HubIngestionRunStatus = 'SUCCESS' | 'PARTIAL' | 'FAILED';

@Schema({
  collection: 'hub_ingestion_runs',
  timestamps: true,
  versionKey: false,
})
export class HubIngestionRun {
  @Prop({ required: true, unique: true, trim: true, index: true })
  runId: string;

  @Prop({ required: true, trim: true, index: true })
  connectorId: string;

  @Prop({ required: true, uppercase: true, length: 2, index: true })
  countryCode: string;

  @Prop({
    type: String,
    required: true,
    enum: ['SUCCESS', 'PARTIAL', 'FAILED'],
    index: true,
  })
  status: HubIngestionRunStatus;

  @Prop({ required: true })
  startedAt: Date;

  @Prop({ required: true })
  completedAt: Date;

  @Prop({ required: true, min: 0 })
  recordsReceived: number;

  @Prop({ required: true, min: 0 })
  recordsAccepted: number;

  @Prop({ required: true, min: 0 })
  recordsRejected: number;

  @Prop({ required: true, min: 0 })
  duplicateRecords: number;

  @Prop({ required: true, min: 0 })
  durationMs: number;

  @Prop({ type: String, required: true, enum: ['SYSTEM', 'USER'] })
  triggeredBy: 'SYSTEM' | 'USER';

  @Prop({ required: true, trim: true })
  actorId: string;

  @Prop({ default: '', trim: true, maxlength: 64 })
  errorCode: string;

  @Prop({ required: true, default: true, index: true })
  isDemo: boolean;
}

export type HubIngestionRunDocument = HydratedDocument<HubIngestionRun>;
export const HubIngestionRunSchema =
  SchemaFactory.createForClass(HubIngestionRun);

HubIngestionRunSchema.index({ connectorId: 1, startedAt: -1 });
