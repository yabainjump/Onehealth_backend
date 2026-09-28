# Validation: Data Ingestion Readiness

Status: locally validated on 28 September 2026.

This file will record executed commands, evidence, known limits and rollback notes. No production
API, database, deployment or external source will be contacted by this local feature work.

## Evidence

- `npm run build` (backend): passed.
- `npm run lint` (backend): passed.
- `npm test -- --runInBand` (backend): 50 suites, 238 tests passed.
- `npm run api:check` (dashboard): passed; generated contract is current.
- `npm run lint` (dashboard): passed.
- `npm test -- --watch=false` (dashboard): 80 tests passed in Chrome Headless.
- `npm run build` (dashboard): passed.

The parser suite covers canonical JSON, allowlisted CSV mapping, sector/severity rejection,
dangerous mapping names and GeoJSON Point coordinates. The full Nest module suite exercises schema
metadata and dependency wiring. No remote API, MongoDB production instance or deployment was used.

## Known limits and rollback

- Country polygon containment is not inferred from coordinates yet; country code and global
  coordinate bounds are validated, pending official administrative boundaries.
- Quality issues are listed but their resolve/dismiss workflow is deferred.
- Import batches are intentionally limited to 500 records and synchronous processing; use a queue
  only after measured institutional volumes justify it.
- Rollback is code-only: deploy the previous backend, then previous dashboard. New demo collections
  are additive and may remain; do not delete shared uploads or existing Hub data.
