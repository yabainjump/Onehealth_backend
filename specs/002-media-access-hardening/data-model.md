# Data Model: Media Access and Session Hardening

This feature adds one persisted field, one quota policy value and one transient authorisation
structure that is never stored. No collection is created.

## MediaAccessAuthorization *(transient — never persisted)*

Carried in the query string of a private media address. It exists only between issuance and
verification and is recomputed rather than looked up.

| Field | Type | Rules |
|---|---|---|
| `exp` | integer | Expiry as epoch milliseconds; strictly greater than the verification instant |
| `sig` | string | 64-character lowercase hexadecimal HMAC-SHA256 digest |

### Signed material

The digest covers `"<lowercased path>|<exp>"`. Binding the path prevents transposing a legitimate
authorisation to another file; binding the expiry prevents extending it after issuance.

### Invariants

- The authorisation identifies no user and carries no personal data, so it may appear in access logs.
- Issuing twice for the same address MUST NOT accumulate parameters: any previous `exp`/`sig` pair is
  removed before a new one is appended, because clients return the address they received and it is
  stored as-is.
- Query parameters unrelated to the authorisation are preserved.
- Verification is constant-time over the digest.
- The secret is identical on every worker, so an authorisation issued by one instance verifies on
  another (feature 001, FR-009).

### Protected prefixes

| Prefix | Access |
|---|---|
| `/uploads/message/` | Authorisation required |
| `/uploads/profile/` | Public — social preview robots and avatars |
| `/uploads/post/` | Public — social previews and external document viewers |

Prefix comparison is case-insensitive and applied to the decoded path, so a case or separator variant
cannot bypass it.

## User *(existing collection — one added field)*

| Field | Type | Rules |
|---|---|---|
| `passwordChangedAt` | date or null | Null by default; set to the reset instant; readable by default because the session guard needs it on every protected request |

### Invariants

- A session whose issue date precedes `passwordChangedAt` MUST be refused.
- A session without an issue date MUST be refused when `passwordChangedAt` is set.
- A one-second tolerance absorbs the second boundary between issuing and comparison.
- Existing accounts keep `null` and are unaffected until their next reset, so deployment invalidates
  no session on its own.

## RateLimitBucket *(existing collection — one added policy value)*

The structure defined by feature 001 is unchanged. One value joins the allow-listed `policy` field.

| Policy | Subject | Window | Ceiling |
|---|---|---|---|
| `auth-login-account` | Normalised e-mail of the targeted account, pseudonymised by the existing HMAC service | 15 minutes | 20 failures |

### Invariants

- Only failed authentications consume the bucket. A correct password neither consumes it nor is
  refused by it, so no third party can lock a legitimate account.
- The subject is the targeted account, not the client address, which is what makes the control
  effective against a request flow distributed over many addresses.
- The raw e-mail reaches the pseudonymisation service only and is never written to the document.

## Configuration *(no required variable added)*

| Variable | Type | Default | Purpose |
|---|---|---|---|
| `MEDIA_URL_SECRET` | string, minimum 32 characters | Derived | Signing secret. Absent, it is derived from `JWT_SECRET` by domain separation, so no deployment change is required |
| `MEDIA_URL_TTL_MS` | integer, 60 000 to 2 592 000 000 | 604 800 000 | Lifetime of an access authorisation |

Rotating `JWT_SECRET` invalidates media authorisations as well while `MEDIA_URL_SECRET` is unset.
Setting a dedicated secret decouples the two rotations.
