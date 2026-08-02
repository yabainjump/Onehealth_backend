import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import type {
  HubConnectorProtocol,
  HubConnectorStatus,
  HubSector,
  HubSourceSystem,
} from '../hub.constants';

@Schema({
  collection: 'hub_connectors',
  timestamps: true,
  versionKey: false,
})
export class HubConnector {
  @Prop({ required: true, unique: true, trim: true, index: true })
  connectorId: string;

  @Prop({ required: true, uppercase: true, length: 2, index: true })
  countryCode: string;

  @Prop({ required: true, trim: true })
  countryName: string;

  @Prop({ required: true, trim: true, maxlength: 120 })
  institution: string;

  @Prop({
    type: String,
    required: true,
    enum: ['human', 'animal', 'environment'],
    index: true,
  })
  sector: HubSector;

  @Prop({
    type: String,
    required: true,
    enum: ['DHIS2', 'ARIS 3', 'CAPC-AC'],
    index: true,
  })
  sourceSystem: HubSourceSystem;

  @Prop({
    type: String,
    required: true,
    enum: ['API_REST', 'SYNC', 'PUSH_SFTP', 'GEOJSON'],
  })
  protocol: HubConnectorProtocol;

  // Alias non sensible destiné à l'interface. Les URL réelles et secrets
  // restent dans la configuration sécurisée de l'environnement d'exécution.
  @Prop({ required: true, trim: true, maxlength: 120 })
  endpointAlias: string;

  @Prop({
    type: String,
    required: true,
    enum: ['operational', 'degraded', 'error', 'suspended'],
    index: true,
  })
  status: HubConnectorStatus;

  @Prop({ required: true, min: 0, max: 100 })
  availabilityPercent: number;

  @Prop({ type: Date, default: null })
  lastSyncAt: Date | null;

  @Prop({ type: Date, default: null })
  lastSuccessAt: Date | null;

  @Prop({ type: Date, default: null })
  nextSyncAt: Date | null;

  @Prop({ required: true, min: 0, default: 0 })
  recordsReceived: number;

  @Prop({ required: true, min: 0, default: 0 })
  recordsAccepted: number;

  @Prop({ required: true, min: 0, default: 0 })
  recordsRejected: number;

  @Prop({ required: true, min: 0, default: 0 })
  duplicateRecords: number;

  @Prop({ required: true, min: 0, default: 0 })
  lastDurationMs: number;

  @Prop({ default: '', trim: true, maxlength: 64 })
  lastErrorCode: string;

  @Prop({ default: '', trim: true, maxlength: 300 })
  lastErrorMessage: string;

  @Prop({ required: true, default: true })
  enabled: boolean;

  @Prop({ required: true, default: true, index: true })
  isDemo: boolean;
}

export type HubConnectorDocument = HydratedDocument<HubConnector>;
export const HubConnectorSchema = SchemaFactory.createForClass(HubConnector);

HubConnectorSchema.index({ countryCode: 1, sourceSystem: 1 }, { unique: true });
HubConnectorSchema.index({ sector: 1, status: 1, countryCode: 1 });
