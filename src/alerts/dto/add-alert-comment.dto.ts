import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class AddAlertCommentDto {
  @ApiProperty({
    example: 'Cas confirmé près de chez moi aussi.',
    minLength: 1,
    maxLength: 500,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  text: string;
}
