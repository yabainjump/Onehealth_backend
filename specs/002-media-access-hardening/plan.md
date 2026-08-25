# Implementation Plan: Media Access and Session Hardening

**Branch**: `002-media-access-hardening` | **Date**: 2026-08-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/002-media-access-hardening/spec.md`

## Summary

Close four confidentiality and session gaps found by the 23–24 August 2026 security audit. Private
conversation attachments move from unauthenticated static serving to time-limited signed access,
issued server-side inside the existing chat response presenter so no client change is required. A
password reset now invalidates sessions issued before it. Failed logins are counted per targeted
account on the shared coordination store, counting failures only so that no third party can lock a
legitimate user out. User-supplied media URLs move to an explicit host allow-list, which the
constitution already required and the implementation did not honour. No new runtime dependency, no
new required environment variable and no client-side change are introduced.

## Technical Context

**Language/Version**: TypeScript 5.9, Node.js 20.20.x

**Primary Dependencies**: NestJS 11, Mongoose 9, Passport JWT, Node.js `crypto` (HMAC-SHA256); no new Node.js runtime dependency

**Storage**: Existing primary MongoDB connection for the shared quota store and the user account record; existing shared local upload directory

**Testing**: Jest 30 unit tests, Nest testing utilities, existing e2e suite, plus dependency-free Node 20 harnesses replaying the Express static barrier and the route-matching behaviour

**Target Platform**: Same single Linux host and two-worker PM2 cluster defined by feature 001

**Project Type**: Modular REST web service shared by the community application and CEEAC Dashboard

**Performance Goals**: No measurable added latency on cache-hit media reads; one HMAC computation per private attachment URL returned; no additional database round-trip on the media read path

**Constraints**: Preserve current REST contracts as seen by clients; no new required environment variable; the signing secret must be identical across workers; public media must keep working for social preview robots and external document viewers

**Scale/Scope**: One new provider module, one new account field, one new quota policy, four touched request paths

## Constitution Check

*GATE: Passed before design and re-checked after implementation. Constitution v1.0.1.*

| Constitutional gate | Design evidence | Result |
|---|---|---|
| I. Backend authority and least privilege | Attachment access is decided by the server; the client only renders the address it receives and can neither forge nor widen it | PASS |
| II. Sovereignty before processing | No country scope, Hub filter or sharing policy is read or modified | PASS |
| III. Traceable data lifecycle | No raw record, observation, event, signal, alert or report entity is touched | PASS |
| IV. Human health authority | No alert or report transition is affected | PASS |
| V. Rudolf assistive only | Rudolf context construction and quotas are unchanged | PASS |
| VI. Simulated data clarity | Seed, demo scenario and fallback behaviour are unchanged | PASS |
| VII. Secure contracts and secret hygiene | Media URLs gain the explicit allow-list this principle already required; the signing secret is environment-only and never logged; pagination bounds are completed | PASS — closes a pre-existing violation |
| VIII. Auditable sensitive operations | No operation in the audited set changes; the access authorisation carries no identity and therefore adds no personal data to logs | PASS |
| IX. Tests proportional to risk | Authorization, validation, idempotency and cross-instance behaviour each carry automated tests; lint, build and the full suite pass | PASS |
| X. Measured modular simplicity | Reuses the existing MongoDB coordination store and Node.js `crypto`; no queue, cache or object storage is introduced | PASS |

### Constitutional exception — bounded and time-limited

One control does not satisfy a technical constraint and is recorded here rather than concealed, as
the governance clause permits.

> Constraint: *"Process-local memory MUST NOT be the source of truth for security limits, locks,
> sessions or workflow state in multi-instance mode."*

- **Exception**: the on-the-fly media generation ceiling in `src/media/media.service.ts` counts
  concurrent generations in process memory. With `WEB_CONCURRENCY=2` the effective cluster ceiling is
  therefore `4 × 2 = 8`, and neither worker observes the other.
- **Rationale**: the counter guards one process's event loop against unauthenticated CPU saturation.
  It grants no entitlement to any subject, so it is a local resource guard of the same nature as the
  PM2 memory ceiling rather than a quota. Making it cluster-wide would add a MongoDB round-trip to
  every image request, degrading SC-010 of feature 001 for no confidentiality gain.
- **Bounded**: the ceiling is documented as *per instance*; operators must read it as
  `4 × WEB_CONCURRENCY`. It protects availability only and can never authorise access.
- **Owner**: project owner (`onehealth_backend`).
- **Remediation date**: to be re-examined when feature 001 opens multi-host deployment (FR-017),
  because a shared media path will require the ceiling to be reconsidered as a whole anyway.

No other exception exists. No exception authorises a sovereignty breach, an autonomous health
decision, a secret exposure or fabricated official data.

## Écarts de gouvernance

This feature was implemented before it was specified, which the delivery gates do not allow. The
deviation is recorded for traceability:

| Gate | Expected | What happened |
|---|---|---|
| 1. Approved specification first | Spec precedes implementation | Implementation preceded the spec; this document set is retroactive |
| 2. Plan with Constitution Check before tasks | Check precedes implementation | Check performed after implementation; it surfaced the exception above |
| 3. Independently verifiable tasks | Tasks precede implementation | `tasks.md` reconstructs the work already performed and marks it complete |
| 7. Documentation updated in the same change | Architecture and operational docs updated | Only `.env.example` was updated; `project-docs/ARCHITECTURE.md` and `ARCHITECTURE-ESSENTIALS.md` were updated by tasks T030 and T031 |

Root cause: the work started from `AGENTS.md`, which points to `project-docs/` only, without first
reading `.specify/memory/constitution.md`. The constitution states that `AGENTS.md` "may provide
daily working instructions but MUST NOT weaken these principles"; the entry point was therefore
insufficient. Corrective action is task T032: both entry points now name the constitution as the highest authority.

## Data Flow and Authorization Boundaries

1. **Issuing** — a member requests a conversation. `ChatService` already verifies membership before
   returning any message. The presenter signs each private attachment address on the way out, so an
   authorisation exists only inside a response that a member was already entitled to receive.
2. **Presenting** — the client renders the address unchanged. Because the address travels inside the
   authorised response, no client change is needed and no separate authorisation endpoint is exposed.
3. **Verifying** — a middleware placed *before* the static file handler recomputes the signature over
   the requested path and its expiry. The static handler performs no authorisation of its own, so the
   barrier must remain ahead of it. A successful private response is explicitly non-cacheable, while
   public upload prefixes retain their long static cache.
4. **Derived paths** — the image transformation service refuses private paths outright, since it
   reads from disk directly and would otherwise return a readable copy of protected content.

The authorisation carries the path and expiry only. It identifies no user, so it cannot be replayed
as an identity, and it appears in no audit or log record as personal data.

## Failure Modes

| Failure | Behaviour | Rationale |
|---|---|---|
| Signature absent, malformed, expired, replayed on another file, or expiry extended | HTTP 403 with `Cache-Control: no-store` | An error must never be cached by a proxy, and the four cases are indistinguishable to the caller |
| Percent-encoded path cannot be decoded | HTTP 400 with `Cache-Control: no-store` | Malformed input is controlled instead of becoming an unhandled middleware error |
| Shared quota store unavailable during a failed login | The upstream middleware already fails closed with HTTP 503 before reaching the service; the per-account counter therefore logs and lets the ordinary 401 stand rather than adding a second degraded mode | Feature 001 FR-006 requires one explicit policy per sensitivity level, not two competing ones |
| Session token without an issue date, on an account with a recorded password change | Rejected | The token cannot be situated relative to the change, so it cannot be proven to postdate it |
| Media generation ceiling reached | HTTP 503; clients already fall back to the original media | Degrades one image rather than the request |
| A legitimate host is missing from the media allow-list | Profile update rejected with HTTP 400 | Fail-closed; the operational note below covers detection |

## Migration and Rollback

- **Schema**: `passwordChangedAt` defaults to null. Existing accounts are unaffected until their next
  password reset, so no data migration is required and no session is invalidated by deployment alone.
- **In-flight clients**: addresses obtained before deployment carry no signature and return 403 until
  the conversation is reloaded. This is expected and self-healing.
- **Rollback**: reverting the code restores public static serving. Signed addresses remain valid URLs
  with extra ignored query parameters, so no stored data becomes unusable in either direction.

Session validation and presence update use one conditional MongoDB operation. A banned account, a
missing issue date after password reset, or a session predating the reset cannot satisfy the update
filter and therefore cannot be marked online, including during a concurrent account change.

## Observability

No new log is introduced. The barrier's rejections are ordinary HTTP 403 responses already visible in
access logs and correlated by the request identifier from feature 001. The signature contains no
personal data, so access logs do not gain any new sensitive field.

## Project Structure

### Documentation (this feature)

```text
specs/002-media-access-hardening/
├── spec.md
├── plan.md
├── data-model.md
├── tasks.md
├── contracts/
│   └── media-access.md
├── checklists/
│   └── requirements.md
└── validation/
    ├── us1-private-media.md
    ├── us2-session-revocation.md
    ├── us3-credential-stuffing.md
    └── us4-remote-media.md
```

### Source (repository root `onehealth_backend/`)

```text
src/
├── media-access/                     # new provider module (global)
│   ├── media-access.module.ts
│   ├── media-signature.service.ts
│   └── media-signature.service.spec.ts
├── main.ts                           # barrier registered before static assets
├── media-access/private-media-access.middleware.ts # decoding, signature and private cache policy
├── chat/chat.service.ts              # signs attachments in the response presenter
├── upload/upload.service.ts          # signs the address returned after upload
├── media/media.service.ts            # refuses private paths; generation ceiling
├── auth/strategies/jwt.strategy.ts   # rejects sessions predating a password change
├── auth/auth.service.ts              # counts failed logins per account
├── users/schemas/user.schema.ts      # passwordChangedAt
├── users/users.service.ts            # records the change on reset
├── common/validation/                # media host allow-list
└── config/                           # optional secret and lifetime settings
```

## Complexity Tracking

No constitutional principle required a justified complexity increase. The single deviation is the
bounded exception recorded above, which reduces rather than adds infrastructure.
