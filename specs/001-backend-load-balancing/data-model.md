# Data Model: Backend Load Balancing

The coordination records live in the primary application database. They contain no business payload
and expire automatically. Application logic always evaluates expiration explicitly because TTL
deletion is asynchronous.

## RateLimitBucket

Represents one security policy applied to one pseudonymized subject during one fixed window.

| Field | Type | Rules |
|---|---|---|
| `_id` | string | Deterministic HMAC of policy, subject and window; never raw input |
| `policy` | string | Allow-listed policy identifier such as `auth-login`, `upload` or `rudolf-short` |
| `subjectHash` | string | 64-character HMAC hex digest; no raw IP, e-mail or token |
| `windowStartedAt` | date | UTC fixed-window boundary |
| `resetAt` | date | Strictly after `windowStartedAt` |
| `count` | integer | Starts at 1; atomic increments; never negative |
| `limitSnapshot` | integer | Validated positive limit used for this window |
| `expiresAt` | date | Cleanup time after `resetAt`; TTL index with zero-second offset |
| `createdAt` | date | Automatic UTC timestamp |
| `updatedAt` | date | Automatic UTC timestamp |

### Indexes

- Unique `_id` is the concurrency boundary.
- TTL index on `expiresAt` with `expireAfterSeconds: 0` performs delayed cleanup.
- Optional diagnostic index on `{ policy: 1, expiresAt: 1 }` only if measurements justify it.

### Invariants

- Authorization is granted only when the atomic resulting `count` is less than or equal to the
  policy's `limitSnapshot`.
- A duplicate-key race during first insertion is retried once as an increment, never interpreted as
  an authorization.
- A policy configuration change applies to new windows; active windows retain their snapshot to
  avoid contradictory responses between workers.

### State transitions

```text
absent → active(count=1) → active(count+1) → blocked(count>limit) → expired
```

Physical deletion may occur after `expired`; any lookup treats the expired window as unusable.

## DistributedLease

Represents exclusive, temporary ownership of a Rudolf conversation operation.

| Field | Type | Rules |
|---|---|---|
| `_id` | string | Deterministic HMAC of lease namespace and resource identifier |
| `namespace` | string | Allow-listed value; initially `rudolf-conversation` |
| `resourceHash` | string | Pseudonymized stable resource key |
| `ownerToken` | string | Cryptographically random token generated per acquisition |
| `instanceId` | string | Bounded operational worker identifier, not authorization data |
| `acquiredAt` | date | UTC acquisition time |
| `expiresAt` | date | UTC hard expiry; evaluated in every acquire operation |
| `createdAt` | date | Automatic UTC timestamp |
| `updatedAt` | date | Automatic UTC timestamp |

### Indexes

- Unique `_id` permits one current record per protected resource.
- TTL index on `expiresAt` performs cleanup but does not control acquisition correctness.

### Invariants

- Acquisition may replace an existing record only when its `expiresAt` is not later than the current
  time.
- Successful release matches both `_id` and `ownerToken`.
- A caller never receives another owner's token.
- Lease duration is bounded and exceeds the configured provider timeout plus a drain margin.

### State transitions

```text
absent → acquired → released
             └────→ expired → reacquired by a new owner
```

## HealthSnapshot

Non-persisted public operational view calculated per request.

| Field | Type | Rules |
|---|---|---|
| `status` | enum | `ok`, `degraded` or `unavailable` |
| `kind` | enum | `live` or `ready` |
| `timestamp` | date-time | UTC response time |
| `version` | string | Bounded deployed revision/application version |
| `instanceId` | string | Bounded worker identifier |
| `checks` | map | Only coarse `up`/`down`; no URI or error internals |
| `degradedCapabilities` | string array | Optional capabilities unavailable without failing readiness |

Readiness is `unavailable` when either required database connection is not ready or the upload root
cannot be accessed according to the configured single-host media mode.

## RequestContext

Non-persisted request-scoped metadata.

| Field | Type | Rules |
|---|---|---|
| `requestId` | string | Valid incoming identifier or generated UUID; maximum 128 characters |
| `instanceId` | string | Worker identifier |
| `startedAt` | high-resolution time | Used only to compute duration |

The context may appear in response headers and structured logs. It never contains an authorization
header, JWT, request body, password, provider key or health-sensitive payload.

## DeploymentResult

Operational record written to deployment output rather than the application database.

| Field | Type | Rules |
|---|---|---|
| `candidateRevision` | string | Git revision attempted |
| `previousRevision` | string | Last running revision captured before update |
| `workerCount` | integer | Expected to equal configured count |
| `checks` | list | Build, readiness, public CORS, worker count and route smoke results |
| `decision` | enum | `promoted`, `rolled-back` or `rollback-failed` |
| `completedAt` | date-time | UTC |

Deployment output MUST redact environment values and MUST NOT print credentials.
