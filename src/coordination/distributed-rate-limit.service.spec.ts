import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import { CoordinationUnavailableError } from './coordination.errors';
import { DistributedRateLimitService } from './distributed-rate-limit.service';
import { RateLimitBucket } from './schemas/rate-limit-bucket.schema';
import { SubjectKeyService } from './subject-key.service';

const queryResult = <T>(value: T, reject = false) => ({
  lean: () => ({
    exec: reject
      ? jest.fn().mockRejectedValue(value)
      : jest.fn().mockResolvedValue(value),
  }),
});

describe('DistributedRateLimitService', () => {
  const now = new Date('2026-08-23T12:04:00.000Z');
  let model: jest.Mocked<Pick<Model<RateLimitBucket>, 'findOneAndUpdate'>>;
  let service: DistributedRateLimitService;

  beforeEach(() => {
    model = { findOneAndUpdate: jest.fn() };
    const config = {
      get: jest.fn((key: string) =>
        key === 'rateLimitCleanupGraceMs' ? 3_600_000 : undefined,
      ),
    } as unknown as ConfigService;
    const subjectKeys = new SubjectKeyService({
      get: jest.fn().mockReturnValue('s'.repeat(64)),
    } as unknown as ConfigService);
    service = new DistributedRateLimitService(
      model as unknown as Model<RateLimitBucket>,
      config,
      subjectKeys,
    );
  });

  it('returns the atomic resulting count and fixed reset boundary', async () => {
    model.findOneAndUpdate.mockReturnValue(
      queryResult({
        count: 3,
        limitSnapshot: 3,
        resetAt: new Date('2026-08-23T12:15:00.000Z'),
      }) as never,
    );

    const result = await service.consume(
      {
        policy: 'auth-login',
        subject: '198.51.100.10',
        limit: 3,
        windowMs: 900_000,
      },
      now,
    );

    expect(result).toMatchObject({ allowed: true, count: 3, remaining: 0 });
    expect(result.resetAt).toEqual(new Date('2026-08-23T12:15:00.000Z'));
    expect(JSON.stringify(model.findOneAndUpdate.mock.calls)).not.toContain(
      '198.51.100.10',
    );
  });

  it('retries a duplicate-key insertion race as one atomic increment', async () => {
    model.findOneAndUpdate
      .mockReturnValueOnce(queryResult({ code: 11000 }, true) as never)
      .mockReturnValueOnce(
        queryResult({
          count: 2,
          limitSnapshot: 1,
          resetAt: new Date('2026-08-23T12:15:00.000Z'),
        }) as never,
      );

    const result = await service.consume(
      { policy: 'auth-login', subject: 'client', limit: 1, windowMs: 900_000 },
      now,
    );

    expect(result.allowed).toBe(false);
    expect(result.count).toBe(2);
    expect(model.findOneAndUpdate).toHaveBeenCalledTimes(2);
  });

  it('fails closed with a typed error when storage cannot decide', async () => {
    model.findOneAndUpdate.mockReturnValue(
      queryResult(new Error('database unavailable'), true) as never,
    );

    await expect(
      service.consume(
        { policy: 'upload', subject: 'client', limit: 30, windowMs: 900_000 },
        now,
      ),
    ).rejects.toBeInstanceOf(CoordinationUnavailableError);
  });
});
