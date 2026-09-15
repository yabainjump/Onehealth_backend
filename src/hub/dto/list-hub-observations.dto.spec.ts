import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListHubObservationsDto } from './list-hub-observations.dto';

describe('Observation pagination contract', () => {
  it('transforms bounded query strings', async () => {
    const dto = plainToInstance(ListHubObservationsDto, {
      page: '2',
      limit: '8',
      view: 'priority',
    });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.page).toBe(2);
  });
  it.each([
    { page: 0 },
    { page: 1001 },
    { limit: 101 },
    { limit: 1.5 },
    { page: 'NaN' },
    { view: '$where' },
    { countryCode: 'XX' },
    { search: 'x'.repeat(101) },
    { sector: { $ne: 'human' } },
  ])('rejects invalid input %j', async (input) => {
    expect(
      (await validate(plainToInstance(ListHubObservationsDto, input))).length,
    ).toBeGreaterThan(0);
  });
});
