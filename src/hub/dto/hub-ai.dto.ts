import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const upper = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export class HubAiScopeDto {
  @IsOptional()
  @Transform(upper)
  @Matches(/^[A-Z]{2}$/)
  countryCode?: string;

  @IsOptional()
  @IsIn(['human', 'animal', 'environment'])
  sector?: 'human' | 'animal' | 'environment';

  @IsOptional()
  @IsInt()
  @Min(7)
  @Max(365)
  periodDays = 30;
}

export class HubAiAssistantDto extends HubAiScopeDto {
  @IsString()
  @MaxLength(1500)
  question: string;
}
