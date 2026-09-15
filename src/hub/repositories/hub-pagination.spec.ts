import { HubRepository, HubObservationListFilter } from './hub.repository';
import { jest } from '@jest/globals';

describe('Scoped observation pagination', () => {
  function setup() {
    const query = {
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      maxTimeMS: jest.fn().mockReturnThis(),
      exec: jest.fn<() => Promise<unknown[]>>().mockResolvedValue([]),
    };
    const count = {
      maxTimeMS: jest.fn().mockReturnThis(),
      exec: jest.fn<() => Promise<number>>().mockResolvedValue(17),
    };
    const aggregate = {
      option: jest.fn().mockReturnThis(),
      exec: jest.fn<() => Promise<unknown[]>>().mockResolvedValue([]),
    };
    const model = {
      find: jest
        .fn<(filter: Record<string, unknown>) => typeof query>()
        .mockReturnValue(query),
      countDocuments: jest
        .fn<(filter: Record<string, unknown>) => typeof count>()
        .mockReturnValue(count),
      aggregate: jest
        .fn<(pipeline: Record<string, unknown>[]) => typeof aggregate>()
        .mockReturnValue(aggregate),
    };
    const unused = {} as never;
    const repo = new HubRepository(
      unused,
      model as never,
      unused,
      unused,
      unused,
      unused,
      unused,
      unused,
      unused,
    );
    return { query, count, model, aggregate, repo };
  }
  const filter: HubObservationListFilter = {
    allowedCountryCodes: ['CM'],
    page: 2,
    limit: 8,
  };

  it('uses identical scoped filters for rows and totals with stable bounded sorting', async () => {
    const { repo, model, query, count } = setup();
    expect(await repo.listObservations(filter)).toEqual({
      items: [],
      total: 17,
    });
    expect(model.find).toHaveBeenCalledWith({ countryCode: { $in: ['CM'] } });
    expect(model.countDocuments).toHaveBeenCalledWith(
      model.find.mock.calls[0][0],
    );
    expect(query.sort).toHaveBeenCalledWith({ observedAt: -1, canonicalId: 1 });
    expect(query.skip).toHaveBeenCalledWith(8);
    expect(query.limit).toHaveBeenCalledWith(8);
    expect(query.maxTimeMS).toHaveBeenCalledWith(5000);
    expect(count.maxTimeMS).toHaveBeenCalledWith(5000);
  });
  it('does not widen scope when a foreign country is requested', async () => {
    const { repo, model } = setup();
    await repo.listObservations({
      ...filter,
      countryCode: 'TD',
      view: 'priority',
    });
    expect(model.find).toHaveBeenCalledWith(
      expect.objectContaining({ countryCode: { $in: [] } }),
    );
    expect(model.countDocuments).toHaveBeenCalledWith(
      model.find.mock.calls[0][0],
    );
  });
  it('intersects priority and stage and escapes regular expressions', async () => {
    const { repo, model } = setup();
    await repo.listObservations({
      ...filter,
      stage: 'observation',
      view: 'priority',
      search: 'a.*',
    });
    const applied = model.find.mock.calls[0][0] as {
      stage: string;
      $and: unknown[];
      $or: { title?: RegExp }[];
    };
    expect(applied.stage).toBe('observation');
    expect(applied.$and).toEqual([
      { stage: { $in: ['signal', 'verified-alert'] } },
    ]);
    const regex = applied.$or.find((item) => item.title)?.title;
    expect(regex?.test('abc')).toBe(false);
    expect(regex?.test('a.*')).toBe(true);
  });
  it('sorts by country then by date and unique id', async () => {
    const { repo, query } = setup();
    await repo.listObservations({ ...filter, view: 'country' });
    expect(query.sort).toHaveBeenCalledWith({
      countryName: 1,
      observedAt: -1,
      canonicalId: 1,
    });
  });
  it('aggregates after scope restriction and returns actual empty counts', async () => {
    const { repo, model, aggregate } = setup();
    const result = await repo.summary(['CM']);
    expect(model.aggregate.mock.calls[0][0][0]).toEqual({
      $match: { countryCode: { $in: ['CM'] } },
    });
    expect(aggregate.option).toHaveBeenCalledWith({ maxTimeMS: 5000 });
    expect(result.total).toBe(0);
    expect(result.byStage).toEqual({
      observation: 0,
      signal: 0,
      'verified-alert': 0,
    });
  });
});
