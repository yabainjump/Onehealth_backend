import { createHubDemoConnectors } from './hub-demo-connectors.factory';

describe('createHubDemoConnectors', () => {
  it('creates one connector per source and CEEAC country', () => {
    const data = createHubDemoConnectors();

    expect(data.connectors).toHaveLength(33);
    expect(data.ingestionRuns).toHaveLength(33);
    expect(new Set(data.connectors.map((item) => item.connectorId)).size).toBe(
      33,
    );
    expect(new Set(data.connectors.map((item) => item.countryCode)).size).toBe(
      11,
    );
    expect(
      data.connectors.filter((item) => item.sourceSystem === 'DHIS2'),
    ).toHaveLength(11);
    expect(
      data.connectors.filter((item) => item.sourceSystem === 'ARIS 3'),
    ).toHaveLength(11);
    expect(
      data.connectors.filter((item) => item.sourceSystem === 'CAPC-AC'),
    ).toHaveLength(11);
  });

  it('marks every generated record as simulated and keeps failed states explicit', () => {
    const data = createHubDemoConnectors();

    expect(data.connectors.every((item) => item.isDemo)).toBe(true);
    expect(data.ingestionRuns.every((item) => item.isDemo)).toBe(true);
    expect(data.connectors.some((item) => item.status === 'error')).toBe(true);
    expect(data.connectors.some((item) => item.status === 'suspended')).toBe(
      true,
    );
    expect(
      data.connectors
        .filter((item) => item.status === 'operational')
        .every((item) => item.lastErrorCode === ''),
    ).toBe(true);
  });
});
