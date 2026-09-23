import type {
  CeeacCountryCode,
  HubSector,
  HubSourceSystem,
} from '../hub.constants';

export const HUB_SCENARIO_ANALYSIS_TYPE = 'CROSS_SECTOR_CONVERGENCE' as const;
export const HUB_SCENARIO_SECTORS = [
  'human',
  'animal',
  'environment',
] as const satisfies readonly HubSector[];
export const HUB_SCENARIO_SOURCE_SYSTEMS = [
  'DHIS2',
  'ARIS 3',
  'CAPC-AC',
] as const satisfies readonly HubSourceSystem[];

export interface HubScenarioConfigurationSnapshot {
  readonly sourceCountryCode: CeeacCountryCode;
  readonly comparisonCountryCode: CeeacCountryCode;
  readonly dateFrom: string;
  readonly dateTo: string;
  readonly sectors: readonly HubSector[];
  readonly sourceSystems: readonly HubSourceSystem[];
  readonly analysisType: typeof HUB_SCENARIO_ANALYSIS_TYPE;
}

export interface HubScenarioCountryProfile {
  readonly code: CeeacCountryCode;
  readonly name: string;
  readonly adminArea: string;
  readonly coordinates: readonly [number, number];
}

export const HUB_SCENARIO_COUNTRIES: Readonly<
  Record<CeeacCountryCode, HubScenarioCountryProfile>
> = {
  AO: {
    code: 'AO',
    name: 'Angola',
    adminArea: 'Luanda',
    coordinates: [13.2344, -8.8383],
  },
  BI: {
    code: 'BI',
    name: 'Burundi',
    adminArea: 'Bujumbura Mairie',
    coordinates: [29.9189, -3.3731],
  },
  CM: {
    code: 'CM',
    name: 'Cameroun',
    adminArea: 'Centre',
    coordinates: [11.5021, 3.848],
  },
  CF: {
    code: 'CF',
    name: 'République centrafricaine',
    adminArea: 'Bangui',
    coordinates: [18.5582, 4.3947],
  },
  TD: {
    code: 'TD',
    name: 'Tchad',
    adminArea: "N'Djamena",
    coordinates: [15.0557, 12.1348],
  },
  CG: {
    code: 'CG',
    name: 'Congo',
    adminArea: 'Brazzaville',
    coordinates: [15.2663, -4.2634],
  },
  CD: {
    code: 'CD',
    name: 'République démocratique du Congo',
    adminArea: 'Kinshasa',
    coordinates: [15.2663, -4.4419],
  },
  GQ: {
    code: 'GQ',
    name: 'Guinée équatoriale',
    adminArea: 'Bioko Norte',
    coordinates: [8.7832, 3.7504],
  },
  GA: {
    code: 'GA',
    name: 'Gabon',
    adminArea: 'Estuaire',
    coordinates: [9.4673, 0.4162],
  },
  RW: {
    code: 'RW',
    name: 'Rwanda',
    adminArea: 'Ville de Kigali',
    coordinates: [30.0619, -1.9441],
  },
  ST: {
    code: 'ST',
    name: 'São Tomé-et-Príncipe',
    adminArea: 'Água Grande',
    coordinates: [6.7273, 0.3365],
  },
};

export function defaultHubScenarioConfiguration(
  now = new Date(),
): HubScenarioConfigurationSnapshot {
  const dateTo = isoDate(now);
  const from = new Date(`${dateTo}T00:00:00.000Z`);
  from.setUTCDate(from.getUTCDate() - 29);
  return {
    sourceCountryCode: 'CM',
    comparisonCountryCode: 'TD',
    dateFrom: isoDate(from),
    dateTo,
    sectors: HUB_SCENARIO_SECTORS,
    sourceSystems: HUB_SCENARIO_SOURCE_SYSTEMS,
    analysisType: HUB_SCENARIO_ANALYSIS_TYPE,
  };
}

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}
