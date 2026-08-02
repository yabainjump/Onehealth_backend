import { createHubDemoSeed } from './hub-demo-data.factory';

describe('createHubDemoSeed', () => {
  it('creates the expected deterministic CEEAC dataset', () => {
    const seed = createHubDemoSeed();

    expect(seed.rawRecords).toHaveLength(165);
    expect(seed.observations).toHaveLength(165);
    expect(seed.signals).toHaveLength(15);
    expect(seed.alerts).toHaveLength(3);
    expect(seed.sharingPolicies).toHaveLength(11);

    expect(
      seed.observations.filter((item) => item.sourceSystem === 'DHIS2'),
    ).toHaveLength(55);
    expect(
      seed.observations.filter((item) => item.sourceSystem === 'ARIS 3'),
    ).toHaveLength(55);
    expect(
      seed.observations.filter((item) => item.sourceSystem === 'CAPC-AC'),
    ).toHaveLength(55);
    expect(
      new Set(seed.observations.map((item) => item.canonicalId)).size,
    ).toBe(165);
  });

  it('produces stable checksums and only demo records', () => {
    const first = createHubDemoSeed();
    const second = createHubDemoSeed();

    expect(first.rawRecords.map((item) => item.checksum)).toEqual(
      second.rawRecords.map((item) => item.checksum),
    );
    expect(first.rawRecords.every((item) => item.checksum.length === 64)).toBe(
      true,
    );
    expect(first.observations.every((item) => item.isDemo)).toBe(true);
  });
});
