import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { CEEAC_COUNTRY_CODES } from '../hub.constants';

export class ListHubConnectorsDto {
  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: CEEAC_COUNTRY_CODES })
  @IsOptional()
  @IsIn(CEEAC_COUNTRY_CODES)
  countryCode?: string;

  @ApiPropertyOptional({ enum: ['human', 'animal', 'environment'] })
  @IsOptional()
  @IsIn(['human', 'animal', 'environment'])
  sector?: 'human' | 'animal' | 'environment';

  @ApiPropertyOptional({
    enum: ['operational', 'degraded', 'error', 'suspended'],
  })
  @IsOptional()
  @IsIn(['operational', 'degraded', 'error', 'suspended'])
  status?: 'operational' | 'degraded' | 'error' | 'suspended';

  @ApiPropertyOptional({ enum: ['DHIS2', 'ARIS 3', 'CAPC-AC'] })
  @IsOptional()
  @IsIn(['DHIS2', 'ARIS 3', 'CAPC-AC'])
  sourceSystem?: 'DHIS2' | 'ARIS 3' | 'CAPC-AC';

  @ApiPropertyOptional({ minimum: 1, maximum: 1000, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  page = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
