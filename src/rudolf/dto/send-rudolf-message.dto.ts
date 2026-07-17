import { Transform, TransformFnParams } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

function trimStringValue(params: TransformFnParams): unknown {
  const value = params.value as unknown;
  return typeof value === 'string' ? value.trim() : value;
}

export class SendRudolfMessageDto {
  @ApiProperty({
    example:
      'Comment la résistance aux antimicrobiens relie-t-elle les santés humaine, animale et environnementale ?',
    maxLength: 2000,
  })
  @Transform(trimStringValue)
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message: string;
}
