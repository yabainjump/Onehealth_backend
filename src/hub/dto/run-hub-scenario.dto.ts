import { ApiProperty } from '@nestjs/swagger';
import { IsIn, Matches } from 'class-validator';
import { CEEAC_COUNTRY_CODES } from '../hub.constants';

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class RunHubScenarioDto {
  @ApiProperty({ enum: CEEAC_COUNTRY_CODES, example: 'CM' })
  @IsIn(CEEAC_COUNTRY_CODES)
  sourceCountryCode: (typeof CEEAC_COUNTRY_CODES)[number];

  @ApiProperty({ enum: CEEAC_COUNTRY_CODES, example: 'TD' })
  @IsIn(CEEAC_COUNTRY_CODES)
  comparisonCountryCode: (typeof CEEAC_COUNTRY_CODES)[number];

  @ApiProperty({ example: '2026-09-01', pattern: '^\\d{4}-\\d{2}-\\d{2}$' })
  @Matches(ISO_DATE_PATTERN)
  dateFrom: string;

  @ApiProperty({ example: '2026-09-23', pattern: '^\\d{4}-\\d{2}-\\d{2}$' })
  @Matches(ISO_DATE_PATTERN)
  dateTo: string;
}
