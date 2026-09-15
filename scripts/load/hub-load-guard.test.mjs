import test from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig, validateIdentities } from './hub-load-guard.mjs';

const env = {
  OHN_LOAD_CONFIRM: 'ISOLATED_STAGING_TEST_DATA_ONLY',
  OHN_LOAD_BASE_URL: 'https://staging.example.test/api',
  OHN_LOAD_APPROVED_ORIGIN: 'https://staging.example.test',
};
test('defaults to a small smoke test and requires explicit capacity selection', () => {
  assert.equal(loadConfig(env).users, 2);
  assert.equal(loadConfig({ ...env, OHN_LOAD_PROFILE: 'capacity' }).users, 1000);
});
test('rejects production, aliases, credentials, redirects and malformed URLs', () => {
  for (const url of [
    'https://backend.onehealthnetwork.yaba-in.com/api',
    'https://onehealthdashboard.yaba-in.com/api',
    'http://staging.example.test/api', 'https://staging.example.test@backend.onehealthnetwork.yaba-in.com/api',
    'https://staging.example.test/api?target=prod', 'https://54.36.120.149/api',
    'https://staging.example.test/api/../api', 'https://staging.example.test/api#fragment',
  ]) assert.throws(() => loadConfig({ ...env, OHN_LOAD_BASE_URL: url }));
});
test('requires staging confirmation and approved origin', () => {
  assert.throws(() => loadConfig({ ...env, OHN_LOAD_CONFIRM: '' }));
  assert.throws(() => loadConfig({ ...env, OHN_LOAD_APPROVED_ORIGIN: 'https://preprod.example.test' }));
  assert.throws(() => loadConfig({ ...env, OHN_LOAD_PROFILE: 'stress' }));
});
test('rejects shared tokens and insufficient or unscoped identities without revealing them', () => {
  const row = { token: 'header.payload.signature', countryCodes: ['CM'] };
  assert.deepEqual(validateIdentities([row], 1), [row]);
  assert.throws(() => validateIdentities([row, row], 2));
  assert.throws(() => validateIdentities([row], 1000));
  assert.throws(() => validateIdentities([{ ...row, countryCodes: [] }], 1));
  assert.throws(() => validateIdentities([{ ...row, countryCodes: ['US'] }], 1));
});
