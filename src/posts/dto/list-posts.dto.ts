import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsMongoId,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ListPostsDto {
  @ApiPropertyOptional({
    description:
      'Cache-buster anti-proxy envoyé par le frontend (ignoré côté serveur).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  _?: string;

  @ApiPropertyOptional({ description: 'Filtrer par auteur (ObjectId Mongo).' })
  @IsOptional()
  @IsMongoId()
  authorId?: string;

  @ApiPropertyOptional({
    example: 7,
    minimum: 1,
    maximum: 100,
    description: 'Nombre par page.',
  })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    example: 1,
    minimum: 1,
    description: 'Numéro de page (1-based).',
  })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100000)
  page?: number;
}
