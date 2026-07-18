import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import type { AlertVerificationStatus } from '../../alerts/schemas/alert.schema';

const VERIFICATION_STATUSES = ['pending', 'verified', 'rejected'] as const;

export class SetAlertVerificationDto {
  @ApiProperty({
    enum: VERIFICATION_STATUSES,
    description: 'Statut de vérification attribué par un administrateur',
  })
  @IsEnum(VERIFICATION_STATUSES)
  status: AlertVerificationStatus;
}
