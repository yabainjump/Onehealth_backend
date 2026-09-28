import { createHash } from 'crypto';
import type { CeeacCountryCode, HubSourceSystem } from '../hub.constants';
import { CEEAC_COUNTRY_CODES } from '../hub.constants';
import {
  HUB_IMPORT_CANONICAL_FIELDS,
  HUB_IMPORT_COUNTRY_NAMES,
  HUB_IMPORT_MAX_FIELDS,
  HUB_IMPORT_MAX_RECORDS,
  HUB_SOURCE_SECTOR,
  type HubImportCanonicalCandidate,
  type HubImportCanonicalField,
  type HubImportFormat,
  type HubImportValidationIssue,
} from './hub-import.constants';

export interface HubImportMapping {
  readonly sourceField: string;
  readonly targetField: HubImportCanonicalField;
}

export interface ParseHubImportInput {
  readonly content: string;
  readonly format: HubImportFormat;
  readonly sourceSystem: HubSourceSystem;
  readonly sourceInstance: string;
  readonly countryCode: CeeacCountryCode;
  readonly mapping: readonly HubImportMapping[];
}

export interface ParseHubImportResult {
  readonly candidates: readonly HubImportCanonicalCandidate[];
  readonly issues: readonly HubImportValidationIssue[];
  readonly totalRecords: number;
}

export class HubImportParseError extends Error {}

const DANGEROUS_FIELDS = new Set(['__proto__', 'prototype', 'constructor']);
const REQUIRED_FIELDS = new Set<HubImportCanonicalField>(
  HUB_IMPORT_CANONICAL_FIELDS.filter(
    (field) => !['metricLabel', 'metricValue', 'metricUnit'].includes(field),
  ),
);

interface SourceRow {
  readonly rowNumber: number;
  readonly value: Readonly<Record<string, unknown>>;
}

