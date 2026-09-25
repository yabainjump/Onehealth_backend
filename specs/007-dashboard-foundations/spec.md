# Feature Specification: Dashboard Foundations

**Feature branch**: `007-dashboard-foundations`  
**Created**: 2026-09-24  
**Status**: In progress

## Problem

The regional dashboard currently has five structural weaknesses: its canonical documentation is
outside every Git repository, map components depend directly on a public OpenStreetMap tile URL,
the scenario UI is embedded in an oversized dashboard component, Angular duplicates backend API
contracts by hand, and the interface has no internationalisation foundation.

## User stories

### US1 — Versioned project knowledge (P1)

As a maintainer, I can review the product, architecture and agent instructions in Git so that a
clone contains the decisions required to change the three applications safely.

**Acceptance criteria**

1. The six canonical project documents are tracked under `onehealth_backend/docs/project/`.
2. The workspace `AGENTS.md` points to those tracked documents.
3. The documentation states that simulated Hub data must never be presented as institutional data.

### US2 — Replaceable map tile provider (P1)

As an operator, I can configure or disable the dashboard base-map provider at deployment time
without changing Angular source code.

**Acceptance criteria**

1. No page or map component hardcodes a public tile URL.
2. Invalid or disabled tile configuration leaves the sovereign CEEAC layers usable on a neutral
   background and exposes no secret.
3. Attribution remains visible and tile requests are not proxied, bulk-downloaded or prefetched.

### US3 — Maintainable scenario UI (P1)

As a frontend maintainer, I can change the scenario execution dialog independently from the
dashboard orchestration and API logic.

**Acceptance criteria**

1. The dialog is a standalone reusable component with typed inputs and outputs.
2. The dashboard page retains orchestration; the child owns presentation, focus and overlay scroll.
3. Existing start, retry, close and report actions behave as before.

### US4 — Generated dashboard API contracts (P1)

As a frontend developer, I consume versioned types generated from an OpenAPI contract instead of
redeclaring backend response shapes in Angular.

**Acceptance criteria**

1. The backend repository owns a versioned OpenAPI contract for dashboard endpoints.
2. Angular commits the generated TypeScript artifact and provides reproducible generate/check
   commands; generated files are never edited manually.
3. The Hub API service imports generated schemas for its wire contracts.

### US5 — Internationalisation foundation (P1)

As a CEEAC user, I can select French, English, Portuguese or Spanish and keep that preference on
the same browser.

**Acceptance criteria**

1. French is the deterministic fallback and missing keys never make the application crash.
2. The app shell and scenario workflow use translation keys rather than embedded labels.
3. The language selector is keyboard accessible and the selected language is persisted locally.

## Non-functional requirements

- No authentication, authorisation, data model or database behaviour changes.
- No secret, credential or environment-specific private value is committed.
- The three repositories remain independently buildable and deployable.
- Existing dashboard lint, unit tests and production build remain green.
- The public OpenStreetMap tile service remains a best-effort development/demo default only; an
  institutional deployment must configure a provider with an appropriate service commitment.

## Out of scope

- Deploying a self-hosted global tile stack.
- Translating every historical free-text datum or AI response.
- Replacing the REST API or splitting the backend into microservices.
- Publishing a private npm contract package in this iteration.
