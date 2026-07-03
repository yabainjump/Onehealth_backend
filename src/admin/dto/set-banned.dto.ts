import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class SetBannedDto {
  @ApiProperty({ description: 'true = suspendre le compte, false = réactiver' })
  @IsBoolean()
  banned: boolean;
}
