# Validation: Dashboard Foundations

**Status**: Complete — 25 September 2026

## Automated evidence

- Canonical documents are under `docs/project/`, are visible to the backend Git repository and are
  no longer excluded by a documentation ignore rule.
- `npm run api:check` (Dashboard): passed; the generated Angular types match
  `contracts/dashboard-api.openapi.yaml`.
- `npm run lint` (Dashboard): passed.
- `npm test -- --watch=false --browsers=ChromeHeadless --no-progress` (Dashboard): 73 tests passed.
- `npm run build` (Dashboard): production build passed.
- `npm ci --dry-run` (Dashboard): passed.
- `npm audit --omit=dev --audit-level=high` (Dashboard): zero known production vulnerabilities.
- `bash -n deploy-onehealth-dashboard.sh` using Git Bash: passed.
- `git diff --check` in the affected repositories: passed.

The backend change is limited to versioned documentation, the OpenAPI contract and this Spec Kit
record. It does not change backend source code, dependencies, runtime scripts or database schemas;
there is therefore no backend runtime regression surface requiring a new application build.

## Behaviour and architecture checks

- Both map consumers use `MapTileLayerService`; no page or shared map component contains a direct
  tile-provider URL.
- The `none` provider is covered by a unit test and leaves local borders and signals operational
  without an external basemap.
- Invalid custom tile settings fall back safely instead of injecting an arbitrary URL.
- Language selection is limited to French, English, Portuguese and Spanish, persisted locally,
  reflected in the document language and covered by service/pipe tests. French remains the
  deterministic fallback.
- The language selector and scenario dialog remain keyboard-operable with native controls and
  explicit focus restoration.
- The scenario dialog owns its focus, scroll locking, validation presentation and typed actions;
  the dashboard page retains API orchestration. The pure submit rule is unit-tested against busy
  and invalid states.
- No translation is inserted with `innerHTML`; runtime values continue through Angular escaping.

## Accepted limitations

- OpenStreetMap remains the default demonstration preset, without availability or capacity SLA.
  An institutional deployment must configure an approved provider or use the provider-disabled
  mode.
- Internationalisation is a progressive foundation: the application shell and scenario journey
  are migrated, while legacy page-specific labels remain French until their dedicated migration.
- Independent Dashboard CI jobs must retrieve the exact backend contract version before running
  generation and drift validation.
- Karma can log a missing Inter font asset in its isolated test server; the production build embeds
  the font correctly and the warning does not affect the 73 passing tests.
- No production deployment, Git push or database migration was performed as part of this change.
