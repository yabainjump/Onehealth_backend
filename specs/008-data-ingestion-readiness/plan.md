# Implementation Plan: Data Ingestion Readiness

## Technical approach

1. Add versioned canonical field definitions and a pure parser/normaliser for CSV, JSON and point
   GeoJSON. Inputs are mapped only to allow-listed canonical fields.
2. Persist expiring preview batches containing accepted canonical candidates and minimal issue
   metadata. Persist quality issues in a separate scoped register without raw source payload.
3. Confirm batches through an atomic status claim, then idempotently upsert raw records and
   observations. Use stable source keys and make failed confirmations retryable.
4. Extend connector supervision with deterministic local simulation scenarios and ingestion runs.
5. Extend the backend-owned OpenAPI contract, regenerate Angular wire types and add one admin page
   for import, quality, dictionary and simulator controls.
6. Update product, architecture, security and operational documentation and validate both repos.

## Constitution Check — before design

- **Backend authority**: every mutation uses JWT, Hub access and Hub admin guards; country scope is
  checked again in the service/repository.
- **Sovereignty**: requested country must be in the effective server scope and match every row.
- **Lifecycle**: preview is staging only; confirmation creates raw records and observations only.
- **Human authority**: no automated signal, alert, validation or publication is introduced.
- **Simulation**: this release accepts only simulated content and persists `isDemo: true`.
- **Contracts and secrets**: bounded DTO content, allow-listed mappings, no provider credentials or
  outbound URL.
- **Audit and concurrency**: preview/confirmation/simulation are audited; confirmation uses a
  status claim and unique source identities.
- **Simplicity**: modular monolith and MongoDB remain sufficient; no queue or new infrastructure.

## Data flow

```text
Local file -> Angular FileReader -> POST preview -> parse/map/validate
          -> expiring batch + quality issues -> explicit confirm
          -> raw record + observation (idempotent) -> audit

Simulator request -> deterministic scenario -> ingestion run + connector state -> audit
```

## Failure and rollback

- Invalid files return bounded validation details and create no observation.
- A failed confirmation marks the batch retryable; unique indexes make a retry repair-safe.
- Removing the page and routes does not delete imported data. Operational rollback disables access
  by reverting backend then dashboard; no destructive migration is required.
- The two new collections can remain unused after rollback. Their indexes are additive.

## Constitution Check — after design

The design preserves all ten principles. The only deliberate limitation is the absence of a MongoDB
transaction across raw and observation writes; stable unique keys, retryable status and idempotent
upserts provide the documented reconciliation mechanism required by Principle III.
