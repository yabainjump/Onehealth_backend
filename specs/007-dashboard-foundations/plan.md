# Implementation Plan: Dashboard Foundations

## Technical approach

1. Relocate the workspace documents into a tracked backend documentation directory and repair all
   paths/references.
2. Introduce a pure, validated Angular tile configuration and a Leaflet base-layer factory. Both
   dashboard map surfaces consume it; deployment writes the configuration from environment values.
3. Extract the scenario overlay into a standalone presentational component. Keep API calls and
   scenario state transitions in the dashboard page.
4. Store a dashboard OpenAPI contract in the backend, generate a deterministic Angular type file,
   and make the Hub API service alias its wire types from that artifact.
5. Add a signal-based i18n service, translation pipe and accessible language selector. Migrate the
   shared shell and scenario flow first; further pages can migrate incrementally.
6. Update architecture and operational documentation, then run lint, tests and production builds.

## Constitution Check

- **Security and sovereignty**: no trust-boundary or authorisation change. Configuration is
  validated and contains no credentials. Simulated data labelling remains explicit.
- **Backend architecture**: no new service, database or runtime dependency. The versioned contract
  documents existing REST boundaries.
- **Frontend architecture**: a large UI concern is extracted without moving business rules into a
  view component. Generated wire types are kept separate from view models.
- **Operations**: no new infrastructure is required. The tile provider is replaceable and can be
  disabled during an outage.
- **Testing**: pure configuration, i18n fallback/persistence and component events receive unit
  coverage; existing validation commands remain mandatory.
- **Simplicity**: no map proxy, translation platform, microfrontend or private package registry is
  introduced before a measured need.

## Contract strategy

The backend repository is the owner of `contracts/dashboard-api.openapi.yaml`. The dashboard keeps
only the generated TypeScript output plus generation metadata. During local cross-repository work,
the generator reads the sibling backend contract. In standalone CI, the same exact contract must be
checked out or downloaded as a versioned build input before running the drift check. Runtime builds
do not depend on network access.

## Map provider decision

OpenStreetMap data and the public `tile.openstreetmap.org` service are distinct concerns. The public
service has no SLA and can block heavy or policy-incompatible use. The implementation therefore
keeps a compliant best-effort demo default, removes it from page code, supports an operator-selected
HTTPS provider, preserves attribution and supports a provider-disabled degraded mode. A regional
self-hosted PMTiles/vector solution remains a later infrastructure decision.

## Rollback

- Restore the previous dashboard page template and stylesheet, then remove the extracted component.
- Point the map factory to disabled mode if the configured provider fails.
- Revert generated type aliases to the preceding artifact without changing backend runtime.
- French remains the fallback if a translation dictionary is incomplete.
