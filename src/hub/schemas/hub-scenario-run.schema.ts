import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import type { HubScenarioStatus } from '../hub.constants';

@Schema({ _id: false })
export class HubScenarioStep {
  @Prop({ required: true, trim: true })
  code: string;

  @Prop({ required: true, trim: true, maxlength: 180 })
  label: string;

  @Prop({
    type: String,
    required: true,
    enum: ['PENDING', 'COMPLETED', 'FAILED'],
  })
  status: 'PENDING' | 'COMPLETED' | 'FAILED';

  @Prop({ type: Date, default: null })
  completedAt: Date | null;
}

const HubScenarioStepSchema = SchemaFactory.createForClass(HubScenarioStep);

@Schema({
  collection: 'hub_scenario_runs',
  timestamps: true,
  versionKey: false,
})
export class HubScenarioRun {
  @Prop({ required: true, unique: true, trim: true, index: true })
  scenarioCode: string;

  @Prop({ required: true, trim: true, maxlength: 180 })
  title: string;

  @Prop({ required: true, trim: true, maxlength: 1500 })
  description: string;

  @Prop({
    type: String,
    required: true,
    enum: ['READY', 'RUNNING', 'COMPLETED', 'FAILED'],
    index: true,
  })
  status: HubScenarioStatus;

  @Prop({ type: [HubScenarioStepSchema], default: [] })
  steps: HubScenarioStep[];

  @Prop({ type: [String], default: [] })
  observationIds: string[];

  @Prop({ default: '', trim: true })
  signalCode: string;

  @Prop({ default: '', trim: true })
  eventCode: string;

  @Prop({ required: true, trim: true })
  initiatedBy: string;

  @Prop({ required: true })
  startedAt: Date;

  @Prop({ type: Date, default: null })
  completedAt: Date | null;

  @Prop({ required: true, default: true, index: true })
  isDemo: boolean;
}

export type HubScenarioRunDocument = HydratedDocument<HubScenarioRun>;
export const HubScenarioRunSchema =
  SchemaFactory.createForClass(HubScenarioRun);
