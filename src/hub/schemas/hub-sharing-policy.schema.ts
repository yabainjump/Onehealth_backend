import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { HubRole } from '../../users/schemas/user.schema';

export type HubSharingLevel =
  | 'OWNER_ONLY'
  | 'OWNER_AND_CEEAC'
  | 'AUTHORIZED_COUNTRIES'
  | 'REGIONAL_AUTHORIZED'
  | 'PUBLIC_AGGREGATED';

@Schema({
  collection: 'hub_sharing_policies',
  timestamps: true,
  versionKey: false,
})
export class HubSharingPolicy {
  @Prop({ required: true, unique: true, trim: true, index: true })
  policyId: string;

  @Prop({ required: true, uppercase: true, length: 2, index: true })
  countryOwner: string;

  @Prop({
    type: String,
    required: true,
    enum: [
      'OWNER_ONLY',
      'OWNER_AND_CEEAC',
      'AUTHORIZED_COUNTRIES',
      'REGIONAL_AUTHORIZED',
      'PUBLIC_AGGREGATED',
    ],
  })
  sharingLevel: HubSharingLevel;

  @Prop({ type: [String], enum: Object.values(HubRole), default: [] })
  allowedRoles: HubRole[];

  @Prop({ type: [String], default: [] })
  allowedCountries: string[];

  @Prop({
    type: String,
    required: true,
    enum: ['POINT', 'ADMIN_1', 'COUNTRY', 'REGIONAL'],
  })
  aggregationLevel: 'POINT' | 'ADMIN_1' | 'COUNTRY' | 'REGIONAL';

  @Prop({ required: true, min: 1, max: 3650 })
  retentionPeriodDays: number;

  @Prop({ required: true, default: false })
  containsPersonalData: boolean;

  @Prop({ required: true, default: true })
  isDemo: boolean;
}

export type HubSharingPolicyDocument = HydratedDocument<HubSharingPolicy>;
export const HubSharingPolicySchema =
  SchemaFactory.createForClass(HubSharingPolicy);
