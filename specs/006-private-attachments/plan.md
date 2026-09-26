# Plan — 006

## Constitution Check (before design)

- I/VII: backend authenticates upload and validates provenance before accepting media.
- VII: HMAC claim uses the existing media secret with domain separation; never logs it.
- IX: cross-user, cross-room, legacy and legitimate paths receive automated tests.
- X: keep shared disk and modular monolith; no new infrastructure.
- Delivery: separate public posts from private evidence; migrate legacy explicitly.

## Design

`POST /api/upload/certification` writes to `/uploads/certification/` with the
same type/signature/size controls as post documents. A private static-media gate
requires a temporary HMAC URL for that namespace; `/api/media/*` rejects it.
Upload responses for private media carry a distinct HMAC upload claim bound to
path and authenticated uploader. The claim is submitted unchanged by existing
clients, validated at the write boundary, then removed before persistence.
Read signatures continue to be issued only from authorized chat/certification
responses. The claim is not included in those responses. A sender may explicitly
share their own upload in another room; a recipient cannot republish the URL as
their own. This owner boundary is the least disruptive contract compatible with
existing client upload/send sequence.

Certification requests store only canonical private URLs. Applicant and global
admin responses sign them; the ordinary public post flow is unchanged. Legacy
post-backed evidence is migrated by a dry-run-first operator script that copies
to the private namespace, updates references, and removes the public copy only
when no post still references it. Missing, external or shared references are
reported and left for manual review. No migration runs during deployment.

Failure modes: invalid claims fail 400/403; unavailable disk/DB retains existing
readiness behavior. Migration is idempotent and fails closed for confidentiality:
after the private hard link exists it can remove the public name before the database
update. If that update fails, the document is temporarily unavailable at its old URL
but remains on disk privately; rerunning repairs the reference without data loss.
No new secrets or indexes. Shared disk across both PM2 workers remains required.
Rollback: revert code; retain shared uploads. Migrated documents need a compatible
private-media reader, so do not roll back backend alone after applying migration.

## Constitution Check (after design)

The backend enforces owner and private namespace; no frontend guard is trusted.
The plan preserves public post previews, minimizes persisted claims and adds no
new distributed state. Existing evidence migration is opt-in, backed up, and
explicitly blocks automatic deletion of ambiguous sources. No exception needed.
