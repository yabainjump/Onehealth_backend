# Tasks: Backend Load Balancing

**Input**: Design documents from `specs/001-backend-load-balancing/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: Required for distributed security, concurrency, readiness, graceful shutdown and rollback
because the project constitution classifies these behaviors as high risk.

**Organization**: Tasks are grouped by user story so that each increment remains independently
testable. All commands must run from the `onehealth_backend` repository root.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it changes different files and has no unfinished dependency.
- **[Story]**: Maps the task to a user story in `spec.md`.
- Every task includes its concrete target path.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish validated configuration and module boundaries without changing runtime behavior.

- [X] T001 Add validated cluster, proxy, pool, coordination and shutdown settings to `src/config/configuration.ts`
- [X] T002 [P] Document `WEB_CONCURRENCY`, `INSTANCE_ID`, `RATE_LIMIT_KEY_SECRET`, Mongo pool sizes, `TRUSTED_PROXY_HOPS`, lease durations and shutdown timeout in `.env.example`
- [X] T003 [P] Create the shared coordination module skeleton in `src/coordination/coordination.module.ts`
- [X] T004 [P] Create the request observability module skeleton in `src/observability/observability.module.ts`
- [X] T005 Add explicit primary and Hub Mongo pool settings from validated configuration in `src/app.module.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Implement shared primitives required by every multi-worker story.

**CRITICAL**: No user story implementation begins until this phase passes its tests.

- [X] T006 [P] Define the TTL-indexed `RateLimitBucket` schema without raw identities in `src/coordination/schemas/rate-limit-bucket.schema.ts`
- [X] T007 [P] Define the owner-token and TTL-indexed `DistributedLease` schema in `src/coordination/schemas/distributed-lease.schema.ts`
- [X] T008 Implement HMAC subject pseudonymization with secret validation and constant output shape in `src/coordination/subject-key.service.ts`
- [X] T009 Implement atomic fixed-window consumption and explicit unavailable-state errors in `src/coordination/distributed-rate-limit.service.ts`
- [X] T010 Implement atomic acquire, bounded retry, owner-checked release and expiry recovery in `src/coordination/distributed-lease.service.ts`
- [X] T011 Register both schemas and export coordination services from `src/coordination/coordination.module.ts`
- [X] T012 [P] Add unit tests for deterministic pseudonyms and absence of raw identity leakage in `src/coordination/subject-key.service.spec.ts`
- [X] T013 [P] Add concurrency and storage-failure tests for global buckets in `src/coordination/distributed-rate-limit.service.spec.ts`
- [X] T014 [P] Add concurrent acquisition, stale-owner release and expiry tests in `src/coordination/distributed-lease.service.spec.ts`
- [X] T015 Run `npm run lint`, `npm run build` and focused coordination tests, recording only pass/fail evidence in `specs/001-backend-load-balancing/validation/foundation.md`

**Checkpoint**: Shared coordination is atomic, bounded, secret-safe and testable independently.

---

## Phase 3: User Story 1 — Continuité pendant un déploiement (Priority: P1) MVP

**Goal**: Serve traffic with two same-host workers and replace them progressively without silently
losing or duplicating confirmed writes.

**Independent Test**: Run ordinary read/write traffic through two workers, stop one worker, then
reload; at least one ready worker remains, completed writes are not duplicated and explicit failures
remain visible.

### Tests for User Story 1

- [ ] T016 [P] [US1] Add lifecycle and readiness-supervisor tests for startup gating, consecutive essential failures, self-drain, bounded shutdown and anti-flapping behavior in `src/runtime/runtime-lifecycle.service.spec.ts` and `src/runtime/runtime-readiness.service.spec.ts`
- [ ] T017 [P] [US1] Add a safe two-worker continuity verifier that refuses production by default, performs ten consecutive reloads, measures removal below 10 seconds and detects infrastructure replay of non-idempotent writes in `scripts/verify-cluster-continuity.ts`

### Implementation for User Story 1

