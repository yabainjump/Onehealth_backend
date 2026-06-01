import { Type } from 'class-transformer';
import { IsMongoId, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class ListPostsDto {
  // Cache-buster envoye par le frontend (anti-cache proxy). Ignore.
  @IsOptional()
  @IsString()
  @MaxLength(40)
  _?: string;

  @IsOptional()
  @IsMongoId()
  authorId?: string;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100000)
  page?: number;
}
