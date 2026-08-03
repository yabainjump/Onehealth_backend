import { createHash } from 'crypto';
import {
  HubDemoObservationSeed,
  HubDemoRawSeed,
  HubDemoSignalSeed,
} from '../seeds/hub-demo-data.factory';
import { HUB_DYNAMIC_SCENARIO_CODE } from '../hub.constants';

export interface HubDynamicScenarioBundle {
  readonly scenarioCode: typeof HUB_DYNAMIC_SCENARIO_CODE;
  readonly title: string;
  readonly description: string;
  readonly steps: readonly { code: string; label: string }[];
  readonly rawRecords: readonly HubDemoRawSeed[];
  readonly observations: readonly HubDemoObservationSeed[];
  readonly signal: HubDemoSignalSeed;
}

const POLICY_CM = 'POLICY-DEMO-CM';
const POLICY_TD = 'POLICY-DEMO-TD';
const SOURCE_INSTANCE = 'scenario-dynamic-ceeac';

export function buildDynamicScenario(
  now = new Date(),
): HubDynamicScenarioBundle {
  const observedAt = new Date(now.getTime() - 30 * 60 * 1000);
  const observations: HubDemoObservationSeed[] = [
    observation({
      canonicalId: 'OBS-CAPC-CM-91',
      sourceSystem: 'CAPC-AC',
      sourceRecordId: 'CAPC-CM-91',
      sector: 'environment',
      countryCode: 'CM',
      countryName: 'Cameroun',
      adminArea: 'Extrême-Nord',
      coordinates: [14.32, 10.59],
      category: 'Anomalie hydroclimatique',
      title: 'Inondations et stagnation des eaux dans le bassin du Logone',
      summary:
        'Les stations CAPC-AC relèvent un cumul pluviométrique anormal et plusieurs zones d’eau stagnante favorables aux vecteurs.',
      stage: 'observation',
      severity: 'high',
      metrics: [
        { label: 'Anomalie de pluie', value: 64, unit: '%' },
        { label: 'Zones inondées', value: 18, unit: 'km²' },
      ],
      sharingPolicyId: POLICY_CM,
      observedAt,
      receivedAt: now,
    }),
    observation({
      canonicalId: 'OBS-ARIS-CM-91',
      sourceSystem: 'ARIS 3',
      sourceRecordId: 'ARIS-CM-91',
      sector: 'animal',
      countryCode: 'CM',
      countryName: 'Cameroun',
      adminArea: 'Extrême-Nord',
      coordinates: [14.45, 10.72],
      category: 'Mortalité animale inhabituelle',
      title: 'Hausse de mortalité chez les petits ruminants',
      summary:
        'ARIS 3 signale plusieurs foyers rapprochés de mortalité et de fièvre chez les petits ruminants autour des zones inondées.',
      stage: 'observation',
      severity: 'high',
      metrics: [
        { label: 'Animaux symptomatiques', value: 87, unit: 'cas' },
        { label: 'Foyers notifiés', value: 6, unit: 'foyers' },
      ],
      sharingPolicyId: POLICY_CM,
      observedAt: new Date(observedAt.getTime() + 8 * 60 * 1000),
      receivedAt: now,
    }),
    observation({
      canonicalId: 'OBS-DHIS2-CM-91',
      sourceSystem: 'DHIS2',
      sourceRecordId: 'DHIS2-CM-91',
      sector: 'human',
      countryCode: 'CM',
      countryName: 'Cameroun',
      adminArea: 'Extrême-Nord',
      coordinates: [14.28, 10.63],
      category: 'Syndrome fébrile aigu',
      title: 'Augmentation de syndromes fébriles dans le bassin du Logone',
      summary:
        'DHIS2 relève une hausse inhabituelle des consultations pour fièvre aiguë dans les districts proches des foyers animaux.',
      stage: 'signal',
      severity: 'critical',
      metrics: [
        { label: 'Cas suspects', value: 43, unit: 'cas' },
        { label: 'Écart au seuil', value: 71, unit: '%' },
      ],
      sharingPolicyId: POLICY_CM,
      observedAt: new Date(observedAt.getTime() + 15 * 60 * 1000),
      receivedAt: now,
    }),
    observation({
      canonicalId: 'OBS-DHIS2-TD-91',
      sourceSystem: 'DHIS2',
      sourceRecordId: 'DHIS2-TD-91',
      sector: 'human',
      countryCode: 'TD',
      countryName: 'Tchad',
      adminArea: 'Mayo-Kebbi Est',
      coordinates: [15.03, 10.18],
      category: 'Syndrome fébrile aigu',
      title: 'Cas fébriles concordants signalés côté tchadien',
      summary:
        'Le système DHIS2 tchadien rapporte une tendance similaire le long du corridor transfrontalier du Logone.',
      stage: 'observation',
      severity: 'high',
      metrics: [
        { label: 'Cas suspects', value: 19, unit: 'cas' },
        { label: 'Formations sanitaires', value: 4, unit: 'sites' },
      ],
      sharingPolicyId: POLICY_TD,
      observedAt: new Date(observedAt.getTime() + 22 * 60 * 1000),
      receivedAt: now,
    }),
  ];

  const rawRecords = observations.map((item) => rawRecord(item));
  return {
    scenarioCode: HUB_DYNAMIC_SCENARIO_CODE,
    title: 'Convergence zoonotique Cameroun–Tchad',
    description:
      'Simulation multisectorielle : anomalie climatique, mortalité animale puis hausse de syndromes fébriles humains dans le bassin transfrontalier du Logone.',
    steps: [
      {
        code: 'INGEST_ENV',
        label: 'Ingestion du signal environnemental CAPC-AC',
      },
      { code: 'INGEST_ANIMAL', label: 'Ingestion du signal animal ARIS 3' },
      {
        code: 'INGEST_HUMAN',
        label: 'Ingestion des observations humaines DHIS2',
      },
      { code: 'NORMALIZE', label: 'Normalisation et contrôle de souveraineté' },
      {
        code: 'CORRELATE',
        label: 'Corrélation intersectorielle et transfrontalière',
      },
      {
        code: 'CREATE_SIGNAL',
        label: 'Création du signal à vérifier par un expert',
      },
    ],
    rawRecords,
    observations,
    signal: {
      signalCode: 'SIG-DHIS2-CM-91',
      observationId: 'OBS-DHIS2-CM-91',
      riskLevel: 'critical',
      confidenceScore: 0.91,
      explanation:
        'Convergence temporelle et géographique de trois secteurs : pluies anormales, mortalité animale et hausse de syndromes fébriles humains, avec extension transfrontalière vers le Tchad. Une validation humaine reste obligatoire.',
      status: 'SIGNAL_DETECTED',
      assignedTo: null,
      detectedAt: now,
      reviewStartedAt: null,
      decidedAt: null,
      decisionNote: '',
      countryCode: 'CM',
      sharingPolicyId: POLICY_CM,
      isDemo: true,
    },
  };
}

