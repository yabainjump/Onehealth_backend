import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import {
  CEEAC_COUNTRY_CODES,
  type HubScenarioStatus,
  type HubSector,
  type HubSourceSystem,
} from '../hub.constants';
import {
  HUB_SCENARIO_ANALYSIS_TYPE,
  HUB_SCENARIO_SECTORS,
  HUB_SCENARIO_SOURCE_SYSTEMS,
} from '../scenarios/hub-scenario-configuration';

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

@Schema({ _id: false })
export class HubScenarioConfiguration {
  @Prop({ required: true, enum: CEEAC_COUNTRY_CODES })
  sourceCountryCode: string;

  @Prop({ required: true, enum: CEEAC_COUNTRY_CODES })
  comparisonCountryCode: string;

  @Prop({ required: true, trim: true, minlength: 10, maxlength: 10 })
  dateFrom: string;

  @Prop({ required: true, trim: true, minlength: 10, maxlength: 10 })
  dateTo: string;

  @Prop({ type: [String], enum: HUB_SCENARIO_SECTORS, default: [] })
  sectors: HubSector[];

  @Prop({ type: [String], enum: HUB_SCENARIO_SOURCE_SYSTEMS, default: [] })
  sourceSystems: HubSourceSystem[];

  @Prop({ type: String, required: true, enum: [HUB_SCENARIO_ANALYSIS_TYPE] })
  analysisType: typeof HUB_SCENARIO_ANALYSIS_TYPE;
}

const HubScenarioConfigurationSchema = SchemaFactory.createForClass(
  HubScenarioConfiguration,
);

@Schema({ _id: false })
export class HubScenarioReportCountry {
  @Prop({ required: true, trim: true, minlength: 2, maxlength: 2 })
  countryCode: string;

  @Prop({ required: true, trim: true, maxlength: 100 })
  countryName: string;
}

const HubScenarioReportCountrySchema = SchemaFactory.createForClass(
  HubScenarioReportCountry,
);

@Schema({ _id: false })
export class HubScenarioSimulationReport {
  @Prop({ required: true, trim: true, maxlength: 100 })
  reportId: string;

  @Prop({ required: true, enum: ['SIMULATION'] })
  reportType: 'SIMULATION';

  @Prop({ required: true, trim: true, maxlength: 200 })
  title: string;

  @Prop({ required: true, trim: true, maxlength: 2500 })
  executiveSummary: string;

  @Prop({ required: true, trim: true, maxlength: 1000 })
  objective: string;

  @Prop({ type: [HubScenarioReportCountrySchema], default: [] })
  countries: HubScenarioReportCountry[];

  @Prop({
    type: [String],
    enum: ['human', 'animal', 'environment'],
    default: [],
  })
  sectors: ('human' | 'animal' | 'environment')[];

  @Prop({ type: [String], default: [] })
  sourceSystems: string[];

  @Prop({ required: true, min: 0 })
  observationCount: number;

  @Prop({ required: true, min: 0 })
  signalCount: number;

  @Prop({ required: true, min: 0 })
  eventCount: number;

  @Prop({ required: true, min: 0, max: 1 })
  confidenceScore: number;

  @Prop({ type: [String], default: [] })
  findings: string[];

  @Prop({ type: [String], default: [] })
  recommendations: string[];

  @Prop({ type: [String], default: [] })
  limitations: string[];

  @Prop({ type: [String], default: [] })
  observationIds: string[];

  @Prop({ required: true, trim: true })
  signalCode: string;

  @Prop({ required: true, trim: true })
  eventCode: string;

  @Prop({ required: true })
  generatedAt: Date;

  @Prop({ required: true, default: false })
  official: false;

  @Prop({ required: true, default: true })
  simulated: true;
}

const HubScenarioSimulationReportSchema = SchemaFactory.createForClass(
  HubScenarioSimulationReport,
);

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

  @Prop({ type: HubScenarioConfigurationSchema, default: null })
  configuration: HubScenarioConfiguration | null;

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

  @Prop({ type: HubScenarioSimulationReportSchema, default: null })
  simulationReport: HubScenarioSimulationReport | null;

  @Prop({ required: true, default: true, index: true })
  isDemo: boolean;
}

export type HubScenarioRunDocument = HydratedDocument<HubScenarioRun>;
export const HubScenarioRunSchema =
  SchemaFactory.createForClass(HubScenarioRun);
