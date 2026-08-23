export type RuntimeState = 'starting' | 'ready' | 'not_ready' | 'draining';
export type DependencyState = 'up' | 'down';
export type OptionalCapability = 'rudolf' | 'email';

export interface EssentialDependencyChecks {
  primaryDatabase: DependencyState;
  hubDatabase: DependencyState;
  mediaStorage: DependencyState;
}

export interface RuntimeReadinessSnapshot {
  status: 'ok' | 'degraded' | 'unavailable';
  kind: 'ready';
  timestamp: string;
  version: string;
  instanceId: string;
  checks: EssentialDependencyChecks;
  degradedCapabilities: OptionalCapability[];
}

export const areEssentialDependenciesUp = (
  checks: EssentialDependencyChecks,
): boolean => Object.values(checks).every((state) => state === 'up');
