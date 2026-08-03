import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import type { HubReportStatus } from '../hub.constants';

export class UpdateHubReportStatusDto {
  @ApiProperty({ enum: ['IN_REVIEW', 'VALIDATED', 'PUBLISHED'] })
  @IsEnum(['IN_REVIEW', 'VALIDATED', 'PUBLISHED'])
  status: Exclude<HubReportStatus, 'DRAFT'>;
}
