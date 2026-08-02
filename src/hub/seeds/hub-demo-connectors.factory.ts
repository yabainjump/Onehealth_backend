import {
  HubConnectorProtocol,
  HubConnectorStatus,
  HubSector,
  HubSourceSystem,
} from '../hub.constants';
import { HubIngestionRunStatus } from '../schemas/hub-ingestion-run.schema';

interface ConnectorCountry {
  readonly code: string;
  readonly name: string;
  readonly humanInstitution: string;
  readonly animalInstitution: string;
  readonly environmentInstitution: string;
}

interface ConnectorSource {
  readonly id: 'DHIS2' | 'ARIS' | 'CAPC';
  readonly system: HubSourceSystem;
  readonly sector: HubSector;
  readonly protocol: HubConnectorProtocol;
  readonly institutionKey:
    | 'humanInstitution'
    | 'animalInstitution'
    | 'environmentInstitution';
}

export interface HubDemoConnectorSeed {
  readonly connectorId: string;
  readonly countryCode: string;
  readonly countryName: string;
  readonly institution: string;
  readonly sector: HubSector;
  readonly sourceSystem: HubSourceSystem;
  readonly protocol: HubConnectorProtocol;
  readonly endpointAlias: string;
  readonly status: HubConnectorStatus;
  readonly availabilityPercent: number;
  readonly lastSyncAt: Date | null;
  readonly lastSuccessAt: Date | null;
  readonly nextSyncAt: Date | null;
  readonly recordsReceived: number;
  readonly recordsAccepted: number;
  readonly recordsRejected: number;
  readonly duplicateRecords: number;
  readonly lastDurationMs: number;
  readonly lastErrorCode: string;
  readonly lastErrorMessage: string;
  readonly enabled: boolean;
  readonly isDemo: true;
}

export interface HubDemoIngestionRunSeed {
  readonly runId: string;
  readonly connectorId: string;
  readonly countryCode: string;
  readonly status: HubIngestionRunStatus;
  readonly startedAt: Date;
  readonly completedAt: Date;
  readonly recordsReceived: number;
  readonly recordsAccepted: number;
  readonly recordsRejected: number;
  readonly duplicateRecords: number;
  readonly durationMs: number;
  readonly triggeredBy: 'SYSTEM';
  readonly actorId: 'DEMO-SEED';
  readonly errorCode: string;
  readonly isDemo: true;
}

export interface HubDemoConnectorBundle {
  readonly connectors: readonly HubDemoConnectorSeed[];
  readonly ingestionRuns: readonly HubDemoIngestionRunSeed[];
}

const REFERENCE_DATE = new Date('2026-08-02T12:00:00.000Z');

const COUNTRIES: readonly ConnectorCountry[] = [
  {
    code: 'AO',
    name: 'Angola',
    humanInstitution: 'MINSA',
    animalInstitution: 'MINAGRIF',
    environmentInstitution: 'INAMET',
  },
  {
    code: 'BI',
    name: 'Burundi',
    humanInstitution: 'MSPLS',
    animalInstitution: 'MINEAGRIE',
    environmentInstitution: 'IGEBU',
  },
  {
    code: 'CM',
    name: 'Cameroun',
    humanInstitution: 'MINSANTÉ',
    animalInstitution: 'MINEPIA',
    environmentInstitution: 'ONACC',
  },
  {
    code: 'CF',
    name: 'République centrafricaine',
    humanInstitution: 'MSP RCA',
    animalInstitution: 'MADR',
    environmentInstitution: 'Météo RCA',
  },
  {
    code: 'TD',
    name: 'Tchad',
    humanInstitution: 'MSPSN',
    animalInstitution: 'MEPA',
    environmentInstitution: 'ANAM',
  },
  {
    code: 'CG',
    name: 'Congo',
    humanInstitution: 'Min. Santé',
    animalInstitution: 'MAEP',
    environmentInstitution: 'ANAC Météo',
  },
  {
    code: 'CD',
    name: 'RDC',
    humanInstitution: 'MSP RDC',
    animalInstitution: 'MINAGRI',
    environmentInstitution: 'METTELSAT',
  },
  {
    code: 'GQ',
    name: 'Guinée équatoriale',
    humanInstitution: 'MINSABS',
    animalInstitution: 'Min. Agriculture',
    environmentInstitution: 'SMN GE',
  },
  {
    code: 'GA',
    name: 'Gabon',
    humanInstitution: 'Min. Santé',
    animalInstitution: 'Min. Agriculture',
    environmentInstitution: 'DGM Gabon',
  },
  {
    code: 'RW',
    name: 'Rwanda',
    humanInstitution: 'RBC',
    animalInstitution: 'RAB',
    environmentInstitution: 'Meteo Rwanda',
  },
  {
    code: 'ST',
    name: 'São Tomé-et-Príncipe',
    humanInstitution: 'Min. Saúde',
    animalInstitution: 'MAPDR',
    environmentInstitution: 'INM STP',
  },
] as const;

const SOURCES: readonly ConnectorSource[] = [
  {
    id: 'DHIS2',
    system: 'DHIS2',
    sector: 'human',
    protocol: 'API_REST',
    institutionKey: 'humanInstitution',
  },
  {
    id: 'ARIS',
    system: 'ARIS 3',
    sector: 'animal',
    protocol: 'SYNC',
    institutionKey: 'animalInstitution',
  },
  {
    id: 'CAPC',
    system: 'CAPC-AC',
    sector: 'environment',
    protocol: 'GEOJSON',
    institutionKey: 'environmentInstitution',
  },
] as const;

