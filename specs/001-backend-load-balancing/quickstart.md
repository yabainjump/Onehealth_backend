# Quickstart Validation: Backend Load Balancing

This guide is executable after the feature tasks are implemented. It validates the single-host,
two-worker increment; it does not claim host-level high availability.

## 1. Prerequisites

- Node.js 20.20.x and the project PM2 binary.
- Dedicated non-production primary and Hub databases.
- A writable absolute upload directory containing only test media.
- A test `.env` based on `.env.example`; never paste secrets into commands or this document.
- Two CPU cores and enough measured memory for two bounded workers.

Configure at minimum the future variables documented by the implementation:

```text
WEB_CONCURRENCY=2
RATE_LIMIT_KEY_SECRET=<secret distinct from public identifiers>
MONGODB_MAX_POOL_SIZE=<bounded value justified by connection allowance>
HUB_MONGODB_MAX_POOL_SIZE=<bounded value justified by connection allowance>
TRUSTED_PROXY_HOPS=<validated topology value>
```

## 2. Static verification

```powershell
npm ci
npm run lint
npm run build
npm test -- --runInBand
npm run test:e2e
```

Expected: all commands succeed and no environment value appears in output.

## 3. Start two workers

```powershell
pm2 startOrReload ecosystem.config.cjs --update-env
pm2 status onehealth-backend
```

Expected: exactly two online cluster workers for `onehealth-backend`.

Call liveness repeatedly:

```powershell
1..20 | ForEach-Object {
  Invoke-RestMethod http://127.0.0.1:3000/api/health/live
}
```

Expected: responses contain two instance identifiers over the sample and no sensitive value.

## 4. Readiness behavior

```powershell
Invoke-WebRequest http://127.0.0.1:3000/api/health/ready
```

Expected while healthy: HTTP 200 with both databases and media storage `up`.

Using disposable test dependencies only, make one essential database unreachable and repeat the
probe. Expected: HTTP 503. Restore it and verify readiness returns 200 before continuing. Disabling
the AI provider alone must return 200 with `rudolf` listed as degraded.

## 5. Shared quota verification

Run the cluster verification script against the test API:

```powershell
npx ts-node scripts/verify-cluster.ts --base-url http://127.0.0.1:3000/api
```

Expected:

- attempts are observed across both worker identifiers;
- the first configured number of test attempts receives normal endpoint processing;
- every subsequent attempt in the same window receives HTTP 429;
- the total allowance is not multiplied by two;
- every response contains a valid `X-Request-Id`.

The script MUST use a dedicated test identity and MUST refuse production URLs unless an explicit,
documented confirmation is supplied.

## 6. Rudolf lease verification

With a dedicated test account and conversation, send two requests concurrently. Supply credentials
through an environment variable rather than command history.

Expected: one request owns the generation; the other waits briefly then completes later or returns
the documented HTTP 409. The conversation contains no duplicate exchange. Kill the owning worker in
a second exercise and verify a new operation succeeds after the bounded lease expiry.

The automated non-destructive portion (two-worker discovery, common media reads and concurrent
Rudolf history validation) is available through `npm run verify:cluster-media-rudolf`. It requires
`CLUSTER_TEST_CONFIRM=RUN_CLUSTER_MEDIA_RUDOLF_TEST`, `API_URL`, `ADMIN_EMAIL`,
`OHN_ADMIN_PASSWORD` and the same absolute `UPLOADS_DIR` used by PM2.

## 7. Media cross-worker verification

Upload one profile image and one message attachment with the test account, then request each resource
repeatedly while observing both workers.

Expected: every permitted read returns the same media regardless of worker. Restart one worker and
repeat. The readiness probe must become unavailable if the shared upload path loses required access.

## 8. Worker failure and progressive reload

Maintain ordinary GET traffic, stop one worker, wait for replacement, then run:

```powershell
pm2 reload ecosystem.config.cjs --only onehealth-backend --update-env
```

Expected:

- at least one ready worker remains during reload;
- new traffic recovers from worker loss within 10 seconds;
- at least 99.9% of ordinary requests in the exercise succeed;
- no confirmed write is duplicated.

Repeat the progressive reload ten consecutive times. Record total ordinary requests, failed
requests, p95 latency and confirmed-write identifiers. The aggregate success rate must be at least
99.9%, worker removal must complete in under 10 seconds and infrastructure-triggered replay must be zero.

## 9. Pilot performance profile

Run the dependency-free Node verifier for 10 minutes with 20 concurrent clients against a disposable
environment. Use a documented mix of 70% authorized reads and 30% ordinary authorized writes;
exclude upload, Rudolf generation and bulk export.

```powershell
npx ts-node scripts/verify-pilot-load.ts --base-url http://127.0.0.1:3000/api --duration-seconds 600 --concurrency 20
```

Expected: at least 95% of responses complete in under two seconds, no authorization/scope regression
occurs and no confirmed write identifier is duplicated.

## 10. Deployment rollback exercise

Deploy a deliberately failing readiness configuration only in the disposable environment. The deploy
script must reject the candidate, restore the captured previous revision, rebuild, reload and pass
the public readiness/CORS checks within 15 minutes.

Record candidate revision, previous revision, check results, promotion/rollback decision and duration.
The record must contain no `.env` values.

Using one generated `X-Request-Id` from a deliberate test error, time the lookup in sanitized logs.
Expected: the related events are found in under five minutes and contain no token, key or password.

## 11. Spec Kit release boundary

After `npm run build`, verify that `dist/` contains no `.specify`, `.agents`, `specs` or
`project-docs` directory. Verify that representative guessed HTTP paths for these directories return
404. The Git repository must still contain the files for engineering review.

## 12. Sovereignty regression

Exercise every Hub role with allowed and forbidden country scopes while requests alternate between
both workers. Expected: all existing allow/deny decisions remain unchanged and server-side scope is
recomputed on each protected request.

## 13. Multi-host gate

Do not add a second physical host while `UPLOADS_DIR` remains local or while coordination depends on a
non-redundant data service. A future specification must select shared/object media storage, database
high availability, load-balancer health policy and approved data residency first.