export function parseHubImport(
  input: ParseHubImportInput,
): ParseHubImportResult {
  const rows = parseRows(input.content, input.format);
  if (!rows.length)
    throw new HubImportParseError(
      'Le fichier ne contient aucun enregistrement.',
    );
  if (rows.length > HUB_IMPORT_MAX_RECORDS) {
    throw new HubImportParseError(
      `Le fichier dépasse la limite de ${HUB_IMPORT_MAX_RECORDS} lignes.`,
    );
  }

  const mapping = resolveMapping(input.mapping);
  const candidates: HubImportCanonicalCandidate[] = [];
  const issues: HubImportValidationIssue[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const rowIssues: HubImportValidationIssue[] = [];
    const mapped = mapRow(row, mapping, rowIssues);
    const sourceRecordId = readText(mapped.sourceRecordId);
    validateRequired(mapped, row.rowNumber, sourceRecordId, rowIssues);
    validateLengths(mapped, row.rowNumber, sourceRecordId, rowIssues);

    const countryCode = readText(mapped.countryCode).toUpperCase();
    if (countryCode && countryCode !== input.countryCode) {
      rowIssues.push(
        issue(
          row.rowNumber,
          sourceRecordId,
          'COUNTRY_MISMATCH',
          'countryCode',
          'Le pays de la ligne ne correspond pas au pays déclaré pour le lot.',
        ),
      );
    }
    if (
      countryCode &&
      !CEEAC_COUNTRY_CODES.includes(countryCode as CeeacCountryCode)
    ) {
      rowIssues.push(
        issue(
          row.rowNumber,
          sourceRecordId,
          'INVALID_VALUE',
          'countryCode',
          "Le code pays n'appartient pas aux onze États CEEAC.",
        ),
      );
    }

    const sector = readText(mapped.sector);
    if (sector && sector !== HUB_SOURCE_SECTOR[input.sourceSystem]) {
      rowIssues.push(
        issue(
          row.rowNumber,
          sourceRecordId,
          'SECTOR_MISMATCH',
          'sector',
          `La source ${input.sourceSystem} attend le secteur ${HUB_SOURCE_SECTOR[input.sourceSystem]}.`,
        ),
      );
    }

    const observedAt = parseDate(mapped.observedAt);
    if (!observedAt || observedAt.getTime() > Date.now() + 5 * 60_000) {
      rowIssues.push(
        issue(
          row.rowNumber,
          sourceRecordId,
          'INVALID_VALUE',
          'observedAt',
          'La date doit être ISO 8601, inclure un fuseau et ne pas être future.',
        ),
      );
    }

    const longitude = parseFiniteNumber(mapped.longitude);
    const latitude = parseFiniteNumber(mapped.latitude);
    if (longitude === null || longitude < -180 || longitude > 180) {
      rowIssues.push(
        issue(
          row.rowNumber,
          sourceRecordId,
          'INVALID_VALUE',
          'longitude',
          'La longitude doit être comprise entre -180 et 180.',
        ),
      );
    }
    if (latitude === null || latitude < -90 || latitude > 90) {
      rowIssues.push(
        issue(
          row.rowNumber,
          sourceRecordId,
          'INVALID_VALUE',
          'latitude',
          'La latitude doit être comprise entre -90 et 90.',
        ),
      );
    }
    if (longitude === 0 && latitude === 0) {
      rowIssues.push(
        issue(
          row.rowNumber,
          sourceRecordId,
          'INVALID_VALUE',
          'location',
          'Le point 0,0 est refusé.',
        ),
      );
    }

    const severity = readText(mapped.severity);
    if (!['low', 'medium', 'high', 'critical'].includes(severity)) {
      rowIssues.push(
        issue(
          row.rowNumber,
          sourceRecordId,
          'INVALID_VALUE',
          'severity',
          'La gravité doit être low, medium, high ou critical.',
        ),
      );
    }

    const metricLabel = readText(mapped.metricLabel);
    const metricValue =
      mapped.metricValue === undefined || mapped.metricValue === ''
        ? null
        : parseFiniteNumber(mapped.metricValue);
    if (metricLabel && metricValue === null) {
      rowIssues.push(
        issue(
          row.rowNumber,
          sourceRecordId,
          'INVALID_VALUE',
          'metricValue',
          'Une métrique nommée exige une valeur numérique finie.',
        ),
      );
    }
    if (
      !metricLabel &&
      mapped.metricValue !== undefined &&
      mapped.metricValue !== ''
    ) {
      rowIssues.push(
        issue(
          row.rowNumber,
          sourceRecordId,
          'MISSING_FIELD',
          'metricLabel',
          'La valeur de métrique exige un libellé.',
        ),
      );
    }

    const duplicateKey = `${input.sourceSystem}|${input.sourceInstance}|${input.countryCode}|${sourceRecordId}`;
    if (sourceRecordId && seen.has(duplicateKey)) {
      rowIssues.push(
        issue(
          row.rowNumber,
          sourceRecordId,
          'DUPLICATE_IN_FILE',
          'sourceRecordId',
          'Cet identifiant source apparaît plusieurs fois dans le fichier.',
        ),
      );
    }
    seen.add(duplicateKey);
    issues.push(...rowIssues);
    if (rowIssues.some((item) => item.severity === 'ERROR')) continue;

    const canonicalPayload = Object.fromEntries(
      HUB_IMPORT_CANONICAL_FIELDS.filter(
        (field) => mapped[field] !== undefined && mapped[field] !== '',
      ).map((field) => [field, mapped[field]]),
    );
    const identity = createHash('sha256')
      .update(duplicateKey)
      .digest('hex')
      .slice(0, 20)
      .toUpperCase();
    candidates.push({
      sourceRowNumber: row.rowNumber,
      canonicalId: `IMP-${input.countryCode}-${identity}`,
      sourceRecordId,
      observedAt: observedAt!,
      countryCode: input.countryCode,
      countryName: HUB_IMPORT_COUNTRY_NAMES[input.countryCode],
      sector: HUB_SOURCE_SECTOR[input.sourceSystem],
      category: readText(mapped.category),
      title: readText(mapped.title),
      summary: readText(mapped.summary),
      adminArea: readText(mapped.adminArea),
      longitude: longitude!,
      latitude: latitude!,
      severity: severity as HubImportCanonicalCandidate['severity'],
      metrics:
        metricLabel && metricValue !== null
          ? [
              {
                label: metricLabel,
                value: metricValue,
                unit: readText(mapped.metricUnit),
              },
            ]
          : [],
      canonicalPayload,
      checksum: createHash('sha256')
        .update(JSON.stringify(canonicalPayload))
        .digest('hex'),
    });
  }

  return { candidates, issues, totalRecords: rows.length };
}