function observation(
  input: Omit<
    HubDemoObservationSeed,
    'location' | 'isDemo' | 'scenarioId' | 'sourceInstance'
  > & {
    coordinates: [number, number];
  },
): HubDemoObservationSeed {
  const { coordinates, ...rest } = input;
  return {
    ...rest,
    sourceInstance: SOURCE_INSTANCE,
    location: { type: 'Point', coordinates },
    isDemo: true,
    scenarioId: HUB_DYNAMIC_SCENARIO_CODE,
  };
}

function rawRecord(item: HubDemoObservationSeed): HubDemoRawSeed {
  const payload = {
    title: item.title,
    category: item.category,
    adminArea: item.adminArea,
    observedAt: item.observedAt.toISOString(),
    metrics: item.metrics,
  };
  return {
    sourceSystem: item.sourceSystem,
    sourceInstance: item.sourceInstance,
    sourceRecordId: item.sourceRecordId,
    countryCode: item.countryCode,
    payload,
    checksum: createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex'),
    schemaVersion: '1.0',
    receivedAt: item.receivedAt,
    ingestionRunId: `${HUB_DYNAMIC_SCENARIO_CODE}-${item.countryCode}`,
    sharingPolicyId: item.sharingPolicyId,
    isDemo: true,
    scenarioId: HUB_DYNAMIC_SCENARIO_CODE,
  };
}