- [ ] T018 [US1] Implement active-request tracking and bounded shutdown in `src/runtime/runtime-lifecycle.service.ts`, plus continuous essential probes, consecutive-failure self-drain and replacement signaling in `src/runtime/runtime-readiness.service.ts`
- [ ] T019 [US1] Register shutdown hooks, startup-ready signaling, drain middleware and explicit 503 behavior for new non-health work in `src/main.ts`
- [ ] T020 [US1] Register runtime lifecycle providers globally in `src/runtime/runtime.module.ts` and `src/app.module.ts`
- [ ] T021 [US1] Configure two validated PM2 cluster workers, `wait_ready`, `listen_timeout`, `kill_timeout`, bounded restart delay, minimum uptime, restart limit and per-worker identity in `ecosystem.config.cjs`
- [ ] T022 [US1] Add the continuity verification command without embedding credentials in `package.json`
- [ ] T023 [US1] Execute ten reloads and worker-loss/readiness exercises in a disposable environment, then record availability, sub-10-second removal and zero infrastructure-replay evidence in `specs/001-backend-load-balancing/validation/us1-continuity.md`

**Checkpoint**: Process-level failure and progressive reload are survivable on the current host.

---

## Phase 4: User Story 2 — Sécurité cohérente entre instances (Priority: P1)

**Goal**: Apply authentication, upload and Rudolf limits globally, independent of the worker handling
each request, while failing closed when a reliable security decision is impossible.

**Independent Test**: Alternate requests across both instance identifiers; the total allowance equals
one configured window, blocked responses share a correct `Retry-After`, and coordination loss returns
an observable HTTP 503 rather than bypassing protection.

### Tests for User Story 2

- [ ] T024 [P] [US2] Replace local auth limiter tests with cross-instance and fail-closed cases in `src/auth/middleware/auth-rate-limit.middleware.spec.ts`
- [ ] T025 [P] [US2] Add cross-instance and fail-closed upload quota cases in `src/upload/upload-rate-limit.middleware.spec.ts`
- [ ] T026 [P] [US2] Replace Rudolf guard tests with short-window, daily-window and storage-failure cases in `src/rudolf/rudolf-rate-limit.guard.spec.ts`

### Implementation for User Story 2

- [ ] T027 [US2] Replace the in-memory authentication buckets with `DistributedRateLimitService` in `src/auth/middleware/auth-rate-limit.middleware.ts`
- [ ] T028 [US2] Replace the in-memory upload buckets with `DistributedRateLimitService` in `src/upload/upload-rate-limit.middleware.ts`
- [ ] T029 [US2] Replace both in-memory Rudolf quota windows with shared pseudonymized buckets in `src/rudolf/rudolf-rate-limit.guard.ts`
- [ ] T030 [US2] Import `CoordinationModule` through `src/auth/auth.module.ts`, `src/upload/upload.module.ts` and `src/rudolf/rudolf.module.ts`
- [ ] T031 [US2] Extend the safe cluster verifier with auth, upload and Rudolf aggregate quota checks in `scripts/verify-cluster-security.ts`
- [ ] T032 [US2] Execute security quota and coordination-failure tests and record sanitized evidence in `specs/001-backend-load-balancing/validation/us2-security.md`

**Checkpoint**: A second worker cannot multiply security or paid-provider allowances.

---

## Phase 5: User Story 3 — Conversations et médias cohérents (Priority: P2)

**Goal**: Keep existing media available to every same-host worker and serialize Rudolf operations per
owned conversation without orphan locks.

**Independent Test**: Upload then read the same permitted media through both workers; concurrently
send two Rudolf operations for one conversation and observe one owner with deterministic waiting or
HTTP 409, no duplicate exchange and recovery after owner death.

### Tests for User Story 3

- [ ] T033 [P] [US3] Add distributed lease, timeout, disconnect and no-duplicate exchange cases in `src/rudolf/rudolf.service.spec.ts`
- [ ] T034 [P] [US3] Add shared upload-root accessibility and immutability checks in `src/config/uploads-path.spec.ts`
- [ ] T035 [P] [US3] Add cross-worker media and Rudolf lease verification paths in `scripts/verify-cluster-media-rudolf.ts`

### Implementation for User Story 3

