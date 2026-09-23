import { createHash } from 'crypto';
import { HUB_DYNAMIC_SCENARIO_CODE } from '../hub.constants';
import {
  HubDemoObservationSeed,
  HubDemoRawSeed,
  HubDemoSignalSeed,
} from '../seeds/hub-demo-data.factory';
import {
  defaultHubScenarioConfiguration,
  HUB_SCENARIO_COUNTRIES,
  type HubScenarioConfigurationSnapshot,
} from './hub-scenario-configuration';

export interface HubDynamicScenarioBundle {
  readonly scenarioCode: string;
  readonly title: string;
  readonly description: string;
  readonly configuration: HubScenarioConfigurationSnapshot;
  readonly steps: readonly { code: string; label: string }[];
  readonly rawRecords: readonly HubDemoRawSeed[];
  readonly observations: readonly HubDemoObservationSeed[];
  readonly signal: HubDemoSignalSeed;
}

const SOURCE_INSTANCE = 'scenario-dynamic-ceeac';

export function buildDynamicScenario(
  now = new Date(),
  requestedConfiguration?: HubScenarioConfigurationSnapshot,
): HubDynamicScenarioBundle {
  const configuration =
    requestedConfiguration ?? defaultHubScenarioConfiguration(now);
  const source = HUB_SCENARIO_COUNTRIES[configuration.sourceCountryCode];
  const comparison =
    HUB_SCENARIO_COUNTRIES[configuration.comparisonCountryCode];
  const fromKey = configuration.dateFrom.replaceAll('-', '');
  const toKey = configuration.dateTo.replaceAll('-', '');
  const periodKey = `${fromKey}-${toKey}`;
  const scenarioCode = requestedConfiguration
    ? `SCN-${source.code}-${comparison.code}-${periodKey}`
    : HUB_DYNAMIC_SCENARIO_CODE;
  const idSuffix = `${source.code}-${comparison.code}-${periodKey}`;
  const legacy = !requestedConfiguration;
  const environmentId = legacy ? 'OBS-CAPC-CM-91' : `OBS-CAPC-${idSuffix}`;
  const animalId = legacy ? 'OBS-ARIS-CM-91' : `OBS-ARIS-${idSuffix}`;
  const humanSourceId = legacy ? 'OBS-DHIS2-CM-91' : `OBS-DHIS2-${idSuffix}`;
  const humanComparisonId = legacy
    ? 'OBS-DHIS2-TD-91'
    : `OBS-DHIS2-${comparison.code}-${source.code}-${periodKey}`;
  const sourcePolicy = `POLICY-DEMO-${source.code}`;
  const comparisonPolicy = `POLICY-DEMO-${comparison.code}`;
  const observedAt = observationTime(configuration, now);
  const observations: HubDemoObservationSeed[] = [
    observation(
      {
        canonicalId: environmentId,
        sourceSystem: 'CAPC-AC',
        sourceRecordId: legacy ? 'CAPC-CM-91' : `CAPC-${idSuffix}`,
        sector: 'environment',
        countryCode: source.code,
        countryName: source.name,
        adminArea: source.adminArea,
        coordinates: offset(source.coordinates, -0.08, 0.07),
        category: 'Anomalie hydroclimatique simulée',
        title: `Anomalie hydroclimatique simulée en ${source.name}`,
        summary:
          'Le flux CAPC-AC simulé relève une anomalie pluviométrique et des zones d’eau stagnante susceptibles de favoriser des vecteurs.',
        stage: 'observation',
        severity: 'high',
        metrics: [
          { label: 'Anomalie de pluie', value: 64, unit: '%' },
          { label: 'Zones affectées', value: 18, unit: 'km²' },
        ],
        sharingPolicyId: sourcePolicy,
        observedAt,
        receivedAt: now,
      },
      scenarioCode,
    ),
    observation(
      {
        canonicalId: animalId,
        sourceSystem: 'ARIS 3',
        sourceRecordId: legacy ? 'ARIS-CM-91' : `ARIS-${idSuffix}`,
        sector: 'animal',
        countryCode: source.code,
        countryName: source.name,
        adminArea: source.adminArea,
        coordinates: offset(source.coordinates, 0.06, 0.09),
        category: 'Mortalité animale inhabituelle simulée',
        title: `Hausse simulée de mortalité animale en ${source.name}`,
        summary:
          'Le flux ARIS 3 simulé signale plusieurs foyers rapprochés de mortalité et de fièvre chez les petits ruminants.',
        stage: 'observation',
        severity: 'high',
        metrics: [
          { label: 'Animaux symptomatiques', value: 87, unit: 'cas' },
          { label: 'Foyers notifiés', value: 6, unit: 'foyers' },
        ],
        sharingPolicyId: sourcePolicy,
        observedAt: addMinutes(observedAt, 8),
        receivedAt: now,
      },
      scenarioCode,
    ),
    observation(
      {
        canonicalId: humanSourceId,
        sourceSystem: 'DHIS2',
        sourceRecordId: legacy ? 'DHIS2-CM-91' : `DHIS2-${idSuffix}`,
        sector: 'human',
        countryCode: source.code,
        countryName: source.name,
        adminArea: source.adminArea,
        coordinates: offset(source.coordinates, -0.03, 0.04),
        category: 'Syndrome fébrile aigu simulé',
        title: `Hausse simulée de syndromes fébriles en ${source.name}`,
        summary:
          'Le flux DHIS2 simulé relève une hausse inhabituelle des consultations pour fièvre aiguë à proximité des foyers animaux.',
        stage: 'signal',
        severity: 'critical',
        metrics: [
          { label: 'Cas suspects', value: 43, unit: 'cas' },
          { label: 'Écart au seuil', value: 71, unit: '%' },
        ],
        sharingPolicyId: sourcePolicy,
        observedAt: addMinutes(observedAt, 15),
        receivedAt: now,
      },
      scenarioCode,
    ),
    observation(
      {
        canonicalId: humanComparisonId,
        sourceSystem: 'DHIS2',
        sourceRecordId: legacy
          ? 'DHIS2-TD-91'
          : `DHIS2-${comparison.code}-${source.code}-${periodKey}`,
        sector: 'human',
        countryCode: comparison.code,
        countryName: comparison.name,
        adminArea: comparison.adminArea,
        coordinates: [...comparison.coordinates],
        category: 'Syndrome fébrile aigu simulé',
        title: `Cas fébriles concordants simulés en ${comparison.name}`,
        summary: `Le flux DHIS2 simulé de ${comparison.name} rapporte une tendance concordante pendant la période sélectionnée.`,
        stage: 'observation',
        severity: 'high',
        metrics: [
          { label: 'Cas suspects', value: 19, unit: 'cas' },
          { label: 'Formations sanitaires', value: 4, unit: 'sites' },
        ],
        sharingPolicyId: comparisonPolicy,
        observedAt: addMinutes(observedAt, 22),
        receivedAt: now,
      },
      scenarioCode,
    ),
  ];

  const signalCode = legacy ? 'SIG-DHIS2-CM-91' : `SIG-DHIS2-${idSuffix}`;
  const signalObservationId = humanSourceId;
  return {
    scenarioCode,
    title: `Convergence zoonotique ${source.name}–${comparison.name}`,
    description: `Simulation multisectorielle du ${configuration.dateFrom} au ${configuration.dateTo} : rapprochement de flux fictifs entre ${source.name} et ${comparison.name}.`,
    configuration,
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
    rawRecords: observations.map((item) => rawRecord(item, scenarioCode)),
    observations,
    signal: {
      signalCode,
      observationId: signalObservationId,
      riskLevel: 'critical',
      confidenceScore: 0.91,
      explanation: `Convergence temporelle de trois secteurs simulés en ${source.name}, avec une tendance humaine concordante en ${comparison.name}. Une validation humaine reste obligatoire.`,
      status: 'SIGNAL_DETECTED',
      assignedTo: null,
      detectedAt: now,
      reviewStartedAt: null,
      decidedAt: null,
      decisionNote: '',
      countryCode: source.code,
      sharingPolicyId: sourcePolicy,
      isDemo: true,
    },
  };
}

