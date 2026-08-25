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
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CEEAC_COUNTRY_CODES } from '../hub.constants';

export class ListHubObservationsDto {
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

  @ApiPropertyOptional({ enum: ['observation', 'signal', 'verified-alert'] })
  @IsOptional()
  @IsIn(['observation', 'signal', 'verified-alert'])
  stage?: 'observation' | 'signal' | 'verified-alert';

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
