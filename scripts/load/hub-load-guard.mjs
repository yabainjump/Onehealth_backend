/** Pure validation, shared with Node tests. Never permits a production URL. */
export function loadConfig(env) {
  if (env.OHN_LOAD_CONFIRM !== 'ISOLATED_STAGING_TEST_DATA_ONLY') {
    throw new Error('Separate staging with test data must be explicitly confirmed.');
  }
  const base = env.OHN_LOAD_BASE_URL || '';
  // Deliberately strict: no IP, userinfo, query, fragments, redirects or public production host.
  if (!/^https:\/\/(?:staging|preprod)[.-][a-z0-9-]+(?:\.[a-z0-9-]+)+\/api$/.test(base)) {
    throw new Error('Only a canonical HTTPS staging/preprod hostname ending in /api is allowed.');
  }
  if (env.OHN_LOAD_APPROVED_ORIGIN !== base.slice(0, -4)) {
    throw new Error('Approved staging origin does not match the target.');
  }
  const profile = env.OHN_LOAD_PROFILE || 'smoke';
  if (!['smoke', 'capacity'].includes(profile)) throw new Error('Unknown load profile.');
  return { base, profile, users: profile === 'capacity' ? 1000 : 2 };
}

export function validateIdentities(rows, minimum) {
  if (!Array.isArray(rows) || rows.length < minimum || rows.length > 1000) {
    throw new Error('Provide the required number of dedicated test identities (maximum 1000).');
  }
  const tokens = new Set();
  const countries = new Set(['AO', 'BI', 'CM', 'CF', 'TD', 'CG', 'CD', 'GQ', 'GA', 'RW', 'ST']);
  for (const row of rows) {
    if (typeof row?.token !== 'string' || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(row.token) || row.token.length > 8192) {
      throw new Error('Invalid test token format.');
    }
    if (tokens.has(row.token)) throw new Error('Each virtual user needs a distinct test token.');
    tokens.add(row.token);
    if (!Array.isArray(row.countryCodes) || !row.countryCodes.length || row.countryCodes.some((code) => !countries.has(code))) {
      throw new Error('Each test identity needs its expected authorized CEEAC countries.');
    }
  }
  return rows;
}
