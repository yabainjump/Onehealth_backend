import { Type } from 'class-transformer';
import { IsMongoId, IsOptional, Max, Min } from 'class-validator';

export class ListPostsDto {
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
