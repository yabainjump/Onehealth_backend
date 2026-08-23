# Contract: Distributed Runtime Behavior

## Request correlation

- Every HTTP response includes `X-Request-Id`.
- An incoming `X-Request-Id` is reused only when it is 8–128 characters and matches
  `^[A-Za-z0-9._:-]+$`; otherwise a UUID is generated.
- Logs include request ID and instance ID but exclude authorization headers and request bodies.

## Existing rate-limited endpoints

The existing endpoint paths and successful response bodies do not change.

| Policy | Subject | Window | Default limit |
|---|---|---:|---:|
| Authentication login | Pseudonymized client address | 15 minutes | 10 |
| Registration | Pseudonymized client address | 15 minutes | 5 |
| Google authentication | Pseudonymized client address | 15 minutes | 10 |
| Password reset request | Pseudonymized client address | 15 minutes | 5 |
| Password reset completion | Pseudonymized client address | 15 minutes | 10 |
| Upload | Pseudonymized client address | 15 minutes | 30 |
| Rudolf short quota | Pseudonymized user ID | 10 minutes | Configured, default 12 |
| Rudolf daily quota | Pseudonymized user ID | 24 hours | Configured, default 100 |

When blocked, the API returns HTTP `429`, `Retry-After`, and the existing safe error body. Rudolf
continues to expose `X-RateLimit-Limit` and `X-RateLimit-Remaining` for the short window.

If coordination storage cannot make a reliable decision, these security-sensitive actions return
HTTP `503` with a generic message and request ID. They MUST NOT silently fall back to per-process or
unlimited counters.

## Rudolf conversation exclusivity

- Sending, streaming or deleting against a conversation requires its lease.
- A second concurrent operation waits for at most a short bounded acquisition period.
- If still owned, it returns HTTP `409` with a stable `conversation_busy` application error and
  `Retry-After`.
- Provider timeout, client disconnect or worker shutdown releases the lease when possible.
- Lease expiry guarantees eventual recovery after an ungraceful worker loss.
- Release by a stale owner is a no-op and cannot remove the current owner's lease.

## Health and traffic

- Reverse proxies use `/api/health/ready`, not the compatibility `/api/health` route.
- HTTP `503` readiness responses are never cached.
- Liveness does not query external providers.
- Groq or SMTP failure appears as a degraded capability and does not produce readiness `503` while
  the essential databases and media path remain ready.

## Proxy and client address

- Production startup requires an explicit trusted proxy configuration.
- The application derives the security client address only through the trusted proxy chain.
- A direct untrusted `X-Forwarded-For` value cannot override the socket peer address.

## Compatibility

- JWTs remain valid across workers because all workers use the same validated signing configuration.
- Country authorization is evaluated on every worker and every protected request.
- `/api/health` remains available for existing deploy scripts.
- No sticky session is required because the current chat uses polling and no WebSocket state is part
  of this feature.
