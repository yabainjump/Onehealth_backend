# Validation — 006

## Local evidence — 26 September 2026

- `npm run lint` (backend): pass.
- `npx eslint scripts/migrate-certification-media.ts`: pass.
- `npm run build` (backend): pass.
- `npm test -- --runInBand` (backend): 49 suites, 232 tests passed.
- focused backend security tests: 5 suites, 43 tests passed, including wrong
  uploader, wrong namespace, legacy message URL, private derivative, expired
  signature and encoded parent-segment traversal.
- Dashboard `npm run lint`, production build and spec TypeScript check: pass.
- Dashboard focused Karma run: compilation succeeds, but local ChromeHeadless 153
  disconnects on ping before executing the spec. The new spec remains type-checked;
  it must be executed by Jenkins/Linux before promotion.
- Ionic `npm run lint`, app/spec TypeScript checks: pass.
- Ionic focused login/register tests: 4/4 passed in ChromeHeadless.
- Ionic production/PWA build: pass, including asset copy, index generation and
  service-worker generation.
- `git diff --check` (backend, dashboard and Ionic): pass after the final source
  changes; line-ending notices are informational only.

No production data, remote request, deployment, or migration was performed. The
four code findings are fixed for new traffic after backend + frontend deployment.
Legacy certification evidence remains public until the operator completes
`migration.md`; therefore production remediation is not complete before that step.
