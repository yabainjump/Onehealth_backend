import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsString,
  Matches,
} from 'class-validator';

export class ConsolidateHubEventDto {
  @ApiProperty({
    type: [String],
    minItems: 2,
    maxItems: 30,
    example: ['OBS-CAPC-CM-91', 'OBS-ARIS-CM-91', 'OBS-DHIS2-CM-91'],
  })
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @Matches(/^OBS-(DHIS2|ARIS|CAPC)-[A-Z]{2}-\d{2}$/, { each: true })
  observationIds: string[];
}
