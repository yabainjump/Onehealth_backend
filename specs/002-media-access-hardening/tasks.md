# Tasks: Media Access and Session Hardening

**Input**: Design documents from `specs/002-media-access-hardening/`

**Prerequisites**: `plan.md`, `spec.md`, `data-model.md`, `contracts/`

**Tests**: Required for authorization, validation, idempotency and cross-instance behaviour because
the project constitution classifies these as high risk.

**Organization**: Tasks are grouped by user story so that each increment remains independently
testable. All commands run from the `onehealth_backend` repository root.

> **Retroactive reconstruction**: tasks T001–T029 were executed before this document existed, in
> response to a security audit. They are recorded here with their real target paths so that the work
> remains verifiable. Phase 8 (T030–T032) was executed afterwards to satisfy the delivery gates that
> the retroactive route had left open.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it changes different files and has no unfinished dependency.
- **[Story]**: Maps the task to a user story in `spec.md`.
- Every task includes its concrete target path.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Introduce the signing capability and its configuration without changing runtime behaviour.

- [X] T001 Declare the optional signing secret and authorisation lifetime in `src/config/app-config.module.ts`
- [X] T002 [P] Expose the authorisation lifetime through `src/config/configuration.ts`
- [X] T003 [P] Document `MEDIA_URL_SECRET` and `MEDIA_URL_TTL_MS` as optional, with the rotation consequence, in `.env.example`
- [X] T004 Create the global provider module in `src/media-access/media-access.module.ts`
- [X] T005 Register the module ahead of the runtime modules in `src/app.module.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Implement the authorisation primitive every US1 task depends on.

**CRITICAL**: No US1 implementation begins until this phase passes its tests.

- [X] T006 Implement path-bound, expiry-bound signing and constant-time verification in `src/media-access/media-signature.service.ts`
- [X] T007 Declare the protected prefix set and case-insensitive prefix matching in `src/media-access/media-signature.service.ts`
- [X] T008 Derive the secret from `JWT_SECRET` by domain separation when no dedicated secret is configured, in `src/media-access/media-signature.service.ts`
- [X] T009 Make issuance idempotent by removing any previous authorisation before appending a new one, in `src/media-access/media-signature.service.ts`
- [X] T010 [P] Add tests for scope, replay on another file, expiry extension, expiry, foreign secret and idempotency in `src/media-access/media-signature.service.spec.ts`

---

## Phase 3: User Story 1 — Confidentialité des pièces jointes privées (P1)

**Goal**: A private attachment is unreadable without a valid authorisation, while a member's normal
reading is unchanged.

**Independent Test**: Request an attachment address without authorisation, then read the same
conversation as a member.

- [X] T011 [US1] Register the verification barrier **before** `useStaticAssets` in `src/main.ts`
- [X] T012 [US1] Sign private attachment addresses in the message presenter in `src/chat/chat.service.ts`
- [X] T013 [US1] Sign the address returned after upload so the sender sees the attachment immediately, in `src/upload/upload.service.ts`
- [X] T014 [US1] Refuse private paths in the image transformation service in `src/media/media.service.ts`
- [X] T015 [P] [US1] Add path containment and private-path refusal tests in `src/media/media.service.spec.ts`
- [X] T016 [US1] Replay the barrier against the real signing service with a dependency-free Node harness (absent, forged, replayed, expired, valid, case variant, public prefixes)

**Checkpoint**: US1 is independently verifiable.

---

## Phase 4: User Story 2 — Reprise de contrôle d'un compte compromis (P1)

**Goal**: A password reset ends sessions issued before it.

**Independent Test**: Open a session, reset the password, reuse the session, then sign in again.

- [X] T017 [US2] Add `passwordChangedAt` to `src/users/schemas/user.schema.ts`
- [X] T018 [US2] Record the change instant during reset in `src/users/users.service.ts`
- [X] T019 [US2] Declare the token issue date in `src/auth/interfaces/jwt-payload.interface.ts`
- [X] T020 [US2] Refuse sessions predating the change, including tokens without an issue date, in `src/auth/strategies/jwt.strategy.ts`
- [X] T021 [P] [US2] Add acceptance, refusal, missing-issue-date, banned and unknown-account tests in `src/auth/strategies/jwt.strategy.spec.ts`

**Checkpoint**: US2 is independently verifiable.

---

## Phase 5: User Story 3 — Résistance au bourrage d'identifiants réparti (P2)

**Goal**: Failures are capped per targeted account without enabling remote account lockout.

**Independent Test**: Exhaust the failure ceiling from several addresses, then present the correct
password.

- [X] T022 [US3] Add the `auth-login-account` policy to the allow-list in `src/coordination/schemas/rate-limit-bucket.schema.ts`
- [X] T023 [US3] Count failures only, never consuming or refusing on a correct password, in `src/auth/auth.service.ts`
- [X] T023a [P] [US3] Add per-account counting, HTTP 429 and anti-lockout tests in `src/auth/auth.service.spec.ts`

**Checkpoint**: US3 is independently verifiable.

---

## Phase 6: User Story 4 — Médias distants maîtrisés (P2)

**Goal**: A user-supplied media address can only designate an allow-listed host.

**Independent Test**: Submit an unauthorised host on a field accepting a media address.

- [X] T024a [US4] Restrict remote hosts to the product origins plus named historical avatar providers in `src/common/validation/safe-media-url.validator.ts`
- [X] T024b [P] [US4] Add allowed-host, rejected-host and suffix-imitation tests in `src/common/validation/safe-media-url.validator.spec.ts`

**Checkpoint**: US4 is independently verifiable.

---

## Phase 7: Cross-cutting hardening

**Purpose**: Requirements that belong to no single user story.

- [X] T025a Normalise the quota route key over case, redundant separators and neutral segments in `src/auth/middleware/auth-rate-limit.middleware.ts` *(corrects a gap in feature 001 FR-005: variants reached the controller unmetered)*
- [X] T025b [P] Add equivalent-route tests in `src/auth/middleware/auth-rate-limit.middleware.spec.ts`
- [X] T026 [P] Bound the page number in `src/hub/dto/list-hub-observations.dto.ts` and `src/hub/dto/list-hub-connectors.dto.ts`
- [X] T027 [P] Bound the page number in `src/admin/admin.service.ts`
- [X] T028 Neutralise tag closure and line separators in server-rendered inline scripts in `src/share/share-metadata.util.ts`
- [X] T029 Cap concurrent media generation in `src/media/media.service.ts` *(recorded as a bounded constitutional exception in `plan.md`)*

---

## Phase 8: Governance obligations

**Purpose**: Satisfy delivery gate 7 and prevent the entry-point failure from recurring.

- [X] T030 Update `project-docs/ARCHITECTURE.md` with the private media contract, the `passwordChangedAt` field, the new quota policy and the two optional settings
- [X] T031 Update `project-docs/ARCHITECTURE-ESSENTIALS.md` with the residual risks: public profile/post media, in-flight clients receiving 403 after deployment, and the per-instance generation ceiling
- [X] T032 Make `AGENTS.md` point to `.specify/memory/constitution.md` as the highest authority so that an agent cannot start from the weaker entry point

---

## Dependencies

- Phase 2 blocks Phase 3. T006 blocks T011–T014; T009 blocks T013.
- T017 blocks T018 and T020. T019 blocks T020.
- T022 blocks T023.
- Phases 4, 5, 6 and 7 are independent of each other and of Phase 3.
- Phase 8 depends on every implementation phase being complete.

## Release evidence

Constitution principle IX requires lint, build and relevant tests before a change is complete; the
delivery gates additionally require configuration validation. Results are recorded in `validation/`.

---

## Phase 9: Correctifs de non-régression après audit

- [X] T033 [US1] Extraire la barrière statique dans `src/media-access/private-media-access.middleware.ts`
- [X] T034 [US1] Interdire le cache des réponses privées valides sans modifier celui des médias publics
- [X] T035 [US1] Retourner HTTP 400 pour un chemin dont l'encodage pourcent est invalide
- [X] T036 [P] [US1] Tester les médias publics, privés valides, privés invalides et les chemins mal encodés
- [X] T037 [US2] Rendre atomiques la validation de session et la mise à jour de présence dans `src/users/users.service.ts`
- [X] T038 [P] [US2] Vérifier que les sessions révoquées et comptes bannis ne peuvent pas modifier la présence
- [X] T039 Corriger le formatage du setup Jest afin de restaurer le passage du contrôle lint Jenkins
- [X] T040 Enregistrer les résultats finaux lint, build et tests dans `validation/`
