import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsEnum, IsIn } from 'class-validator';
import { HubRole } from '../../users/schemas/user.schema';

export const CEEAC_COUNTRY_CODES = [
  'AO',
  'BI',
  'CM',
  'CF',
  'TD',
  'CG',
  'CD',
  'GQ',
  'GA',
  'RW',
  'ST',
] as const;

export class SetHubAccessDto {
  @ApiProperty({ enum: HubRole, isArray: true })
  @IsArray()
  @ArrayMaxSize(4)
  @IsEnum(HubRole, { each: true })
  roles: HubRole[];

  @ApiProperty({ enum: CEEAC_COUNTRY_CODES, isArray: true })
  @IsArray()
  @ArrayMaxSize(CEEAC_COUNTRY_CODES.length)
  @IsIn(CEEAC_COUNTRY_CODES, { each: true })
  countryCodes: string[];
}
