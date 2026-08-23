import { DistributedLeaseSchema } from './distributed-lease.schema';
import { RateLimitBucketSchema } from './rate-limit-bucket.schema';

describe('coordination schemas', () => {
  it.each([
    ['rate limit bucket', RateLimitBucketSchema],
    ['distributed lease', DistributedLeaseSchema],
  ])('uses a string HMAC identifier for %s', (_name, schema) => {
    expect(schema.path('_id').instance).toBe('String');
  });

  it.each([
    ['rate limit bucket', RateLimitBucketSchema],
    ['distributed lease', DistributedLeaseSchema],
  ])('defines zero-offset expiry cleanup for %s', (_name, schema) => {
    expect(schema.indexes()).toEqual(
      expect.arrayContaining([
        [{ expiresAt: 1 }, expect.objectContaining({ expireAfterSeconds: 0 })],
      ]),
    );
  });
});
