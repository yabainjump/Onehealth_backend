export const HUB_CONNECTION = 'hub';

export const CEEAC_COUNTRY_CODES = [
  'AO',
  'BI',
  'CM',
  'CF',
  'TD',
  'CG',
  'CD',
  'GQ',
  'GA',
  'RW',
  'ST',
] as const;

export type CeeacCountryCode = (typeof CEEAC_COUNTRY_CODES)[number];
export type HubSector = 'human' | 'animal' | 'environment';
export type HubSourceSystem = 'DHIS2' | 'ARIS 3' | 'CAPC-AC';
export type HubConnectorStatus =
  | 'operational'
  | 'degraded'
  | 'error'
  | 'suspended';
export type HubConnectorProtocol =
  | 'API_REST'
  | 'SYNC'
  | 'PUSH_SFTP'
  | 'GEOJSON';
export type HubObservationStage = 'observation' | 'signal' | 'verified-alert';
export type HubRiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type HubSignalStatus =
  | 'SIGNAL_DETECTED'
  | 'UNDER_VERIFICATION'
  | 'VERIFIED'
  | 'REJECTED'
  | 'CLOSED';
export type HubScenarioStatus = 'READY' | 'RUNNING' | 'COMPLETED' | 'FAILED';
export type HubReportStatus = 'DRAFT' | 'IN_REVIEW' | 'VALIDATED' | 'PUBLISHED';

export const HUB_DYNAMIC_SCENARIO_CODE = 'SCN-CM-TD-CONVERGENCE-01';

export const HUB_SIGNAL_TRANSITION_ERROR =
  "Transition refusée : le signal doit être assigné à l'expert connecté et en cours de vérification.";
