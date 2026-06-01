import { Type } from 'class-transformer';
import { IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class ListMessagesDto {
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number;

  // Cache-buster envoye par le frontend (anti-cache proxy). Ignore.
  @IsOptional()
  @IsString()
  @MaxLength(40)
  _?: string;
}
