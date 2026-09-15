import http from 'k6/http';
import { check, sleep } from 'k6';
import exec from 'k6/execution';
import { SharedArray } from 'k6/data';
import { Counter, Rate, Trend } from 'k6/metrics';
import { loadConfig, validateIdentities } from './hub-load-guard.mjs';

const config = loadConfig(__ENV);
const identities = new SharedArray('dedicated staging identities', () =>
  validateIdentities(JSON.parse(open(__ENV.OHN_LOAD_IDENTITIES_FILE)), config.users));
const scopeViolations = new Counter('scope_violations');
const plateauIterations = new Counter('plateau_iterations');
const plateauFailures = new Rate('plateau_failures');
const plateauDuration = new Trend('plateau_duration', true);

export const options = {
  setupTimeout: '10m',
  maxRedirects: 0,
  systemTags: ['status', 'method', 'name', 'scenario', 'expected_response'],
  summaryTrendStats: ['avg', 'p(95)', 'p(99)', 'max'],
  scenarios: {
    hub_reads: config.profile === 'smoke'
      ? { executor: 'constant-vus', vus: 2, duration: '30s' }
      : { executor: 'ramping-vus', startVUs: 0, gracefulRampDown: '30s', stages: [
        { duration: '1m', target: 10 }, { duration: '1m', target: 10 },
        { duration: '2m', target: 100 }, { duration: '2m', target: 100 },
        { duration: '2m', target: 500 }, { duration: '2m', target: 500 },
        { duration: '2m', target: 1000 }, { duration: '10m', target: 1000 },
        { duration: '2m', target: 0 },
      ] },
  },
  thresholds: {
    http_req_failed: [{ threshold: 'rate<0.01', abortOnFail: true, delayAbortEval: '30s' }],
    'http_req_duration{scenario:hub_reads}': ['p(95)<1000', 'p(99)<2500'],
    checks: ['rate>0.99'],
    scope_violations: [{ threshold: 'count==0', abortOnFail: true }],
    ...(config.profile === 'capacity' ? {
      plateau_iterations: ['count>=1000'],
      plateau_failures: ['rate<0.01'],
      plateau_duration: ['p(95)<1000', 'p(99)<2500'],
    } : {}),
  },
};

function params(identity, name) {
  return { headers: { Authorization: `Bearer ${identity.token}` }, timeout: '10s',
    redirects: 0, tags: { name } };
}

export function setup() {
  const ready = http.get(`${config.base}/health/ready`, { redirects: 0, timeout: '10s', tags: { name: 'readiness' } });
  if (ready.status !== 200) exec.test.abort('Staging readiness failed.');
  const ids = new Set();
  for (let i = 0; i < config.users; i++) {
    const identity = identities[i];
    const response = http.get(`${config.base}/auth/me`, params(identity, 'verify-test-identity'));
    let user;
    try { user = response.json(); } catch { exec.test.abort('Invalid identity response.'); }
    if (response.status !== 200 || !user?.id || ids.has(user.id) || user.role !== 'user' ||
        !Array.isArray(user.hubRoles) || user.hubRoles.length !== 1 || user.hubRoles[0] !== 'hub_viewer' ||
        !Array.isArray(user.hubCountryCodes) ||
        JSON.stringify([...user.hubCountryCodes].sort()) !== JSON.stringify([...identity.countryCodes].sort())) {
      exec.test.abort('Test users must be distinct, scoped, read-only Hub viewers.');
    }
    ids.add(user.id);
    sleep(0.05);
  }
}

function json(response) {
  try { return response.json(); } catch { return null; }
}

function measuredGet(path, identity, name, plateau) {
  const response = http.get(`${config.base}${path}`, params(identity, name));
  if (plateau) {
    plateauFailures.add(response.status !== 200);
    plateauDuration.add(response.timings.duration);
  }
  return response;
}

let availablePages = 1;

export default function () {
  const identity = identities[exec.vu.idInTest - 1];
  const age = Date.now() - exec.scenario.startTime;
  const plateau = config.profile === 'capacity' && age >= 12 * 60_000 && age < 22 * 60_000;
  const pageNumber = (exec.vu.iterationInScenario % Math.min(availablePages, 5)) + 1;
  const response = measuredGet(`/hub/observations?page=${pageNumber}&limit=8&view=all`, identity, 'observation-page', plateau);
  const page = json(response);
  check(response, {
    'page HTTP 200 (429 counts as failure)': (r) => r.status === 200,
    'bounded paginated contract': () => Array.isArray(page?.items) && page.items.length <= 8 && page.page === pageNumber && Number.isInteger(page.total),
  });
  if (Number.isInteger(page?.pages) && page.pages > 0) availablePages = page.pages;
  if (plateau) {
    plateauIterations.add(1);
  }
  scopeViolations.add(0);
  for (const item of Array.isArray(page?.items) ? page.items : []) {
    if (!identity.countryCodes.includes(item.countryCode)) {
      scopeViolations.add(1);
      exec.test.abort('Country scope violation. Stop and investigate.');
    }
  }
  if (exec.vu.iterationInScenario % 5 === 0) {
    const summary = measuredGet('/hub/summary', identity, 'observation-summary', plateau);
    check(summary, { 'summary HTTP 200': (r) => r.status === 200 });
  }
  if (exec.vu.iterationInScenario % 4 === 0 && page?.items?.[0]?.id) {
    const detail = measuredGet(`/hub/observations/${encodeURIComponent(page.items[0].id)}`, identity, 'observation-detail', plateau);
    check(detail, { 'detail HTTP 200': (r) => r.status === 200 });
    const dossier = json(detail);
    if (detail.status === 200 && (!dossier?.observation || !identity.countryCodes.includes(dossier.observation.countryCode) ||
        dossier.related?.some((item) => !identity.countryCodes.includes(item.countryCode)))) {
      scopeViolations.add(1);
      exec.test.abort('Dossier country scope violation.');
    }
  }
  sleep(4 + Math.random() * 2);
}
