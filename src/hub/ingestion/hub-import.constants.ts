import type {
  CeeacCountryCode,
  HubRiskLevel,
  HubSector,
  HubSourceSystem,
} from '../hub.constants';

// Stays below Nest/Express' global JSON-body ceiling after envelope overhead.
// Larger institutional files must use a future streamed/multipart ingestion path.
export const HUB_IMPORT_MAX_CONTENT_BYTES = 48 * 1024;
export const HUB_IMPORT_MAX_RECORDS = 500;
export const HUB_IMPORT_MAX_FIELDS = 32;
export const HUB_IMPORT_MAPPING_VERSION = 'one-health-canonical-v1';

export const HUB_IMPORT_FORMATS = ['CSV', 'JSON', 'GEOJSON'] as const;
export type HubImportFormat = (typeof HUB_IMPORT_FORMATS)[number];

export const HUB_IMPORT_CANONICAL_FIELDS = [
  'sourceRecordId',
  'observedAt',
  'countryCode',
  'sector',
  'category',
  'title',
  'summary',
  'adminArea',
  'longitude',
  'latitude',
  'severity',
  'metricLabel',
  'metricValue',
  'metricUnit',
] as const;

export type HubImportCanonicalField =
  (typeof HUB_IMPORT_CANONICAL_FIELDS)[number];

export interface HubImportFieldDefinition {
  readonly field: HubImportCanonicalField;
  readonly label: string;
  readonly type: 'string' | 'date-time' | 'number' | 'enum';
  readonly required: boolean;
  readonly constraints: string;
  readonly example: string | number;
}

export const HUB_IMPORT_DICTIONARY: readonly HubImportFieldDefinition[] = [
  {
    field: 'sourceRecordId',
    label: 'Identifiant source',
    type: 'string',
    required: true,
    constraints: '1 à 120 caractères, unique dans la source',
    example: 'CM-HUM-2026-001',
  },
  {
    field: 'observedAt',
    label: "Date d'observation",
    type: 'date-time',
    required: true,
    constraints: 'ISO 8601 avec fuseau, non future',
    example: '2026-09-20T08:30:00Z',
  },
  {
    field: 'countryCode',
    label: 'Pays',
    type: 'enum',
    required: true,
    constraints: 'Code ISO alpha-2 parmi les 11 États CEEAC',
    example: 'CM',
  },
  {
    field: 'sector',
    label: 'Secteur',
    type: 'enum',
    required: true,
    constraints: 'human | animal | environment, cohérent avec la source',
    example: 'human',
  },
  {
    field: 'category',
    label: 'Catégorie',
    type: 'string',
    required: true,
    constraints: '1 à 120 caractères',
    example: 'Syndrome fébrile',
  },
  {
    field: 'title',
    label: 'Titre',
    type: 'string',
    required: true,
    constraints: '1 à 180 caractères',
    example: 'Hausse de syndromes fébriles',
  },
  {
    field: 'summary',
    label: 'Résumé',
    type: 'string',
    required: true,
    constraints: '1 à 1 000 caractères, sans donnée nominative',
    example: 'Agrégat hebdomadaire simulé.',
  },
  {
    field: 'adminArea',
    label: 'Zone administrative',
    type: 'string',
    required: true,
    constraints: '1 à 120 caractères',
    example: 'Centre',
  },
  {
    field: 'longitude',
    label: 'Longitude',
    type: 'number',
    required: true,
    constraints: '-180 à 180, point 0/0 refusé',
    example: 11.52,
  },
  {
    field: 'latitude',
    label: 'Latitude',
    type: 'number',
    required: true,
    constraints: '-90 à 90, point 0/0 refusé',
    example: 3.87,
  },
  {
    field: 'severity',
    label: 'Gravité canonique',
    type: 'enum',
    required: true,
    constraints: 'low | medium | high | critical ; aucune valeur par défaut',
    example: 'medium',
  },
  {
    field: 'metricLabel',
    label: 'Nom de métrique',
    type: 'string',
    required: false,
    constraints: '0 à 120 caractères',
    example: 'Cas suspects',
  },
  {
    field: 'metricValue',
    label: 'Valeur de métrique',
    type: 'number',
    required: false,
    constraints: 'Nombre fini ; requis si metricLabel est fourni',
    example: 12,
  },
  {
    field: 'metricUnit',
    label: 'Unité',
    type: 'string',
    required: false,
    constraints: '0 à 30 caractères',
    example: 'cas',
  },
] as const;

export const HUB_IMPORT_COUNTRY_NAMES: Readonly<
  Record<CeeacCountryCode, string>
> = {
  AO: 'Angola',
  BI: 'Burundi',
  CM: 'Cameroun',
  CF: 'République centrafricaine',
  TD: 'Tchad',
  CG: 'Congo',
  CD: 'République démocratique du Congo',
  GQ: 'Guinée équatoriale',
  GA: 'Gabon',
  RW: 'Rwanda',
  ST: 'São Tomé-et-Príncipe',
};

export const HUB_SOURCE_SECTOR: Readonly<Record<HubSourceSystem, HubSector>> = {
  DHIS2: 'human',
  'ARIS 3': 'animal',
  'CAPC-AC': 'environment',
};

export interface HubImportCanonicalCandidate {
  readonly sourceRowNumber: number;
  readonly canonicalId: string;
  readonly sourceRecordId: string;
  readonly observedAt: Date;
  readonly countryCode: CeeacCountryCode;
  readonly countryName: string;
  readonly sector: HubSector;
  readonly category: string;
  readonly title: string;
  readonly summary: string;
  readonly adminArea: string;
  readonly longitude: number;
  readonly latitude: number;
  readonly severity: HubRiskLevel;
  readonly metrics: readonly { label: string; value: number; unit: string }[];
  readonly canonicalPayload: Readonly<Record<string, unknown>>;
  readonly checksum: string;
}

export type HubImportIssueCode =
  | 'MALFORMED_FILE'
  | 'TOO_MANY_FIELDS'
  | 'MISSING_FIELD'
  | 'INVALID_VALUE'
  | 'COUNTRY_MISMATCH'
  | 'SECTOR_MISMATCH'
  | 'DUPLICATE_IN_FILE'
  | 'DUPLICATE_EXISTING'
  | 'DANGEROUS_FIELD';

export interface HubImportValidationIssue {
  readonly rowNumber: number;
  readonly sourceRecordId: string;
  readonly code: HubImportIssueCode;
  readonly field: string;
  readonly message: string;
  readonly severity: 'ERROR' | 'WARNING';
}
