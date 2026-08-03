import { HUB_DYNAMIC_SCENARIO_CODE } from '../hub.constants';
import { buildDynamicScenario } from './hub-dynamic-scenario.factory';

describe('buildDynamicScenario', () => {
  it('builds a deterministic multisector and cross-border scenario', () => {
    const scenario = buildDynamicScenario(new Date('2026-08-03T10:00:00.000Z'));

    expect(scenario.scenarioCode).toBe(HUB_DYNAMIC_SCENARIO_CODE);
    expect(scenario.observations).toHaveLength(4);
    expect(new Set(scenario.observations.map((item) => item.sector))).toEqual(
      new Set(['human', 'animal', 'environment']),
    );
    expect(
      new Set(scenario.observations.map((item) => item.countryCode)),
    ).toEqual(new Set(['CM', 'TD']));
    expect(scenario.rawRecords).toHaveLength(4);
    expect(
      scenario.rawRecords.every((item) => /^[a-f0-9]{64}$/.test(item.checksum)),
    ).toBe(true);
    expect(scenario.signal).toMatchObject({
      signalCode: 'SIG-DHIS2-CM-91',
      observationId: 'OBS-DHIS2-CM-91',
      status: 'SIGNAL_DETECTED',
      confidenceScore: 0.91,
    });
    expect(scenario.steps).toHaveLength(6);
  });
});
