import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ListUsersDto {
  @ApiPropertyOptional({
    example: 'kamga',
    description: 'Recherche par nom, prénom, username ou institution.',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({
    description:
      'Cache-buster anti-proxy envoyé par le frontend (ignoré côté serveur).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  _?: string;
}
