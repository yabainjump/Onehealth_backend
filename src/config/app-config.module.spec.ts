import { environmentValidationSchema } from './app-config.module';

const validEnvironment = () => ({
  NODE_ENV: 'production',
  MONGODB_URI: 'mongodb://database.example.test/onehealth',
  JWT_SECRET: 'j'.repeat(64),
  RATE_LIMIT_KEY_SECRET: 'r'.repeat(64),
  CLUSTER_SECURITY_READY: true,
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
      READINESS_PROBE_INTERVAL_MS: 2_000,
      READINESS_PROBE_TIMEOUT_MS: 1_500,
      READINESS_FAILURE_THRESHOLD: 3,
      READINESS_RETRY_AFTER_SECONDS: 5,
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
    expect(
      environmentValidationSchema.validate({
        ...validEnvironment(),
        READINESS_PROBE_INTERVAL_MS: 1_000,
        READINESS_PROBE_TIMEOUT_MS: 1_000,
      }).error,
    ).toBeDefined();
    expect(
      environmentValidationSchema.validate({
        ...validEnvironment(),
        READINESS_FAILURE_THRESHOLD: 0,
      }).error,
    ).toBeDefined();
  });

  it('blocks multiple production workers until distributed security adapters are approved', () => {
    expect(
      environmentValidationSchema.validate({
        ...validEnvironment(),
        CLUSTER_SECURITY_READY: false,
      }).error,
    ).toBeDefined();
    expect(
      environmentValidationSchema.validate({
        ...validEnvironment(),
        WEB_CONCURRENCY: 1,
        CLUSTER_SECURITY_READY: false,
      }).error,
    ).toBeUndefined();
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
