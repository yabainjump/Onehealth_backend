import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import type {
  HubObservationStage,
  HubRiskLevel,
  HubSector,
  HubSourceSystem,
} from '../hub.constants';

@Schema({ _id: false })
export class HubObservationMetric {
  @Prop({ required: true, trim: true, maxlength: 120 })
  label: string;

  @Prop({ required: true, type: Number })
  value: number;

  @Prop({ default: '', trim: true, maxlength: 30 })
  unit: string;
}

const HubObservationMetricSchema =
  SchemaFactory.createForClass(HubObservationMetric);

@Schema({ _id: false })
export class HubGeoPoint {
  @Prop({ type: String, required: true, enum: ['Point'], default: 'Point' })
  type: 'Point';

  @Prop({ type: [Number], required: true })
  coordinates: [number, number];
}

const HubGeoPointSchema = SchemaFactory.createForClass(HubGeoPoint);

@Schema({ collection: 'hub_observations', timestamps: true, versionKey: false })
export class HubObservation {
  @Prop({ required: true, unique: true, trim: true, index: true })
  canonicalId: string;

  @Prop({
    type: String,
    required: true,
    enum: ['DHIS2', 'ARIS 3', 'CAPC-AC'],
    index: true,
  })
  sourceSystem: HubSourceSystem;

  @Prop({ required: true, default: 'demo-ceeac' })
  sourceInstance: string;

  @Prop({ required: true, trim: true })
  sourceRecordId: string;

  @Prop({
    type: String,
    required: true,
    enum: ['human', 'animal', 'environment'],
    index: true,
  })
  sector: HubSector;

  @Prop({ required: true, uppercase: true, length: 2, index: true })
  countryCode: string;

  @Prop({ required: true, trim: true })
  countryName: string;

  @Prop({ required: true, trim: true })
  adminArea: string;

  @Prop({ type: HubGeoPointSchema, required: true })
  location: { type: 'Point'; coordinates: [number, number] };

  @Prop({ required: true, index: true })
  observedAt: Date;

  @Prop({ required: true })
  receivedAt: Date;

  @Prop({ required: true, trim: true, maxlength: 120 })
  category: string;

  @Prop({ required: true, trim: true, maxlength: 180 })
  title: string;

  @Prop({ required: true, trim: true, maxlength: 1000 })
  summary: string;

  @Prop({
    type: String,
    required: true,
    enum: ['observation', 'signal', 'verified-alert'],
    default: 'observation',
    index: true,
  })
  stage: HubObservationStage;

  @Prop({
    type: String,
    required: true,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'low',
    index: true,
  })
  severity: HubRiskLevel;

  @Prop({ type: [HubObservationMetricSchema], default: [] })
  metrics: HubObservationMetric[];

  @Prop({ required: true, trim: true, index: true })
  sharingPolicyId: string;

  @Prop({ required: true, default: true, index: true })
  isDemo: boolean;

  @Prop({ required: true, trim: true, index: true })
  scenarioId: string;
}

export type HubObservationDocument = HydratedDocument<HubObservation>;
export const HubObservationSchema =
  SchemaFactory.createForClass(HubObservation);

HubObservationSchema.index({ location: '2dsphere' });
HubObservationSchema.index({ countryCode: 1, observedAt: -1 });
HubObservationSchema.index({ sector: 1, observedAt: -1 });
HubObservationSchema.index(
  { sourceSystem: 1, sourceInstance: 1, countryCode: 1, sourceRecordId: 1 },
  { unique: true },
);
