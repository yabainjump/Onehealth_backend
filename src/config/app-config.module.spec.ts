import { environmentValidationSchema } from './app-config.module';

const validEnvironment = () => ({
  NODE_ENV: 'production',
  MONGODB_URI: 'mongodb://database.example.test/onehealth',
  JWT_SECRET: 'j'.repeat(64),
  RATE_LIMIT_KEY_SECRET: 'r'.repeat(64),
});

describe('environmentValidationSchema', () => {
  it('accepts a bounded production cluster configuration', () => {
    const result = environmentValidationSchema.validate(validEnvironment());

    expect(result.error).toBeUndefined();
    expect(result.value).toMatchObject({
      WEB_CONCURRENCY: 2,
      MONGODB_MAX_POOL_SIZE: 10,
      HUB_MONGODB_MAX_POOL_SIZE: 10,
      TRUSTED_PROXY_HOPS: 1,
    });
  });

  it('requires a distinct coordination key in production', () => {
    const missing = validEnvironment();
    delete (missing as Partial<typeof missing>).RATE_LIMIT_KEY_SECRET;

    expect(environmentValidationSchema.validate(missing).error).toBeDefined();
    expect(
      environmentValidationSchema.validate({
        ...validEnvironment(),
        RATE_LIMIT_KEY_SECRET: validEnvironment().JWT_SECRET,
      }).error,
    ).toBeDefined();
  });

  it('rejects unsafe pool, proxy and lease bounds', () => {
    expect(
      environmentValidationSchema.validate({
        ...validEnvironment(),
        MONGODB_MAX_POOL_SIZE: 101,
      }).error,
    ).toBeDefined();
    expect(
      environmentValidationSchema.validate({
        ...validEnvironment(),
        TRUSTED_PROXY_HOPS: 9,
      }).error,
    ).toBeDefined();
    expect(
      environmentValidationSchema.validate({
        ...validEnvironment(),
        GROQ_TIMEOUT_MS: 60_000,
        DISTRIBUTED_LEASE_TTL_MS: 64_999,
      }).error,
    ).toBeDefined();
  });
});
