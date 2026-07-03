import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
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

const CATEGORIES = ['human', 'animal', 'environment'] as const;
const SEVERITIES = ['low', 'medium', 'high'] as const;

const trimIfString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** Mise à jour d'une alerte (auteur) : tous les champs sont optionnels. */
export class UpdateAlertDto {
  @ApiPropertyOptional({ enum: CATEGORIES })
  @IsOptional()
  @IsEnum(CATEGORIES)
  category?: (typeof CATEGORIES)[number];

  @ApiPropertyOptional({ maxLength: 140 })
  @IsOptional()
  @Transform(trimIfString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(140)
  title?: string;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  country?: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @ApiPropertyOptional({
    description: 'Latitude (null pour effacer la position existante)',
    nullable: true,
  })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number | null;

  @ApiPropertyOptional({
    description: 'Longitude (null pour effacer la position existante)',
    nullable: true,
  })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number | null;

  @ApiPropertyOptional({ enum: SEVERITIES })
  @IsOptional()
  @IsEnum(SEVERITIES)
  severity?: (typeof SEVERITIES)[number];

  @ApiPropertyOptional({ type: [String], description: "URLs d'images (max 4)" })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  imageUrls?: string[];
}
