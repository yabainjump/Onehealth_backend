<!--
Sync Impact Report
- Version change: 1.0.0 → 1.0.1
- Added principles:
  - I. Backend Authority and Least Privilege
  - II. Sovereignty Before Processing
  - III. Traceable One Health Data Lifecycle
  - IV. Human Authority Over Health Decisions
  - V. Rudolf Is Assistive Only
  - VI. Simulated Data Must Be Unambiguous
  - VII. Secure Contracts and Secret Hygiene
  - VIII. Auditable Sensitive Operations
  - IX. Tests Proportional to Risk
  - X. Modular Simplicity and Measured Scaling
- Added sections: Technical and Security Constraints; Delivery and Review Gates
- Removed sections: none (initial ratification)
- Amended constraints: Spec Kit is versioned but excluded from runtime artifacts and public roots
- Follow-up TODOs: none
-->
# OneHealth Backend Constitution

## Core Principles

### I. Backend Authority and Least Privilege
The NestJS backend MUST remain the authority for authentication, application roles, Hub roles,
country scope and workflow permissions. Frontend visibility MUST NOT be treated as authorization.
Every protected controller MUST use the narrowest applicable guard, and services or repositories
MUST receive an already established identity and scope. This prevents privilege escalation through
forged client parameters or modified interfaces.

### II. Sovereignty Before Processing
Hub data MUST be filtered server-side according to the authenticated user's authorized countries
before aggregation, export, report generation or AI context construction. A request MUST NOT widen
scope beyond the user's rights. Changes to sharing policies, retention or country access MUST have
explicit behavior for previously generated events, reports and exports. Sovereignty is a processing
boundary, not merely a display filter.

### III. Traceable One Health Data Lifecycle
Raw records, normalized observations, consolidated events, signals, verified alerts and reports
MUST remain distinct entities or explicitly distinct lifecycle states. Provenance MUST preserve the
source system, source record identifier, country, timestamps and transformation or rule version.
Correlation scores MUST be explainable and MUST NOT be presented as evidence of causality. Imports,
seeds and synchronizations MUST be idempotent or document a safe reconciliation mechanism.

### IV. Human Authority Over Health Decisions
An alert MUST NOT become verified and a report MUST NOT become official without an authorized human
decision. Assignment, justification and valid state transitions MUST be enforced by the backend and
recorded. Automated detection may create an observation, event, candidate signal or draft only. No
software component may silently bypass the verifier or publication workflow.

### V. Rudolf Is Assistive Only
Rudolf MUST operate only within One Health and only on server-built, minimized, authorized context.
It MUST NOT diagnose, verify alerts, mutate workflow state, publish reports or impersonate an
authority. Source text MUST be handled as untrusted data to resist prompt injection. Provider
timeouts, quotas and failure MUST degrade Rudolf alone rather than disable unrelated API modules.
Every AI output used operationally MUST remain a clearly identified draft requiring human review.

### VI. Simulated Data Must Be Unambiguous
Demo observations, connectors, scenarios, reports and AI context MUST carry a durable simulation
marker and MUST be identified as simulated in API contracts and consuming interfaces. Fallback demo
data MUST NOT conceal an API or data failure in institutional production. Seed operations MUST
require explicit authorization and confirmation and MUST be safe to repeat without duplication.

### VII. Secure Contracts and Secret Hygiene
Every external input MUST pass DTO validation with allow-listed properties, bounded lengths and
domain validation where applicable. Authentication credentials, tokens, database URIs, provider
keys and personal or health-sensitive values MUST NOT enter source control, specifications, logs or
error responses. CORS, media URLs, uploads and proxy trust MUST use explicit allow-lists. Public
responses MUST minimize personal information and never expose password or reset material.

### VIII. Auditable Sensitive Operations
Role changes, country-scope changes, sovereignty-policy changes, signal decisions, report status
changes, demo seeds and AI draft generation MUST create an audit record sufficient to identify the
actor, action, entity, country scope and time. Audit logs MUST avoid secrets and unnecessary personal
data. Concurrent sensitive actions MUST be atomic, idempotent or protected by an explicit conflict
strategy so that two workers cannot produce contradictory decisions.

