import { createHash } from 'crypto';
import { HubRole } from '../../users/schemas/user.schema';
import {
  HubObservationStage,
  HubRiskLevel,
  HubSector,
  HubSignalStatus,
  HubSourceSystem,
} from '../hub.constants';

interface DemoCountry {
  readonly code: string;
  readonly name: string;
  readonly center: readonly [number, number];
  readonly spread: number;
  readonly areas: readonly string[];
}

interface DemoMetric {
  readonly label: string;
  readonly value: number;
  readonly unit: string;
}

export interface HubDemoObservationSeed {
  readonly canonicalId: string;
  readonly sourceSystem: HubSourceSystem;
  readonly sourceInstance: string;
  readonly sourceRecordId: string;
  readonly sector: HubSector;
  readonly countryCode: string;
  readonly countryName: string;
  readonly adminArea: string;
  readonly location: { type: 'Point'; coordinates: [number, number] };
  readonly observedAt: Date;
  readonly receivedAt: Date;
  readonly category: string;
  readonly title: string;
  readonly summary: string;
  readonly stage: HubObservationStage;
  readonly severity: HubRiskLevel;
  readonly metrics: readonly DemoMetric[];
  readonly sharingPolicyId: string;
  readonly isDemo: true;
  readonly scenarioId: string;
}

export interface HubDemoRawSeed {
  readonly sourceSystem: HubSourceSystem;
  readonly sourceInstance: string;
  readonly sourceRecordId: string;
  readonly countryCode: string;
  readonly payload: Record<string, unknown>;
  readonly checksum: string;
  readonly schemaVersion: string;
  readonly receivedAt: Date;
  readonly ingestionRunId: string;
  readonly sharingPolicyId: string;
  readonly isDemo: true;
  readonly scenarioId: string;
}

export interface HubDemoSignalSeed {
  readonly signalCode: string;
  readonly observationId: string;
  readonly riskLevel: HubRiskLevel;
  readonly confidenceScore: number;
  readonly explanation: string;
  readonly status: HubSignalStatus;
  readonly assignedTo: null;
  readonly detectedAt: Date;
  readonly reviewStartedAt: Date | null;
  readonly decidedAt: Date | null;
  readonly decisionNote: string;
  readonly countryCode: string;
  readonly sharingPolicyId: string;
  readonly isDemo: true;
}

export interface HubDemoAlertSeed {
  readonly alertCode: string;
  readonly signalCode: string;
  readonly observationId: string;
  readonly title: string;
  readonly summary: string;
  readonly riskLevel: HubRiskLevel;
  readonly countryCode: string;
  readonly status: 'VERIFIED';
  readonly verifiedBy: 'DEMO-SEED';
  readonly verifiedAt: Date;
  readonly verificationNote: string;
  readonly sharingPolicyId: string;
  readonly isDemo: true;
}

export interface HubDemoSharingPolicySeed {
  readonly policyId: string;
  readonly countryOwner: string;
  readonly sharingLevel: 'REGIONAL_AUTHORIZED';
  readonly allowedRoles: readonly HubRole[];
  readonly allowedCountries: readonly string[];
  readonly aggregationLevel: 'ADMIN_1';
  readonly retentionPeriodDays: number;
  readonly containsPersonalData: false;
  readonly isDemo: true;
}

export interface HubDemoSeedBundle {
  readonly rawRecords: readonly HubDemoRawSeed[];
  readonly observations: readonly HubDemoObservationSeed[];
  readonly signals: readonly HubDemoSignalSeed[];
  readonly alerts: readonly HubDemoAlertSeed[];
  readonly sharingPolicies: readonly HubDemoSharingPolicySeed[];
}

const REFERENCE_DATE = new Date('2026-08-02T12:00:00.000Z');
const SOURCE_INSTANCE = 'demo-ceeac-2026';
const INGESTION_RUN_ID = 'DEMO-SEED-2026-08-02';

