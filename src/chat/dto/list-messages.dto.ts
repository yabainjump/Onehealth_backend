import { Type } from 'class-transformer';
import { IsOptional, Max, Min } from 'class-validator';

export class ListMessagesDto {
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number;
}
