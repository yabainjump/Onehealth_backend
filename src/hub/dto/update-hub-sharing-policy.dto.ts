import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  Max,
  Min,
} from 'class-validator';
import { HubRole } from '../../users/schemas/user.schema';
import { CEEAC_COUNTRY_CODES } from '../hub.constants';
import type { HubSharingLevel } from '../schemas/hub-sharing-policy.schema';

const SHARING_LEVELS: readonly HubSharingLevel[] = [
  'OWNER_ONLY',
  'OWNER_AND_CEEAC',
  'AUTHORIZED_COUNTRIES',
  'REGIONAL_AUTHORIZED',
  'PUBLIC_AGGREGATED',
];

const AGGREGATION_LEVELS = ['POINT', 'ADMIN_1', 'COUNTRY', 'REGIONAL'] as const;

export class UpdateHubSharingPolicyDto {
  @ApiProperty({ enum: SHARING_LEVELS })
  @IsIn(SHARING_LEVELS)
  sharingLevel: HubSharingLevel;

  @ApiProperty({ enum: HubRole, isArray: true })
  @IsArray()
  @ArrayMaxSize(4)
  @IsEnum(HubRole, { each: true })
  allowedRoles: HubRole[];

  @ApiProperty({ enum: CEEAC_COUNTRY_CODES, isArray: true })
  @IsArray()
  @ArrayMaxSize(CEEAC_COUNTRY_CODES.length)
  @IsIn(CEEAC_COUNTRY_CODES, { each: true })
  allowedCountries: string[];

  @ApiProperty({ enum: AGGREGATION_LEVELS })
  @IsIn(AGGREGATION_LEVELS)
  aggregationLevel: (typeof AGGREGATION_LEVELS)[number];

  @ApiProperty({ minimum: 1, maximum: 3650 })
  @IsInt()
  @Min(1)
  @Max(3650)
  retentionPeriodDays: number;

  @ApiProperty()
  @IsBoolean()
  containsPersonalData: boolean;
}