const COUNTRIES: readonly DemoCountry[] = [
  {
    code: 'AO',
    name: 'Angola',
    center: [-12.5, 18.5],
    spread: 2.1,
    areas: ['Luanda', 'Huambo', 'Huíla', 'Malanje', 'Uíge'],
  },
  {
    code: 'BI',
    name: 'Burundi',
    center: [-3.4, 29.9],
    spread: 0.35,
    areas: ['Bujumbura', 'Gitega', 'Ngozi', 'Kirundo', 'Cibitoke'],
  },
  {
    code: 'CM',
    name: 'Cameroun',
    center: [5.7, 12.7],
    spread: 1.25,
    areas: ['Centre', 'Extrême-Nord', 'Est', 'Littoral', 'Sud'],
  },
  {
    code: 'CF',
    name: 'République centrafricaine',
    center: [6.6, 20.9],
    spread: 1.4,
    areas: [
      'Bangui',
      "Ombella-M'Poko",
      'Lobaye',
      'Nana-Mambéré',
      'Haute-Kotto',
    ],
  },
  {
    code: 'TD',
    name: 'Tchad',
    center: [15.4, 18.7],
    spread: 2.1,
    areas: ["N'Djamena", 'Lac', 'Logone Oriental', 'Ouaddaï', 'Mayo-Kebbi Est'],
  },
  {
    code: 'CG',
    name: 'Congo',
    center: [-0.7, 15.2],
    spread: 1.15,
    areas: ['Brazzaville', 'Pointe-Noire', 'Cuvette', 'Niari', 'Likouala'],
  },
  {
    code: 'CD',
    name: 'République démocratique du Congo',
    center: [-3.2, 23.6],
    spread: 2.25,
    areas: [
      'Kinshasa',
      'Nord-Kivu',
      'Sud-Kivu',
      'Kongo Central',
      'Haut-Katanga',
    ],
  },
  {
    code: 'GQ',
    name: 'Guinée équatoriale',
    center: [1.6, 10.4],
    spread: 0.45,
    areas: ['Bioko Norte', 'Litoral', 'Centro Sur', 'Kié-Ntem', 'Wele-Nzas'],
  },
  {
    code: 'GA',
    name: 'Gabon',
    center: [-0.8, 11.6],
    spread: 0.9,
    areas: [
      'Estuaire',
      'Ogooué-Ivindo',
      'Haut-Ogooué',
      'Woleu-Ntem',
      'Moyen-Ogooué',
    ],
  },
  {
    code: 'RW',
    name: 'Rwanda',
    center: [-1.9, 29.9],
    spread: 0.28,
    areas: [
      'Kigali',
      'Province de l’Est',
      'Province de l’Ouest',
      'Province du Nord',
      'Province du Sud',
    ],
  },
  {
    code: 'ST',
    name: 'São Tomé-et-Príncipe',
    center: [0.3, 6.7],
    spread: 0.18,
    areas: ['Água Grande', 'Mé-Zóchi', 'Lobata', 'Cantagalo', 'Príncipe'],
  },
] as const;

const OFFSETS = [
  [-0.48, -0.34],
  [0.36, -0.21],
  [-0.12, 0.42],
  [0.51, 0.31],
  [-0.38, 0.22],
] as const;

const HUMAN_TITLES = [
  'Syndrome fébrile inhabituel',
  'Syndrome respiratoire aigu',
  'Diarrhée aqueuse aiguë',
  'Cas suspects de rougeole',
  'Syndrome ictérique aigu',
] as const;

const ANIMAL_TITLES = [
  'Mortalité animale inhabituelle',
  'Suspicion de peste porcine africaine',
  'Syndrome respiratoire aviaire',
  'Avortements groupés chez les ruminants',
  'Suspicion de rage animale',
] as const;

const ENVIRONMENT_TITLES = [
  'Anomalie pluviométrique',
  'Risque hydrique saisonnier',
  'Température supérieure à la normale',
  'Dégradation de la qualité de l’air',
  'Indice de sécheresse élevé',
] as const;

const VERIFIED_RECORD_IDS = new Set([
  'DHIS2-CM-01',
  'ARIS-CF-01',
  'CAPC-GA-01',
]);
const SIGNAL_RECORD_IDS = new Set([
  'DHIS2-TD-01',
  'DHIS2-CD-01',
  'DHIS2-CG-01',
  'DHIS2-BI-01',
  'ARIS-CM-01',
  'ARIS-AO-01',
  'ARIS-RW-01',
  'ARIS-GQ-01',
  'CAPC-TD-01',
  'CAPC-CD-01',
  'CAPC-ST-01',
  'CAPC-BI-01',
]);

function dateFromDays(daysAgo: number, hoursOffset = 0): Date {
  const date = new Date(REFERENCE_DATE);
  date.setUTCDate(date.getUTCDate() - daysAgo);
  date.setUTCHours(date.getUTCHours() + hoursOffset);
  return date;
}