function resolveMapping(
  entries: readonly HubImportMapping[],
): ReadonlyMap<HubImportCanonicalField, string> {
  const resolved = new Map<HubImportCanonicalField, string>();
  if (!entries.length) {
    for (const field of HUB_IMPORT_CANONICAL_FIELDS) resolved.set(field, field);
    return resolved;
  }
  for (const entry of entries) {
    if (DANGEROUS_FIELDS.has(entry.sourceField)) {
      throw new HubImportParseError(
        `Champ source interdit : ${entry.sourceField}`,
      );
    }
    if (resolved.has(entry.targetField)) {
      throw new HubImportParseError(
        `Le champ canonique ${entry.targetField} est mappé plusieurs fois.`,
      );
    }
    resolved.set(entry.targetField, entry.sourceField);
  }
  return resolved;
}

function parseRows(content: string, format: HubImportFormat): SourceRow[] {
  if (format === 'CSV') return parseCsv(content);
  let parsed: unknown;
  try {
    parsed = JSON.parse(content) as unknown;
  } catch {
    throw new HubImportParseError('Le contenu JSON est invalide.');
  }
  if (format === 'GEOJSON') return parseGeoJson(parsed);
  const records = Array.isArray(parsed)
    ? parsed
    : isPlainRecord(parsed) && Array.isArray(parsed.records)
      ? parsed.records
      : null;
  if (!records)
    throw new HubImportParseError(
      'Le JSON doit être un tableau ou contenir un tableau records.',
    );
  return records.map((value, index) => ({
    rowNumber: index + 1,
    value: requireSafeRecord(value, index + 1),
  }));
}

function parseGeoJson(parsed: unknown): SourceRow[] {
  if (
    !isPlainRecord(parsed) ||
    parsed.type !== 'FeatureCollection' ||
    !Array.isArray(parsed.features)
  ) {
    throw new HubImportParseError(
      'Le GeoJSON doit être une FeatureCollection.',
    );
  }
  return parsed.features.map((feature, index) => {
    const item = requireSafeRecord(feature, index + 1);
    const geometry = requireSafeRecord(item.geometry, index + 1);
    if (
      geometry.type !== 'Point' ||
      !Array.isArray(geometry.coordinates) ||
      geometry.coordinates.length < 2
    ) {
      throw new HubImportParseError(
        `La géométrie de la ligne ${index + 1} doit être un Point.`,
      );
    }
    const properties = requireSafeRecord(item.properties, index + 1);
    const longitude: unknown = geometry.coordinates[0];
    const latitude: unknown = geometry.coordinates[1];
    return {
      rowNumber: index + 1,
      value: {
        ...properties,
        longitude,
        latitude,
      },
    };
  });
}

function parseCsv(content: string): SourceRow[] {
  const table: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    if (quoted && char === '"' && content[index + 1] === '"') {
      cell += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (!quoted && char === ',') {
      row.push(cell);
      cell = '';
      continue;
    }
    if (!quoted && (char === '\n' || char === '\r')) {
      if (char === '\r' && content[index + 1] === '\n') index += 1;
      row.push(cell);
      cell = '';
      if (row.some((value) => value.trim())) table.push(row);
      row = [];
      continue;
    }
    cell += char;
  }
  if (quoted)
    throw new HubImportParseError(
      'Le CSV contient une valeur entre guillemets non terminée.',
    );
  row.push(cell);
  if (row.some((value) => value.trim())) table.push(row);
  const headers =
    table.shift()?.map((value) => value.trim().replace(/^\uFEFF/, '')) ?? [];
  if (!headers.length)
    throw new HubImportParseError("Le CSV ne contient pas d'en-tête.");
  validateFieldNames(headers);
  return table.map((values, index) => ({
    rowNumber: index + 2,
    value: Object.fromEntries(
      headers.map((header, column) => [header, values[column]?.trim() ?? '']),
    ),
  }));
}