- [ ] T036 [US3] Replace `pendingByConversation` with owner-safe `DistributedLeaseService` execution in `src/rudolf/rudolf.service.ts`
- [ ] T037 [US3] Map bounded lease contention to stable `conversation_busy`, `Retry-After` and HTTP 409 responses in `src/rudolf/rudolf.controller.ts`
- [ ] T038 [US3] Validate a common absolute writable `UPLOADS_DIR` before accepting traffic in `src/config/uploads-path.ts`
- [ ] T039 [US3] Propagate abort and shutdown signals through provider streaming without partial persistence in `src/rudolf/groq-provider.service.ts` and `src/rudolf/rudolf.service.ts`
- [ ] T040 [US3] Execute media, concurrent Rudolf and killed-owner exercises and record sanitized evidence in `specs/001-backend-load-balancing/validation/us3-media-rudolf.md`

**Checkpoint**: Media and conversation behavior no longer depend on the selected worker.

---

## Phase 6: User Story 4 — Exploitation observable et réversible (Priority: P2)

**Goal**: Give the proxy and operator accurate readiness, safe per-request correlation and a tested
automatic rollback when a candidate deployment fails.

**Independent Test**: Break an essential dependency and observe live=200/ready=503, trace a failed
request by safe correlation ID, then reject a bad candidate and restore the last healthy revision
within the documented bound.

### Tests for User Story 4

- [ ] T041 [P] [US4] Add compatibility, liveness, readiness, degraded-provider and no-cache contract tests in `src/health/health.controller.spec.ts`
- [ ] T042 [P] [US4] Add inbound request-ID validation, generated-ID and redaction tests in `src/observability/request-context.middleware.spec.ts`
- [ ] T043 [P] [US4] Add Jest-based deployment-script validation and rollback cases without introducing Bats in `src/deployment/deploy-script.spec.ts`
- [ ] T044 [P] [US4] Add end-to-end checks for `X-Request-Id`, health contracts and unchanged authorization/country scope for every Hub role in `test/app.e2e-spec.ts`

### Implementation for User Story 4

- [ ] T045 [US4] Implement safe request-ID resolution, response propagation and duration context in `src/observability/request-context.middleware.ts`
- [ ] T046 [US4] Implement redacted structured request logging with instance identity in `src/observability/request-logger.service.ts`
- [ ] T047 [US4] Register request context and logging globally in `src/observability/observability.module.ts` and `src/main.ts`
- [ ] T048 [US4] Expose the runtime essential-readiness snapshot and optional degraded capability reporting in `src/health/health.service.ts`
- [ ] T049 [US4] Preserve `/api/health` and add `/live` plus `/ready` according to `contracts/health.openapi.yaml` in `src/health/health.controller.ts`
- [ ] T050 [US4] Inject database connections, upload-path checks and health service dependencies in `src/health/health.module.ts`
- [ ] T051 [US4] Make production proxy trust explicit and reject invalid topology configuration in `src/main.ts` and `src/config/configuration.ts`
- [ ] T052 [US4] Add pre-reload revision capture, local readiness, public readiness/CORS, worker-count verification and automatic rollback in `deploy-onehealth-backend.sh`
- [ ] T053 [US4] Run a timed correlation-ID diagnosis and rollback exercise, then record sanitized candidate revision, sub-5-minute trace result, rollback result and timings in `specs/001-backend-load-balancing/validation/us4-operations.md`

**Checkpoint**: Traffic selection is health-aware, incidents are traceable and deployment is reversible.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Close documentation, security, performance and release gates across all stories.

