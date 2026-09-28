import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  Equals,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  CEEAC_COUNTRY_CODES,
  type CeeacCountryCode,
  type HubSourceSystem,
} from '../hub.constants';
import {
  HUB_IMPORT_CANONICAL_FIELDS,
  HUB_IMPORT_FORMATS,
  HUB_IMPORT_MAX_CONTENT_BYTES,
  type HubImportCanonicalField,
  type HubImportFormat,
} from '../ingestion/hub-import.constants';

export class HubImportFieldMappingDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  @Matches(/^(?!__proto__$|prototype$|constructor$)[A-Za-zÀ-ÿ0-9_. -]+$/)
  sourceField: string;

  @IsIn(HUB_IMPORT_CANONICAL_FIELDS)
  targetField: HubImportCanonicalField;
}

export class CreateHubImportPreviewDto {
  @IsString()
  @Matches(/^[^/\\]{1,120}\.(csv|json|geojson)$/i)
  fileName: string;

  @IsIn(HUB_IMPORT_FORMATS)
  format: HubImportFormat;

  @IsIn(['DHIS2', 'ARIS 3', 'CAPC-AC'])
  sourceSystem: HubSourceSystem;

  @IsString()
  @Matches(/^[a-z0-9][a-z0-9-]{2,63}$/)
  sourceInstance: string;

  @IsIn(CEEAC_COUNTRY_CODES)
  countryCode: CeeacCountryCode;

  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9_-]{2,79}$/)
  sharingPolicyId: string;

  @Equals(true)
  simulated: true;

  @IsString()
  @MinLength(2)
  @MaxLength(HUB_IMPORT_MAX_CONTENT_BYTES)
  content: string;

  @IsArray()
  @ArrayMaxSize(HUB_IMPORT_CANONICAL_FIELDS.length)
  @ArrayUnique((mapping: HubImportFieldMappingDto) => mapping.targetField)
  @ValidateNested({ each: true })
  @Type(() => HubImportFieldMappingDto)
  mapping: HubImportFieldMappingDto[] = [];
}

export class ConfirmHubImportDto {
  @Equals('INGEST_SIMULATED_DATA')
  confirmation: 'INGEST_SIMULATED_DATA';
}

export class ListHubImportBatchesDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}

export class ListHubQualityIssuesDto extends ListHubImportBatchesDto {
  @IsOptional()
  @IsIn(CEEAC_COUNTRY_CODES)
  countryCode?: CeeacCountryCode;

  @IsOptional()
  @IsIn(['DHIS2', 'ARIS 3', 'CAPC-AC'])
  sourceSystem?: HubSourceSystem;

  @IsOptional()
  @IsIn(['OPEN', 'RESOLVED', 'DISMISSED'])
  status?: 'OPEN' | 'RESOLVED' | 'DISMISSED';
}

export class SimulateHubConnectorDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{3,100}$/)
  connectorId: string;

  @IsIn([
    'SUCCESS',
    'DUPLICATES',
    'INVALID_RECORDS',
    'PARTIAL_FAILURE',
    'AUTH_FAILURE',
    'TIMEOUT',
  ])
  scenario:
    | 'SUCCESS'
    | 'DUPLICATES'
    | 'INVALID_RECORDS'
    | 'PARTIAL_FAILURE'
    | 'AUTH_FAILURE'
    | 'TIMEOUT';
}
