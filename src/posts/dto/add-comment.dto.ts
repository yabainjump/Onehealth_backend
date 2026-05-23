import { IsString, MaxLength, MinLength } from 'class-validator';

export class AddCommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  text: string;
}