- [ ] T054 [P] Synchronize deployment topology, failure boundaries and future multi-host storage gate in `project-docs/ARCHITECTURE.md`
- [ ] T055 [P] Add the operational two-worker runbook, rollback procedure and degraded-mode interpretation in `project-docs/ARCHITECTURE-ESSENTIALS.md`
- [ ] T056 [P] Document all new configuration, health routes and single-host limitation in `README.md`
- [ ] T057 Calculate and document maximum Mongo connections as workers × logical connections × configured pool size in `specs/001-backend-load-balancing/validation/capacity.md`
- [ ] T058 Run `npm run lint`, `npm run build`, `npm test -- --runInBand` and `npm run test:e2e`, assert that `dist/` contains no `.specify`, `.agents`, `specs` or `project-docs` path, and record sanitized results in `specs/001-backend-load-balancing/validation/release.md`
- [ ] T059 Implement `scripts/verify-pilot-load.ts`, run the defined 10-minute/20-client pilot plus every applicable `quickstart.md` exercise in a disposable environment, and record p95 and remaining evidence in `specs/001-backend-load-balancing/validation/release.md`
- [ ] T060 Review all changed files for secrets, raw quota subjects, sensitive logs, sovereignty regressions and accidental multi-host claims, recording approval in `specs/001-backend-load-balancing/validation/release.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1** has no dependency and establishes configuration/module boundaries.
- **Phase 2** depends on Phase 1 and blocks all stories.
- **US1 and US2** both depend on Phase 2. They may proceed in parallel after the foundation, but the
  recommended MVP order is US1 then US2 because availability without coherent security is not releasable.
- **US3** depends on Phase 2 and uses the runtime shutdown behavior from US1 for killed-worker recovery.
- **US4** depends on US1 for lifecycle state and on Phase 2 for dependency observability.
- **Phase 7** follows every story selected for the release.

### User Story Dependencies

- **US1 (P1)**: Foundation only; independently proves process continuity.
- **US2 (P1)**: Foundation only; independently proves global security ceilings.
- **US3 (P2)**: Foundation plus US1 lifecycle integration; independently proves media and Rudolf consistency.
- **US4 (P2)**: Foundation plus US1 lifecycle state; independently proves health, tracing and rollback.

### Within Each User Story

1. Add or update tests and confirm they fail for the missing distributed behavior.
2. Implement models/services before adapters, middleware or controllers.
3. Run focused tests before the story-level external verifier.
4. Record evidence without credentials, request bodies or personal data.
5. Do not deploy a story whose security or rollback checkpoint is incomplete.

## Parallel Opportunities

- T002–T004 can run together after T001's configuration names are agreed.
- T006–T007 and T012–T014 operate on separate files; service tasks T009–T010 follow their schemas.
- US1 lifecycle tests and verifier (T016–T017) can be prepared concurrently.
- US2 tests (T024–T026) can be written concurrently, followed by their separate adapters (T027–T029).
- US3 test preparation (T033–T035) can run concurrently.
- US4 contract, middleware, deploy and e2e tests (T041–T044) can run concurrently.
- Documentation tasks T054–T056 can run concurrently after runtime contracts stabilize.

## Parallel Example: User Story 2

```text
Task T024: auth cross-instance quota tests
Task T025: upload cross-instance quota tests
Task T026: Rudolf short/daily quota tests

After those fail for the intended reason:
Task T027: auth distributed adapter
Task T028: upload distributed adapter
Task T029: Rudolf distributed adapter
```

## Parallel Example: User Story 4

```text
Task T041: health contract tests
Task T042: request correlation tests
Task T043: deployment rollback tests
Task T044: public e2e contract tests
```

## Implementation Strategy

### MVP First

1. Complete Phase 1 and Phase 2.
2. Complete US1 and prove two-worker continuity.
3. Complete US2 before exposing the second worker to production traffic.
4. Stop for a release review: this is the minimum safe multi-worker increment.

### Incremental Delivery

1. **Foundation**: validated configuration and shared Mongo coordination.
2. **Safe cluster MVP**: US1 + US2, providing process continuity without weakened limits.
3. **State consistency**: US3, removing Rudolf's process-local lock and validating shared media.
4. **Operational hardening**: US4, adding readiness, tracing and rollback.
5. **Release gate**: Phase 7 evidence, capacity calculation and documentation synchronization.

### Scope Guard

- This task list does not introduce Redis, containers, microservices or a second physical host.
- Multi-host traffic remains forbidden until shared/object media storage and infrastructure
  redundancy receive their own approved specification.
- PM2 cluster mode is not host-level high availability; documentation and demonstrations must say so.
- Spec Kit is committed to GitHub but must never appear under `dist/` or an application static root.

## Notes

- `[P]` means file-safe parallel work, not permission to skip its prerequisite phase.
- Tests must fail for the expected missing behavior before implementation and pass afterward.
- Each task should be committed alone or in a small coherent group once the project owner requests commits.
- Existing successful API response contracts remain compatible unless this specification explicitly says otherwise.
- Never store `.env` values, credentials, raw identities or production health payloads in validation evidence.
