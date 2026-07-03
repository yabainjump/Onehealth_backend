import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateCertificationRequestDto {
  @ApiProperty({
    type: [String],
    description: 'URLs des justificatifs (diplômes, attestations) — max 5',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  documents: string[];

  @ApiPropertyOptional({ maxLength: 1000, description: 'Texte explicatif' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;
}
