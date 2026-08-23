# Research: Backend Load Balancing

## Decision 1 — Begin with two PM2 cluster workers on one host

**Decision**: Run exactly two workers in cluster mode, with readiness signaling, progressive reload,
bounded startup and bounded shutdown.

**Rationale**: The current ecosystem file runs one forked process. Two workers improve CPU use and
allow one worker to remain available during reload without changing the external proxy. A fixed count
avoids exhausting unknown host memory; scaling higher requires measurements.

**Alternatives considered**:

- `instances: max`: rejected until CPU, memory and MongoDB pool capacity are measured.
- Two separate servers immediately: rejected because shared media and coordination are not ready and
  host-level availability has not yet been funded.
- Keep one fork: rejected because it cannot provide worker-level continuity or progressive reload.

**Reference**: [PM2 load balancing](https://pm2.io/docs/runtime/guide/load-balancing/) and
[graceful reload](https://pm2.keymetrics.io/docs/usage/signals-clean-restart/).

## Decision 2 — Reuse MongoDB for shared coordination in increment 1

**Decision**: Store small expiring quota buckets and leases in the primary application database
through one coordination module.

**Rationale**: MongoDB is already an essential dependency, so no new paid service or failure domain is
introduced. Single-document conditional updates are atomic and suitable for bounded counters and
ownership records. If MongoDB is unavailable, the core API is not ready anyway.

**Alternatives considered**:

- Redis now: technically strong but adds provisioning, authentication, monitoring, backup policy and
  another production dependency before measured need.
- Process-local maps: rejected because limits and locks differ between workers and reset on restart.
- Sticky routing: rejected because it is not a security boundary and fails during worker replacement.

**Reference**: [MongoDB single-document atomicity](https://www.mongodb.com/docs/manual/core/write-operations-atomicity/).

## Decision 3 — Treat TTL indexes as cleanup, never as lock correctness

**Decision**: Every quota or lease query checks `expiresAt` explicitly. TTL indexes remove obsolete
documents later but are not trusted to delete them at the expiration instant.

**Rationale**: MongoDB TTL removal is asynchronous and expired documents can remain temporarily.
Correctness must therefore come from conditional acquisition/update filters.

**Alternatives considered**:

- Rely on physical deletion before reacquisition: rejected because TTL deletion is delayed.
- Periodic application cleanup job: rejected as duplicate scheduled work across workers.

**Reference**: [MongoDB TTL index behavior](https://www.mongodb.com/docs/current/core/index-ttl/).

## Decision 4 — Pseudonymize rate-limit subjects

**Decision**: Derive stable subject keys using HMAC-SHA-256 and an environment-only key. Never persist
raw IP addresses, access tokens, e-mail addresses or request bodies in coordination records.

**Rationale**: Limiters need equality, not the original identity. HMAC prevents straightforward
recovery of low-entropy values such as IP addresses while keeping keys stable across workers.

**Alternatives considered**:

- Raw IP/user ID: rejected as unnecessary personal data retention.
- Unsalted hash: rejected because known IP ranges are cheaply enumerable.
- Random per-worker salt: rejected because workers would derive different keys.

## Decision 5 — Use fixed windows with atomic conditional increments

**Decision**: Preserve the existing visible limits as fixed windows. Use a unique policy/subject/window
key and an atomic increment that returns the resulting count and reset time. Retry one duplicate-key
race during first creation.

**Rationale**: This preserves current product semantics, is easy to test and bounds storage. A more
complex sliding window is not justified for current traffic.

**Alternatives considered**:

- Sliding window or token bucket: deferred until fairness or burst measurements require it.
- Read then write: rejected because concurrent workers can both authorize the same final attempt.

## Decision 6 — Use ownership-safe expiring leases for Rudolf

**Decision**: Acquire one lease per user/conversation with a random owner token, an expiration longer
than the bounded provider timeout and conditional release by both resource key and owner token. A
second request waits briefly, then receives a conflict if the lease remains held.

**Rationale**: It prevents concurrent history updates and duplicate provider cost. Expiration recovers
from a killed worker; owner-checked release prevents an old worker deleting a replacement lease.

**Alternatives considered**:

- Keep the local promise queue: rejected because it coordinates one process only.
- Long unbounded queue: rejected because clients can disconnect while still consuming capacity.
- Database transaction around the provider call: rejected because no transaction should remain open
  during a long external request.

## Decision 7 — Separate liveness, readiness and degraded optional services

**Decision**: Preserve `/api/health`, add `/api/health/live` and `/api/health/ready`. Readiness checks
both MongoDB connections and upload-directory accessibility. Groq and SMTP appear only as degraded
optional capabilities.

**Rationale**: A running process must not receive traffic before essential data dependencies are
usable. Conversely, an optional provider outage must not disable authentication or data access.

**Alternatives considered**:

- One always-OK health route: rejected because it sends traffic to unusable workers.
- Make Groq mandatory for readiness: rejected because Rudolf is isolated and assistive.

## Decision 8 — Add graceful lifecycle and explicit ready signaling

**Decision**: Enable NestJS shutdown hooks, stop accepting new work on shutdown, let active requests
finish within a configured bound, close resources, and notify PM2 only after the HTTP listener and
essential dependencies are ready.

**Rationale**: Progressive reload only avoids downtime if old workers drain and new workers are not
promoted prematurely.

**Alternatives considered**:

- Immediate restart: rejected because in-flight uploads and AI requests are terminated abruptly.
- Unlimited drain: rejected because a stuck request can block deployment forever.

### Runtime loss of readiness

PM2 cluster workers share one listening port, so an external probe cannot select an individual worker
by port. Each worker therefore runs bounded essential-dependency probes. After the configured number
of consecutive failures, it marks itself draining, refuses new non-health work with HTTP 503, allows
in-flight work to finish within the shutdown bound, then exits for PM2 replacement. Startup requires
successful essential probes before `ready` signaling. PM2 restart delay, minimum uptime and restart
limits prevent a shared dependency outage from causing an uncontrolled restart storm.

**Reference**: [NestJS lifecycle events](https://docs.nestjs.com/fundamentals/lifecycle-events).

## Decision 9 — Keep local media only for the single-host increment

**Decision**: All workers use the same absolute `UPLOADS_DIR`; readiness verifies it exists and is
writable. Configuration and documentation explicitly prohibit multi-host upload traffic until a
shared or object-storage driver exists.

**Rationale**: Processes on the current host share the disk, so moving media now adds cost without
benefit. The constraint prevents falsely claiming host-level high availability.

**Alternatives considered**:

- Object storage immediately: deferred pending provider, residency and cost decisions.
- Replicate files between hosts: rejected as conflict-prone and operationally fragile.

## Decision 10 — Correlate requests without logging sensitive input

**Decision**: Accept a strictly validated incoming request identifier or generate a UUID, return it as
`X-Request-Id`, and include it with instance ID, route template, status and duration in structured
logs. Do not log bodies or authorization headers.

**Rationale**: Multi-worker diagnosis needs a stable trace while the constitution requires data
minimization.

## Decision 11 — Bound database connection pools per worker

**Decision**: Add validated pool-size configuration for each connection and calculate total possible
connections as workers × logical connections × pool size before deployment.

**Rationale**: Each worker creates both primary and Hub pools. Blindly multiplying workers can exhaust
the database connection allowance.

## Decision 12 — Roll back in place for the first increment

**Decision**: Capture the previously running Git revision before deployment. If build, readiness,
worker-count or public checks fail after reload, rebuild and reload the previous revision, then report
the failed candidate and rollback result.

**Rationale**: This fits the current single checkout and can meet the 15-minute exercise target
without introducing release directories. Atomic releases remain a future hardening option.

**Alternatives considered**:

- No automated rollback: rejected because a progressive reload can still promote defective workers.
- Container blue/green platform: deferred as disproportionate to the current host.

## Decision 13 — Version Spec Kit but exclude it from the runtime artifact

**Decision**: Commit `.specify/`, `.agents/skills/` and `specs/` to GitHub. Keep local pointers and
local extension configuration ignored. Nest builds only `src/` into `dist/`; production static roots
remain explicitly limited to `public/` and `UPLOADS_DIR`. Release validation fails if engineering
documents appear under `dist/` or become reachable by HTTP.

**Rationale**: Specifications must evolve with the code for review and traceability, but agent
instructions and design documents are neither runtime dependencies nor public application content.

**Alternatives considered**:

- Ignore all Spec Kit content: rejected because GitHub reviews would lose product and architecture decisions.
- Serve specifications from the backend: rejected because it exposes internal engineering context without user value.
