# 006 — Private attachments and certification evidence

## User value

Applicants can submit certification evidence without publishing it as a post.
Chat participants can attach files without letting another participant turn a known
attachment URL into a new, long-lived link in an unrelated conversation.

## Scope and acceptance

1. New certification uploads have their own private namespace. Only the applicant
   and global admins receive temporary read links through authorized API responses.
2. Submission accepts only evidence uploaded by that applicant. Other URLs and
   another user's upload are rejected, even if syntactically valid.
3. New chat messages accept only an attachment uploaded by the authenticated sender.
   A URL from another sender or a previously delivered message cannot be re-signed.
4. Existing public post media and already persisted chat messages continue to work.
5. Private media cannot be reached through `/api/media/*`, including derivatives.
6. Existing certification evidence in the public post namespace has an auditable,
   dry-run-first migration. Deployment must not remove or overwrite shared uploads.

## Exclusions

No changes to Hub sovereignty, chat end-to-end encryption, object storage, or
general deletion/retention policy. A recipient may save a file while a temporary
link is valid; no URL-based design can revoke a copy already downloaded.

## Failure cases

Invalid claim, other owner, or wrong namespace fails closed. A file removed after
upload may still yield a broken reference and a 404 on reading. Ambiguous legacy
references are not migrated automatically. Production migration requires a backup and explicit operator
action; public caches may still contain previously served copies.