### IX. Tests Proportional to Risk
Every behavior change MUST include verification proportional to its failure impact. Authorization,
sovereignty, lifecycle transitions, idempotency, concurrent decisions, validation and distributed
state require automated tests. A backend change is not complete until lint, build and relevant tests
pass. A deployment change additionally requires health checks, a failure-path test and a documented
rollback. Tests MUST prove server-side enforcement rather than only frontend behavior.

### X. Modular Simplicity and Measured Scaling
The system MUST remain a modular NestJS monolith while module boundaries are sufficient. New
infrastructure such as Redis, queues, object storage, replica sets or additional instances MUST
solve a measured reliability, consistency or capacity problem and include an ownership and failure
model. Microservices, Kafka, SQL/PostGIS migration and predictive automation MUST NOT be introduced
without evidence that the current architecture cannot meet an approved requirement.

## Technical and Security Constraints

- The supported backend baseline is NestJS, Node.js 20 or newer, MongoDB/Mongoose and REST APIs.
- Community and Hub domains MUST retain separate logical MongoDB databases and stable identifiers;
  cross-database writes MUST avoid assuming a distributed transaction.
- JWT-backed requests MAY be served by any application instance. Process-local memory MUST NOT be
  the source of truth for security limits, locks, sessions or workflow state in multi-instance mode.
- Media stored on local disk MAY be used only while all serving processes share that disk. A
  multi-host deployment MUST use shared or object storage before receiving uploads.
- Health reporting MUST distinguish process liveness from dependency readiness. Optional providers
  such as Groq or SMTP MUST have explicit degraded states rather than failing the entire API.
- Logs MUST be structured enough to correlate a request across modules and instances, while
  redacting authorization headers, credentials, prompt-sensitive data and personal information.
- `.specify/`, `.agents/skills/`, `specs/` and internal project documentation SHOULD be versioned
  with source code for traceability, but MUST NOT be copied into runtime artifacts, served from a
  public static root or required for application startup.
- Changes affecting country scope, data retention or infrastructure location MUST receive a
  sovereignty and data-residency review before institutional deployment.

## Delivery and Review Gates

1. A feature begins with an approved specification that defines user value, scope, exclusions and
   measurable acceptance scenarios without prescribing an unreviewed implementation.
2. The technical plan MUST identify data flow, authorization boundaries, failure modes, migrations,
   observability, performance impact and rollback before tasks are generated.
3. Tasks MUST be independently verifiable, name concrete files where possible and place security or
   contract prerequisites before dependent implementation work.
4. Implementation MUST preserve unrelated user changes and MUST NOT introduce undocumented secrets,
   production data or destructive deployment behavior.
5. Review MUST ask what can break, which edge cases remain, what is over-engineered and whether a
   backend rule has incorrectly been delegated to a frontend.
6. Release evidence MUST include lint, build, relevant automated tests, configuration validation,
   health verification and the rollback procedure. Institutional releases additionally require
   load and failure testing appropriate to the change.
7. Architecture and operational documentation MUST be updated in the same change whenever contracts,
   data models, infrastructure dependencies, permissions or deployment behavior change.

## Governance

This constitution is the highest project-level engineering policy for `onehealth_backend`. Feature
specifications, plans, tasks and reviews MUST demonstrate compliance. `AGENTS.md` may provide daily
working instructions but MUST NOT weaken these principles.

Amendments require a written rationale, an impact assessment for active specifications and explicit
approval by the project owner. A breaking removal or redefinition of a principle increments the
major version; a new principle or materially expanded obligation increments the minor version;
clarifications increment the patch version. The ratification date never changes, while the last
amended date changes with every approved amendment.

Every feature plan MUST contain a Constitution Check before implementation and repeat it after the
design is complete. Non-compliance MUST be resolved before implementation, or recorded as a bounded,
time-limited exception with owner, rationale and remediation date. No exception may authorize a
sovereignty breach, autonomous health decision, secret exposure or fabricated official data.

**Version**: 1.0.1 | **Ratified**: 2026-08-23 | **Last Amended**: 2026-08-23
