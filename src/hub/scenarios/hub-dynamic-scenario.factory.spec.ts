import { HUB_DYNAMIC_SCENARIO_CODE } from '../hub.constants';
import { buildDynamicScenario } from './hub-dynamic-scenario.factory';
import {
  HUB_SCENARIO_ANALYSIS_TYPE,
  HUB_SCENARIO_SECTORS,
  HUB_SCENARIO_SOURCE_SYSTEMS,
} from './hub-scenario-configuration';

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

  it('builds deterministic identifiers for a configured country pair and period', () => {
    const scenario = buildDynamicScenario(
      new Date('2026-09-23T10:00:00.000Z'),
      {
        sourceCountryCode: 'GA',
        comparisonCountryCode: 'CG',
        dateFrom: '2026-09-01',
        dateTo: '2026-09-20',
        sectors: HUB_SCENARIO_SECTORS,
        sourceSystems: HUB_SCENARIO_SOURCE_SYSTEMS,
        analysisType: HUB_SCENARIO_ANALYSIS_TYPE,
      },
    );

    expect(scenario.scenarioCode).toBe('SCN-GA-CG-20260901-20260920');
    expect(scenario.configuration).toMatchObject({
      sourceCountryCode: 'GA',
      comparisonCountryCode: 'CG',
      dateFrom: '2026-09-01',
      dateTo: '2026-09-20',
    });
    expect(
      new Set(scenario.observations.map((item) => item.countryCode)),
    ).toEqual(new Set(['GA', 'CG']));
    expect(scenario.signal.countryCode).toBe('GA');
    expect(scenario.observations.every((item) => item.isDemo)).toBe(true);
  });
});