const STATUS_OVERRIDES: Readonly<
  Record<string, Exclude<HubConnectorStatus, 'operational'>>
> = {
  'DHIS2-BI': 'degraded',
  'ARIS-CF': 'degraded',
  'ARIS-GA': 'degraded',
  'CAPC-TD': 'error',
  'CAPC-CD': 'suspended',
};

function plusMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function statusDetails(
  key: string,
  countryIndex: number,
  sourceIndex: number,
): {
  status: HubConnectorStatus;
  availabilityPercent: number;
  lastSyncAt: Date | null;
  lastSuccessAt: Date | null;
  nextSyncAt: Date | null;
  errorCode: string;
  errorMessage: string;
} {
  const status = STATUS_OVERRIDES[key] ?? 'operational';
  const recencyMinutes = 12 + countryIndex * 13 + sourceIndex * 7;
  const lastAttempt = plusMinutes(REFERENCE_DATE, -recencyMinutes);

  if (status === 'suspended') {
    return {
      status,
      availabilityPercent: 0,
      lastSyncAt: null,
      lastSuccessAt: null,
      nextSyncAt: null,
      errorCode: 'CONNECTOR_DISABLED',
      errorMessage: 'Connecteur de démonstration suspendu par configuration.',
    };
  }
  if (status === 'error') {
    return {
      status,
      availabilityPercent: 41,
      lastSyncAt: plusMinutes(REFERENCE_DATE, -(2 * 24 * 60)),
      lastSuccessAt: plusMinutes(REFERENCE_DATE, -(2 * 24 * 60)),
      nextSyncAt: plusMinutes(REFERENCE_DATE, 30),
      errorCode: 'DEMO_ENDPOINT_TIMEOUT',
      errorMessage: "Le point d'accès simulé n'a pas répondu dans le délai.",
    };
  }
  if (status === 'degraded') {
    return {
      status,
      availabilityPercent: 84 + ((countryIndex + sourceIndex) % 5),
      lastSyncAt: lastAttempt,
      lastSuccessAt: lastAttempt,
      nextSyncAt: plusMinutes(REFERENCE_DATE, 45),
      errorCode: 'DEMO_PARTIAL_BATCH',
      errorMessage: 'Un lot simulé contient des lignes rejetées.',
    };
  }
  return {
    status,
    availabilityPercent: 97 + ((countryIndex + sourceIndex) % 3),
    lastSyncAt: lastAttempt,
    lastSuccessAt: lastAttempt,
    nextSyncAt: plusMinutes(REFERENCE_DATE, 60),
    errorCode: '',
    errorMessage: '',
  };
}

export function createHubDemoConnectors(): HubDemoConnectorBundle {
  const connectors = COUNTRIES.flatMap((country, countryIndex) =>
    SOURCES.map((source, sourceIndex) => {
      const key = `${source.id}-${country.code}`;
      const details = statusDetails(key, countryIndex, sourceIndex);
      const rejected = details.status === 'degraded' ? 1 : 0;
      const received = details.status === 'suspended' ? 0 : 5;
      const accepted = Math.max(0, received - rejected);
      return {
        connectorId: `CON-${source.id}-${country.code}`,
        countryCode: country.code,
        countryName: country.name,
        institution: country[source.institutionKey],
        sector: source.sector,
        sourceSystem: source.system,
        protocol: key === 'CAPC-TD' ? 'PUSH_SFTP' : source.protocol,
        endpointAlias: `${source.id.toLowerCase()}://${country.code.toLowerCase()}/demo`,
        status: details.status,
        availabilityPercent: details.availabilityPercent,
        lastSyncAt: details.lastSyncAt,
        lastSuccessAt: details.lastSuccessAt,
        nextSyncAt: details.nextSyncAt,
        recordsReceived: received,
        recordsAccepted: accepted,
        recordsRejected: rejected,
        duplicateRecords: 0,
        lastDurationMs:
          details.status === 'error' ? 30_000 : 720 + countryIndex * 41,
        lastErrorCode: details.errorCode,
        lastErrorMessage: details.errorMessage,
        enabled: details.status !== 'suspended',
        isDemo: true,
      } satisfies HubDemoConnectorSeed;
    }),
  );

  const ingestionRuns = connectors.map((connector) => {
    const failed =
      connector.status === 'error' || connector.status === 'suspended';
    const partial = connector.status === 'degraded';
    const completedAt = connector.lastSyncAt ?? REFERENCE_DATE;
    return {
      runId: `RUN-DEMO-${connector.connectorId}`,
      connectorId: connector.connectorId,
      countryCode: connector.countryCode,
      status: failed ? 'FAILED' : partial ? 'PARTIAL' : 'SUCCESS',
      startedAt: new Date(completedAt.getTime() - connector.lastDurationMs),
      completedAt,
      recordsReceived: connector.recordsReceived,
      recordsAccepted: connector.recordsAccepted,
      recordsRejected: connector.recordsRejected,
      duplicateRecords: connector.duplicateRecords,
      durationMs: connector.lastDurationMs,
      triggeredBy: 'SYSTEM',
      actorId: 'DEMO-SEED',
      errorCode: connector.lastErrorCode,
      isDemo: true,
    } satisfies HubDemoIngestionRunSeed;
  });

  return { connectors, ingestionRuns };
}
