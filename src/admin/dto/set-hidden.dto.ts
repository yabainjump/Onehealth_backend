import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class SetHiddenDto {
  @ApiProperty({
    description: 'true = mettre en pause (masquer), false = republier',
  })
  @IsBoolean()
  hidden: boolean;
}
