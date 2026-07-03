import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RejectCertificationDto {
  @ApiProperty({ maxLength: 1000, description: 'Motif du refus' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason: string;
}
