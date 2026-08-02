import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class ListMessagesDto {
  @ApiPropertyOptional({
    example: 50,
    minimum: 1,
    maximum: 100,
    description: 'Nombre de messages.',
  })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    description:
      'Cache-buster anti-proxy envoyé par le frontend (ignoré côté serveur).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  _?: string;
}
