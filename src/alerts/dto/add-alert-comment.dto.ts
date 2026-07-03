import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class AddAlertCommentDto {
  @ApiProperty({
    example: 'Cas confirmé près de chez moi aussi.',
    minLength: 1,
    maxLength: 500,
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  text: string;
}
