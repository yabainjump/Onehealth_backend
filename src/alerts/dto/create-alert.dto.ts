import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { IsSafeMediaUrl } from '../../common/validation/safe-media-url.validator';

const CATEGORIES = ['human', 'animal', 'environment'] as const;
const SEVERITIES = ['low', 'medium', 'high'] as const;

export class CreateAlertDto {
  @ApiProperty({ enum: CATEGORIES, example: 'animal' })
  @IsEnum(CATEGORIES)
  category: (typeof CATEGORIES)[number];

  @ApiProperty({ example: 'Mortalité inhabituelle de volailles', maxLength: 140 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(140)
  title: string;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ example: 'Cameroun', maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  country?: string;

  @ApiPropertyOptional({ example: 'Bafoussam', maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @ApiPropertyOptional({ example: 5.4781, description: 'Latitude' })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @ApiPropertyOptional({ example: 10.4176, description: 'Longitude' })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;

  @ApiPropertyOptional({ enum: SEVERITIES, example: 'high' })
  @IsOptional()
  @IsEnum(SEVERITIES)
  severity?: (typeof SEVERITIES)[number];

  @ApiPropertyOptional({ type: [String], description: "URLs d'images (max 4)" })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @IsString({ each: true })
  @IsSafeMediaUrl({ each: true })
  @MaxLength(500, { each: true })
  imageUrls?: string[];
}