function ageInDays(
  countryIndex: number,
  itemIndex: number,
  sectorIndex: number,
): number {
  const countryCode = COUNTRIES[countryIndex].code;
  if (itemIndex === 0 && sectorIndex === 0 && countryCode === 'CM') return 0;
  if (itemIndex === 0 && sectorIndex === 1 && countryCode === 'CF') return 1;
  if (itemIndex === 0 && sectorIndex === 2 && countryCode === 'GA') return 2;
  return itemIndex * 62 + countryIndex * 2 + sectorIndex;
}

function coordinates(
  country: DemoCountry,
  itemIndex: number,
  sectorIndex: number,
): [number, number] {
  const [latitudeOffset, longitudeOffset] = OFFSETS[itemIndex];
  const jitter = (sectorIndex - 1) * 0.055;
  const latitude = Number(
    (country.center[0] + latitudeOffset * country.spread + jitter).toFixed(5),
  );
  const longitude = Number(
    (country.center[1] + longitudeOffset * country.spread - jitter).toFixed(5),
  );
  return [longitude, latitude];
}

function classification(sourceRecordId: string): {
  stage: HubObservationStage;
  severity: HubRiskLevel;
} {
  if (VERIFIED_RECORD_IDS.has(sourceRecordId))
    return { stage: 'verified-alert', severity: 'critical' };
  if (SIGNAL_RECORD_IDS.has(sourceRecordId))
    return { stage: 'signal', severity: 'high' };
  const sequence = Number(sourceRecordId.slice(-2));
  return { stage: 'observation', severity: sequence >= 4 ? 'medium' : 'low' };
}

function stableChecksum(payload: Record<string, unknown>): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function createObservation(
  country: DemoCountry,
  countryIndex: number,
  itemIndex: number,
  sectorIndex: number,
): HubDemoObservationSeed {
  const sector = (['human', 'animal', 'environment'] as const)[sectorIndex];
  const sourceSystem = (['DHIS2', 'ARIS 3', 'CAPC-AC'] as const)[sectorIndex];
  const sourcePrefix = (['DHIS2', 'ARIS', 'CAPC'] as const)[sectorIndex];
  const sourceRecordId = `${sourcePrefix}-${country.code}-${String(itemIndex + 1).padStart(2, '0')}`;
  const { stage, severity } = classification(sourceRecordId);
  const daysAgo = ageInDays(countryIndex, itemIndex, sectorIndex);
  const numericSeed = countryIndex * 31 + itemIndex * 17 + sectorIndex * 11;
  const firstValue = 8 + (numericSeed % 97);
  const secondValue = Math.max(
    1,
    Math.floor(firstValue * (0.08 + itemIndex * 0.025)),
  );
  const title = [HUMAN_TITLES, ANIMAL_TITLES, ENVIRONMENT_TITLES][sectorIndex][
    itemIndex
  ];
  const verifiedTitle =
    sourceRecordId === 'DHIS2-CM-01'
      ? 'Foyer de fièvre hémorragique'
      : sourceRecordId === 'CAPC-GA-01'
        ? 'Risque hydrique saisonnier'
        : title;
  const metricLabels =
    sector === 'human'
      ? ['Cas suspects', 'Cas confirmés']
      : sector === 'animal'
        ? ['Animaux exposés', 'Décès']
        : [title, 'Écart à la référence'];

  return {
    canonicalId: `OBS-${sourceRecordId}`,
    sourceSystem,
    sourceInstance: SOURCE_INSTANCE,
    sourceRecordId,
    sector,
    countryCode: country.code,
    countryName: country.name,
    adminArea: country.areas[itemIndex],
    location: {
      type: 'Point',
      coordinates: coordinates(country, itemIndex, sectorIndex),
    },
    observedAt: dateFromDays(daysAgo),
    receivedAt: dateFromDays(
      daysAgo,
      sectorIndex === 0 ? 6 : sectorIndex === 1 ? 8 : 3,
    ),
    category:
      sector === 'human'
        ? 'Surveillance syndromique'
        : sector === 'animal'
          ? 'Surveillance des foyers animaux'
          : 'Climat et environnement',
    title: verifiedTitle,
    summary:
      stage === 'verified-alert'
        ? 'Alerte fictive validée après rapprochement multisectoriel et contrôle humain.'
        : `${metricLabels[0]} : ${firstValue}. Donnée simulée reçue de ${sourceSystem}.`,
    stage,
    severity,
    metrics: [
      {
        label: metricLabels[0],
        value: firstValue,
        unit:
          sector === 'environment' ? (itemIndex === 0 ? 'mm' : 'indice') : '',
      },
      {
        label: metricLabels[1],
        value: secondValue,
        unit: sector === 'environment' ? '%' : '',
      },
    ],
    sharingPolicyId: `POLICY-DEMO-${country.code}`,
    isDemo: true,
    scenarioId: `CEEAC-DEMO-${country.code}-${String(itemIndex + 1).padStart(2, '0')}`,
  };
}

