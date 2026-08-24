// Tests must be reproducible without loading a developer or production .env file.
// These values are deliberately non-sensitive and must never be used at runtime.
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI ??= 'mongodb://127.0.0.1:27017/onehealth_jest';
process.env.JWT_SECRET ??= 'jest-only-jwt-secret-not-valid-outside-automated-tests';
process.env.RATE_LIMIT_KEY_SECRET ??=
  'jest-only-rate-limit-key-not-valid-outside-automated-tests';