function requireSafeRecord(
  value: unknown,
  rowNumber: number,
): Readonly<Record<string, unknown>> {
  if (!isPlainRecord(value))
    throw new HubImportParseError(`La ligne ${rowNumber} doit être un objet.`);
  validateFieldNames(Object.keys(value));
  return value;
}

function validateFieldNames(fields: readonly string[]): void {
  if (fields.length > HUB_IMPORT_MAX_FIELDS)
    throw new HubImportParseError(
      `Une ligne dépasse la limite de ${HUB_IMPORT_MAX_FIELDS} champs.`,
    );
  for (const field of fields) {
    if (!field || field.length > 80 || DANGEROUS_FIELDS.has(field))
      throw new HubImportParseError(
        `Nom de champ interdit ou invalide : ${field || '(vide)'}`,
      );
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function mapRow(
  row: SourceRow,
  mapping: ReadonlyMap<HubImportCanonicalField, string>,
  issues: HubImportValidationIssue[],
): Partial<Record<HubImportCanonicalField, unknown>> {
  const mapped: Partial<Record<HubImportCanonicalField, unknown>> = {};
  for (const [target, source] of mapping) {
    if (DANGEROUS_FIELDS.has(source)) {
      issues.push(
        issue(
          row.rowNumber,
          '',
          'DANGEROUS_FIELD',
          source,
          'Ce nom de champ est interdit.',
        ),
      );
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(row.value, source))
      mapped[target] = row.value[source];
  }
  return mapped;
}

function validateRequired(
  mapped: Partial<Record<HubImportCanonicalField, unknown>>,
  rowNumber: number,
  sourceRecordId: string,
  issues: HubImportValidationIssue[],
): void {
  for (const field of REQUIRED_FIELDS) {
    if (
      mapped[field] === undefined ||
      mapped[field] === null ||
      readText(mapped[field]) === ''
    ) {
      issues.push(
        issue(
          rowNumber,
          sourceRecordId,
          'MISSING_FIELD',
          field,
          `Le champ ${field} est obligatoire.`,
        ),
      );
    }
  }
}

function validateLengths(
  mapped: Partial<Record<HubImportCanonicalField, unknown>>,
  rowNumber: number,
  sourceRecordId: string,
  issues: HubImportValidationIssue[],
): void {
  const limits: Partial<Record<HubImportCanonicalField, number>> = {
    sourceRecordId: 120,
    category: 120,
    title: 180,
    summary: 1000,
    adminArea: 120,
    metricLabel: 120,
    metricUnit: 30,
  };
  for (const [field, limit] of Object.entries(limits) as [
    HubImportCanonicalField,
    number,
  ][]) {
    const value = readText(mapped[field]);
    if (value.length > limit)
      issues.push(
        issue(
          rowNumber,
          sourceRecordId,
          'INVALID_VALUE',
          field,
          `Le champ ${field} dépasse ${limit} caractères.`,
        ),
      );
  }
}

function parseDate(value: unknown): Date | null {
  const text = readText(value);
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(text) ||
    !/(Z|[+-]\d{2}:\d{2})$/.test(text)
  )
    return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseFiniteNumber(value: unknown): number | null {
  if (typeof value === 'string' && value.trim() === '') return null;
  const result = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(result) ? result : null;
}

function readText(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value).trim()
    : '';
}

function issue(
  rowNumber: number,
  sourceRecordId: string,
  code: HubImportValidationIssue['code'],
  field: string,
  message: string,
): HubImportValidationIssue {
  return {
    rowNumber,
    sourceRecordId: sourceRecordId.slice(0, 120),
    code,
    field: field.slice(0, 80),
    message,
    severity: 'ERROR',
  };
}
