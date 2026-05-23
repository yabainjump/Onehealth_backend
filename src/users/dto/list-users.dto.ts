import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ListUsersDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
