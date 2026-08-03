import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import type { HubEventStatus, HubSector } from '../hub.constants';

@Schema({ _id: false })
export class HubEventGeoPoint {
  @Prop({ type: String, required: true, enum: ['Point'], default: 'Point' })
  type: 'Point';

  @Prop({ type: [Number], required: true })
  coordinates: [number, number];
}

const HubEventGeoPointSchema = SchemaFactory.createForClass(HubEventGeoPoint);

@Schema({ collection: 'hub_events', timestamps: true, versionKey: false })
export class HubEvent {
  @Prop({ required: true, unique: true, trim: true, index: true })
  eventCode: string;

  @Prop({ required: true, trim: true, maxlength: 220 })
  title: string;

  @Prop({
    type: String,
    required: true,
    enum: ['CONSOLIDATED', 'UNDER_REVIEW', 'CLOSED'],
    index: true,
  })
  status: HubEventStatus;

  @Prop({ type: [String], required: true, index: true })
  observationIds: string[];

  @Prop({ type: [String], required: true, index: true })
  countryCodes: string[];

  @Prop({
    type: [String],
    enum: ['human', 'animal', 'environment'],
    required: true,
  })
  sectors: HubSector[];

  @Prop({ type: HubEventGeoPointSchema, required: true })
  center: { type: 'Point'; coordinates: [number, number] };

  @Prop({ required: true, min: 0 })
  maxDistanceKm: number;

  @Prop({ required: true, min: 0 })
  timeWindowHours: number;

  @Prop({ required: true, min: 0, max: 1, index: true })
  correlationScore: number;

  @Prop({ type: [String], required: true })
  correlationReasons: string[];

  @Prop({ required: true, trim: true })
  ruleVersion: string;

  @Prop({ required: true, trim: true, index: true })
  scenarioId: string;

  @Prop({ required: true })
  firstObservedAt: Date;

  @Prop({ required: true })
  lastObservedAt: Date;

  @Prop({ required: true, trim: true })
  consolidatedBy: string;

  @Prop({ required: true })
  consolidatedAt: Date;

  @Prop({ required: true, default: true, index: true })
  isDemo: boolean;
}

export type HubEventDocument = HydratedDocument<HubEvent>;
export const HubEventSchema = SchemaFactory.createForClass(HubEvent);
HubEventSchema.index({ center: '2dsphere' });
HubEventSchema.index({ countryCodes: 1, lastObservedAt: -1 });
