import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ListUsersDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  // Cache-buster envoye par le frontend (anti-cache proxy). Ignore.
  @IsOptional()
  @IsString()
  @MaxLength(40)
  _?: string;
}
