# Implementation Plan: Backend Load Balancing

**Branch**: `001-backend-load-balancing` | **Date**: 2026-08-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-backend-load-balancing/spec.md`

## Summary

Run two backend workers on the current production host with progressive reload and explicit
readiness. Remove process-local security state by introducing a small coordination module backed by
the existing primary MongoDB connection: atomic fixed-window quotas and expiring ownership-safe
leases for Rudolf conversations. Keep the shared host upload directory for this increment, add
request correlation, graceful shutdown, bounded connection pools and deployment rollback. Defer
Redis, object storage and multi-host balancing until measurements or host-level availability require
them.

## Technical Context

**Language/Version**: TypeScript 5.7, Node.js 20.20.x

**Primary Dependencies**: NestJS 11, Mongoose 9, Passport JWT, PM2, Nginx Community and Jenkins Pipeline; no new Node.js runtime dependency required

**Storage**: Primary MongoDB database for coordination state, existing Hub MongoDB connection for Hub data, shared local upload directory on the single production host

**Testing**: Jest 30 unit tests, Nest testing utilities, existing e2e suite and dependency-free Node 20 cluster/load verifiers

**Target Platform**: Linux single host with Jenkins, PM2 and Nginx when VPS/root prerequisites are met; the current cPanel/LiteSpeed host requires an explicit web-server coexistence or migration decision before Nginx can own ports 80/443. Windows remains supported for local development without cluster signal guarantees

**Project Type**: Modular REST web service shared by the community application and CEEAC Dashboard

**Performance Goals**: Two ready workers; 95th percentile below 2 seconds during the defined 10-minute/20-client pilot; instance removal within 10 seconds; progressive deploy success of at least 99.9% across ten consecutive reloads

**Constraints**: Preserve current REST contracts and JWT behavior; no additional paid infrastructure; no WebSocket affinity; 512 MB restart ceiling per worker pending host measurement; process failure protection only in increment 1; Spec Kit remains versioned source material and is excluded from `dist/` and public static roots

**Release gate**: `CLUSTER_SECURITY_READY` remains false until US2 and US3 have validated every
auth/upload/Rudolf quota, the Rudolf conversation lease and the common media path against two real
workers. The normal deployment script refuses two production workers while this gate is closed.

**Scale/Scope**: Two workers, two logical MongoDB databases, three distributed limiter families, one distributed lease family, three public health routes including the compatibility route

## Constitution Check

*GATE: Passed before Phase 0 research and re-checked after Phase 1 design.*

| Constitutional gate | Design evidence | Result |
|---|---|---|
| Backend authority and least privilege | No guard or country-scope rule moves to the proxy or frontend | PASS |
| Sovereignty before processing | Every worker executes the existing server-side Hub scope resolution | PASS |
| Traceable data lifecycle | Coordination collections are operational only and do not merge Hub entities | PASS |
| Human health authority | No alert/report transition changes; Rudolf remains draft-only | PASS |
| Rudolf assistive only | Shared quota and lease reduce duplicate AI calls; provider remains optional | PASS |
| Simulated data clarity | Seed and fallback behavior are unchanged | PASS |
| Secure contracts and secrets | Subjects are HMAC-pseudonymized; new secret is environment-only; proxy trust is explicit | PASS |
| Auditable sensitive operations | Correlation IDs cross instance and deployment logs record promotion/rollback | PASS |
| Risk-proportional tests | Atomic quota, lease ownership, readiness, graceful reload, all Hub role/country scopes and ten-reload tests are planned | PASS |
| Measured modular scaling | Reuses MongoDB and the monolith; Redis/object storage/multi-host remain deferred | PASS |

Post-design review confirms there is no constitutional exception. MongoDB coordination is bounded to
small expiring documents, TTL deletion is cleanup rather than correctness, and local media storage is
explicitly permitted only for the single-host increment.

## Project Structure

### Documentation (this feature)

```text
specs/001-backend-load-balancing/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/
│   └── requirements.md
├── contracts/
│   ├── health.openapi.yaml
│   └── distributed-behavior.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── coordination/
│   ├── coordination.module.ts
│   ├── distributed-lease.service.ts
│   ├── distributed-rate-limit.service.ts
│   ├── schemas/
│   │   ├── distributed-lease.schema.ts
│   │   └── rate-limit-bucket.schema.ts
│   └── *.spec.ts
├── observability/
│   ├── observability.module.ts
│   ├── request-context.middleware.ts
│   ├── request-logger.service.ts
│   └── request-context.middleware.spec.ts
├── runtime/
│   ├── runtime.module.ts
│   ├── runtime-lifecycle.service.ts
│   ├── runtime-readiness.service.ts
│   └── *.spec.ts
├── deployment/
│   └── deploy-script.spec.ts
├── health/
│   ├── health.controller.ts
│   ├── health.service.ts
│   └── *.spec.ts
├── auth/
│   └── middleware/auth-rate-limit.middleware.ts
├── upload/
│   └── upload-rate-limit.middleware.ts
├── rudolf/
│   ├── rudolf-rate-limit.guard.ts
│   └── rudolf.service.ts
├── config/
│   ├── app-config.module.ts
│   └── configuration.ts
├── app.module.ts
└── main.ts

