# Feature Specification: Data Ingestion Readiness

**Feature branch**: `008-data-ingestion-readiness`  
**Created**: 2026-09-28  
**Status**: Approved by product request

## Problem

The Hub has no institutional source API yet. It must nevertheless prepare a secure and demonstrable
ingestion path without inventing provider contracts or presenting simulated records as official.

## User stories

### US1 — Controlled file preview (P1)

As a Hub administrator, I can select a bounded CSV, JSON or point GeoJSON file and preview its
normalisation before any observation is written.

**Acceptance criteria**

1. The backend validates format, size, row count, mapping, CEEAC country, sector, dates, coordinates
   and canonical severity; the browser is never the authority.
2. Preview does not create raw records, observations, signals or alerts.
3. Unsupported or malformed rows are reported without returning their complete source payload.
4. The first release accepts simulated data only and labels it durably as such.

### US2 — Explicit, idempotent confirmation (P1)

As a Hub administrator, I can confirm an owned preview and ingest only its accepted rows once.

**Acceptance criteria**

1. Confirmation rechecks actor, country scope, batch status and expiry.
2. Raw records and observations use deterministic identities and unique source keys; retry repairs a
   partial failure without producing duplicates.
3. Imported records remain observations. No signal, verified alert or official report is created.
4. Preview and confirmation are audited with actor, batch, country, counts and simulation marker.

### US3 — Data quality and quarantine register (P1)

As an analyst or administrator, I can inspect paginated validation issues in my authorised country
scope so that invalid source rows are visible and traceable.

**Acceptance criteria**

1. Issues expose row, source record identifier when safe, code, field and explanation, not raw data.
2. Country scope is applied in MongoDB before pagination and totals.
3. Empty, loading and error states are distinct in the Dashboard.

### US4 — Connector failure simulator (P1)

As a Hub administrator, I can run deterministic connector scenarios to demonstrate success,
duplicates, invalid rows, partial failure, authentication rejection and timeout without calling an
external platform.

**Acceptance criteria**

1. Every run is explicitly simulated, audited and stored as an ingestion run.
2. A simulation never stores a provider credential and never performs an outbound network request.
3. The response and connector supervision show received, accepted, rejected and duplicate counts.

### US5 — Canonical dictionary and mapping (P1)

As an integration engineer, I can consult a versioned canonical data dictionary and map bounded
source fields to allow-listed targets without changing application code.

**Acceptance criteria**

1. Required/optional fields, types, limits and accepted values are returned by the API and shown in
   the Dashboard.
2. Mapping targets are allow-listed; duplicate targets and dangerous property names are rejected.
3. Mapping version and source provenance are persisted with every accepted record.

## Non-functional requirements

- Admin-only mutation endpoints, JWT and Hub access guard remain mandatory.
- Request content is limited to 48 KiB, 500 records and 32 fields per record. This remains below
  the global JSON parser ceiling; larger future files require a streamed endpoint.
- Preview batches expire after 24 hours; quality issues contain no unrestricted raw payload.
- No new queue, microservice, external storage, provider dependency or secret is introduced.
- Existing demo seed and 165 observations remain untouched.

## Out of scope

- Real DHIS2, ARIS 3 or CAPC-AC authentication and provider-specific mappings.
- Personal or patient-level data.
- Antivirus or permanent storage of uploaded files; the browser submits bounded text content only.
- Automatic signal creation, correlation, alert verification or report publication.
- Correction/resubmission UI for quarantined rows in this first iteration.