export function createHubDemoSeed(): HubDemoSeedBundle {
  const observations = COUNTRIES.flatMap((country, countryIndex) =>
    [0, 1, 2].flatMap((sectorIndex) =>
      [0, 1, 2, 3, 4].map((itemIndex) =>
        createObservation(country, countryIndex, itemIndex, sectorIndex),
      ),
    ),
  );

  const rawRecords = observations.map((observation) => {
    const payload = {
      sourceRecordId: observation.sourceRecordId,
      countryCode: observation.countryCode,
      adminArea: observation.adminArea,
      coordinates: observation.location.coordinates,
      observedAt: observation.observedAt.toISOString(),
      metrics: observation.metrics,
    };
    return {
      sourceSystem: observation.sourceSystem,
      sourceInstance: observation.sourceInstance,
      sourceRecordId: observation.sourceRecordId,
      countryCode: observation.countryCode,
      payload,
      checksum: stableChecksum(payload),
      schemaVersion: '1.0',
      receivedAt: observation.receivedAt,
      ingestionRunId: INGESTION_RUN_ID,
      sharingPolicyId: observation.sharingPolicyId,
      isDemo: true,
      scenarioId: observation.scenarioId,
    } satisfies HubDemoRawSeed;
  });

  const signals = observations
    .filter((observation) => observation.stage !== 'observation')
    .map((observation) => {
      const verified = observation.stage === 'verified-alert';
      return {
        signalCode: `SIG-${observation.sourceRecordId}`,
        observationId: observation.canonicalId,
        riskLevel: observation.severity,
        confidenceScore: verified ? 0.92 : 0.78,
        explanation:
          'Signal de démonstration issu de règles déterministes et destiné à une vérification humaine.',
        status: verified ? 'VERIFIED' : 'SIGNAL_DETECTED',
        assignedTo: null,
        detectedAt: observation.receivedAt,
        reviewStartedAt: verified ? observation.receivedAt : null,
        decidedAt: verified ? observation.receivedAt : null,
        decisionNote: verified
          ? 'Validation humaine fictive préchargée pour la démonstration.'
          : '',
        countryCode: observation.countryCode,
        sharingPolicyId: observation.sharingPolicyId,
        isDemo: true,
      } satisfies HubDemoSignalSeed;
    });

  const alerts = observations
    .filter((observation) => observation.stage === 'verified-alert')
    .map(
      (observation) =>
        ({
          alertCode: `ALT-${observation.sourceRecordId}`,
          signalCode: `SIG-${observation.sourceRecordId}`,
          observationId: observation.canonicalId,
          title: observation.title,
          summary: observation.summary,
          riskLevel: observation.severity,
          countryCode: observation.countryCode,
          status: 'VERIFIED',
          verifiedBy: 'DEMO-SEED',
          verifiedAt: observation.receivedAt,
          verificationNote:
            'Validation humaine fictive préchargée pour la démonstration.',
          sharingPolicyId: observation.sharingPolicyId,
          isDemo: true,
        }) satisfies HubDemoAlertSeed,
    );

  const countryCodes = COUNTRIES.map((country) => country.code);
  const sharingPolicies = COUNTRIES.map(
    (country) =>
      ({
        policyId: `POLICY-DEMO-${country.code}`,
        countryOwner: country.code,
        sharingLevel: 'REGIONAL_AUTHORIZED',
        allowedRoles: [
          HubRole.VIEWER,
          HubRole.ANALYST,
          HubRole.VERIFIER,
          HubRole.ADMIN,
        ],
        allowedCountries: countryCodes,
        aggregationLevel: 'ADMIN_1',
        retentionPeriodDays: 365,
        containsPersonalData: false,
        isDemo: true,
      }) satisfies HubDemoSharingPolicySeed,
  );

  return { rawRecords, observations, signals, alerts, sharingPolicies };
}
