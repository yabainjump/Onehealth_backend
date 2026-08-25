# Contract: Private Media Access

Behavioural contract for addresses under `/uploads/`. No new endpoint is introduced; the change is
the access condition attached to one prefix and the shape of the addresses the API returns.

## Address shape

| Media | Address returned by the API |
|---|---|
| Public (`/uploads/profile/`, `/uploads/post/`) | Unchanged |
| Private (`/uploads/message/`) | Same address with `exp` and `sig` appended |

Clients MUST treat the address as opaque and render it unchanged. They MUST NOT rebuild it from a
path, strip its parameters, or cache it beyond the conversation view that produced it.

## Issuing points

| Operation | Effect |
|---|---|
| `GET /api/chat/rooms/:roomId/messages` | Every private attachment address in the response is signed |
| `POST /api/chat/rooms/:roomId/messages` | The echoed message carries signed addresses |
| `POST /api/upload/message` | The returned address is signed, so the sender sees the attachment before the conversation reloads |

Membership is verified before any of these responses is produced, so an authorisation only ever
reaches a caller already entitled to the content.

## Verification

| Condition | Response |
|---|---|
| Valid, unexpired authorisation matching the requested path | `200` with the file and `Cache-Control: private, no-store, max-age=0` |
| Missing, malformed, expired, replayed on another path, or expiry altered | `403` with `Cache-Control: no-store` |
| Public prefix | `200`, no authorisation required |
| Path with invalid percent encoding | `400` with `Cache-Control: no-store` |

The `403` body carries a generic message and MUST NOT confirm whether the file exists.
The static 30-day immutable cache remains limited to public uploads; it MUST NOT override the
private response header.

## Derived representations

`GET /api/media/thumb`, `/api/media/poster` and `/api/media/social` read from disk directly and
therefore bypass the barrier by construction. They MUST refuse a private path with `400`, otherwise a
resized copy of protected content would remain publicly readable.

## Compatibility

- Addresses issued before this contract carry no authorisation and receive `403` until the client
  reloads the conversation. This is expected and self-healing.
- Signing an already-signed address MUST replace the previous authorisation rather than append a
  second one, because clients return the address they received and it is persisted as-is. Duplicate
  parameters would otherwise be exposed as arrays by the HTTP layer and rejected.
- An authorisation issued by one worker MUST verify on any other worker (feature 001, FR-009).

## Non-goals

- The authorisation is not an identity and grants nothing beyond reading one file until its expiry.
- It does not replace membership verification, which remains the sole authority for who may obtain an
  authorisation in the first place.
