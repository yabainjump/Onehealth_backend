import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import type { HubSourceSystem } from '../hub.constants';

@Schema({ collection: 'hub_raw_records', timestamps: true, versionKey: false })
export class HubRawRecord {
  @Prop({
    type: String,
    required: true,
    enum: ['DHIS2', 'ARIS 3', 'CAPC-AC'],
  })
  sourceSystem: HubSourceSystem;

  @Prop({ required: true, trim: true })
  sourceInstance: string;

  @Prop({ required: true, trim: true })
  sourceRecordId: string;

  @Prop({ required: true, uppercase: true, length: 2 })
  countryCode: string;

  @Prop({ type: Object, required: true })
  payload: Record<string, unknown>;

  @Prop({ required: true, trim: true, length: 64 })
  checksum: string;

  @Prop({ required: true, default: '1.0' })
  schemaVersion: string;

  @Prop({ required: true })
  receivedAt: Date;

  @Prop({ required: true, trim: true })
  ingestionRunId: string;

  @Prop({ required: true, trim: true })
  sharingPolicyId: string;

  @Prop({ required: true, default: true })
  isDemo: boolean;

  @Prop({ required: true, trim: true })
  scenarioId: string;
}

export type HubRawRecordDocument = HydratedDocument<HubRawRecord>;
export const HubRawRecordSchema = SchemaFactory.createForClass(HubRawRecord);

HubRawRecordSchema.index(
  { sourceSystem: 1, sourceInstance: 1, countryCode: 1, sourceRecordId: 1 },
  { unique: true },
);
