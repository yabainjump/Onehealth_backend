import { buildDynamicScenario } from './hub-dynamic-scenario.factory';
import { buildScenarioSimulationReport } from './hub-scenario-report.factory';

describe('buildScenarioSimulationReport', () => {
  it('produces a traceable and explicitly non-official report', () => {
    const generatedAt = new Date('2026-09-23T10:00:00.000Z');
    const report = buildScenarioSimulationReport(
      buildDynamicScenario(generatedAt),
      'EVT-CM-TD-TEST0001',
      generatedAt,
    );

    expect(report.reportId).toBe('SIM-SCN-CM-TD-CONVERGENCE-01');
    expect(report.reportType).toBe('SIMULATION');
    expect(report.official).toBe(false);
    expect(report.simulated).toBe(true);
    expect(report.countries.map((country) => country.countryCode)).toEqual([
      'CM',
      'TD',
    ]);
    expect(report.sourceSystems).toEqual(
      expect.arrayContaining(['CAPC-AC', 'ARIS 3', 'DHIS2']),
    );
    expect(report.observationIds).toHaveLength(4);
    expect(report.limitations.join(' ')).toContain('fictives');
  });
});