scripts/
├── verify-cluster-continuity.ts
├── verify-cluster-security.ts
├── verify-cluster-media-rudolf.ts
└── verify-pilot-load.ts

ops/
├── jenkins/
│   ├── deploy-onehealth-backend
│   └── onehealth-jenkins.sudoers
└── nginx/
    └── onehealth-backend.conf.example

test/
└── app.e2e-spec.ts

.env.example
ecosystem.config.cjs
deploy-onehealth-backend.sh
Jenkinsfile
README.md
```

**Structure Decision**: Keep the existing modular NestJS monolith. `coordination` owns all shared
ephemeral state so security middleware and Rudolf do not implement competing storage algorithms.
`observability` owns safe request identity. `health` evaluates dependencies without embedding
deployment logic. `runtime` owns draining, continuous essential-dependency readiness and PM2-ready
signaling. Existing domain modules consume these services through dependency injection. Spec Kit
directories remain in the Git repository for engineering traceability but Nest compiles only `src/`;
the production process serves only the explicit `public/` and upload roots.

## Phase 0 — Research Decisions

The decisions and rejected alternatives are recorded in [research.md](./research.md). The principal
choices are two PM2 cluster workers, MongoDB-backed coordination, explicit readiness with worker
self-drain/replacement, ownership-safe leases, bounded graceful reload, Nginx as the future TLS
gateway, Jenkins as a secret-free quality/deployment orchestrator and single-host shared disk for
increment 1.

## Phase 1 — Design and Contracts

- [data-model.md](./data-model.md) defines rate buckets, leases and non-persisted operational views.
- [contracts/health.openapi.yaml](./contracts/health.openapi.yaml) defines liveness/readiness while preserving `/health`.
- [contracts/distributed-behavior.md](./contracts/distributed-behavior.md) fixes quota, lease, error and correlation semantics.
- [quickstart.md](./quickstart.md) defines the validation sequence and expected evidence.

## Delivery Sequence

1. Introduce coordination schemas/services with atomic tests before replacing any limiter.
2. Add graceful lifecycle, continuous essential-readiness supervision and PM2 cluster configuration,
   initially fixed at two workers. A worker failing consecutive essential probes self-drains and exits;
   PM2 uses bounded restart delay and anti-flapping limits rather than routing to it indefinitely.
3. Validate the same-host Jenkins/Nginx prerequisites, install the root-owned deployment wrapper and
   activate the Nginx virtual host only after resolving the current cPanel/LiteSpeed port ownership.
4. Migrate authentication and upload limits, then Rudolf quotas, preserving current responses.
5. Replace Rudolf's local promise map with the distributed lease and concurrency tests.
6. Add safe request correlation and expose the runtime readiness snapshot through health contracts.
7. Harden deployment verification and automated rollback.
8. Run sovereignty regression, ten-reload, unit/e2e, cluster and defined pilot-load tests.
9. Verify `dist/` excludes Spec Kit/project documentation and update operational documentation.

## Complexity Tracking

No constitutional violation or unjustified infrastructure is introduced. Redis, object storage,
multi-host balancing, container orchestration and microservices are explicitly deferred.