function observationTime(
  configuration: HubScenarioConfigurationSnapshot,
  now: Date,
): Date {
  const start = new Date(`${configuration.dateFrom}T00:00:00.000Z`);
  const selectedEnd = new Date(`${configuration.dateTo}T10:00:00.000Z`);
  const latest = new Date(now.getTime() - 30 * 60 * 1000);
  return new Date(
    Math.max(
      start.getTime(),
      Math.min(selectedEnd.getTime(), latest.getTime()),
    ),
  );
}

function addMinutes(value: Date, minutes: number): Date {
  return new Date(value.getTime() + minutes * 60 * 1000);
}

function offset(
  coordinates: readonly [number, number],
  longitude: number,
  latitude: number,
): [number, number] {
  return [coordinates[0] + longitude, coordinates[1] + latitude];
}

function observation(
  input: Omit<
    HubDemoObservationSeed,
    'location' | 'isDemo' | 'scenarioId' | 'sourceInstance'
  > & {
    coordinates: [number, number];
  },
  scenarioCode: string,
): HubDemoObservationSeed {
  const { coordinates, ...rest } = input;
  return {
    ...rest,
    sourceInstance: SOURCE_INSTANCE,
    location: { type: 'Point', coordinates },
    isDemo: true,
    scenarioId: scenarioCode,
  };
}

function rawRecord(
  item: HubDemoObservationSeed,
  scenarioCode: string,
): HubDemoRawSeed {
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
    ingestionRunId: `${scenarioCode}-${item.countryCode}`,
    sharingPolicyId: item.sharingPolicyId,
    isDemo: true,
    scenarioId: scenarioCode,
  };
}
