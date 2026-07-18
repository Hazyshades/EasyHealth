# EH-104 Design: Separate resolver outcomes from verification status

This document captures the corrected design after review. It is the thinking record;
EH-104 intentionally limits itself to the schema contract, storage ownership, and
minimal cross-axis DB guards. The full workflow is EH-120.

## 1. Corrected ownership model

```
document_extracted_biomarkers  — PRE-ACCEPTANCE review state ONLY
  resolver_result        (candidate; add CHECK incl. partial)
  verification_status    (pre-acceptance; NOT NULL DEFAULT 'pending')
  WARNING: after an observation is created this row is NOT authoritative

        | accept / createNormalizationCandidate

observation_normalization_revisions  — ACTIVE ROW = SOURCE OF TRUTH
  resolver_result        resolved|ambiguous|partial|unmapped
  verification_status    pending|auto_verified|user_verified|manually_corrected|rejected  (NOT NULL)
  verification_decided_at timestamptz
  verification_actor_type  system|user
  verification_actor_id    uuid nullable
  is_active            (guarded by existing unique partial index)

        | DTO projects resolver_result + verification_status
        | observations.resolution_status synced atomically from active revision (see §7)

observations  — canonical measurement result
  resolution_status      (resolver outcome; ATOMIC PROJECTION of active revision)  ✅
  verification_status    ❌ NOT added in EH-104 (deferred)
  measurement_definition_key, analyte_key, normalization_revision_id
```

Verification is read from the **active revision**, never from `document_extracted_biomarkers`
and never from `observations` columns. `observations.resolution_status` is a projection
kept equal to the active revision's `resolver_result` (see §7).

## 2. resolver_result × verification_status matrix

```
resolver_result │ pending │ auto_verified │ user_verified │ manually_corrected │ rejected
────────────────┼────────┼──────────────┼──────────────┼────────────────────┼────────
resolved        │   ✓    │      ✓       │      ✓       │        ✓           │   ✓
partial         │   ✓    │      ✗       │      ✗       │        ✗           │   ✓
ambiguous       │   ✓    │      ✗       │      ✗       │        ✗           │   ✓
unmapped        │   ✓    │      ✗       │      ✗       │        ✗           │   ✓

✗ forbidden: verified (auto_verified|user_verified|manually_corrected) requires
  resolver_result='resolved' AND measurement_definition_key IS NOT NULL (DB CHECK, I3).
  Additionally the selected definition MUST be maturity='reviewed' (service guard, I3b).
  To verify an incomplete row, manual selection must first create/activate a resolved
  revision with a reviewed measurement definition.
```

## 3. DB invariants

```
#  Invariant                                                  Enforcement
-- ---------------------------------------------------------- ------------------------------
I1 verification_status ∈ {pending,auto_verified,user_verified, NOT NULL DEFAULT 'pending' + CHECK
   manually_corrected,rejected}
I2 resolver_result ∈ {resolved,ambiguous,partial,unmapped}    CHECK on revisions (exists),
   in ALL tables                                            observations (exists),
                                                              document_extracted_biomarkers (ADD),
                                                              measurement_resolution_shadow_events (ADD)
I3 verified ⇒ resolved + definition present (DB CHECK)       CHECK on observation_normalization_revisions:
   verification_status IN (auto_verified,user_verified,         NOT (verification_status IN
   manually_corrected)                                         (auto_verified,user_verified,
   ⇒ resolver_result = 'resolved'                              manually_corrected)
      AND measurement_definition_key IS NOT NULL               AND (resolver_result <> 'resolved'
                                                              OR measurement_definition_key IS NULL)
I3b verified definition MUST be 'reviewed' (service guard)    inside the single RPC/service that
                                                              writes the verified revision
                                                              (compatibleManualDefinitions already
                                                              filters maturity='reviewed'); NOT a DB
                                                              CHECK because maturity lives in the
                                                              code Registry, not the DB
I4 auto_verified ⇒ actor_type='system' ∧ actor_id IS NULL    CHECK
I5 user_verified|manually_corrected ⇒ actor_type='user' ∧    CHECK
   actor_id IS NOT NULL
I6 pending ⇒ actor_type IS NULL ∧ actor_id IS NULL ∧          CHECK
   decided_at IS NULL
I7 rejected is terminal on its row: once rejected, the same   before-update trigger
   row's status cannot change (reprocessing inserts a NEW row)
I8 decided_at is set when status leaves 'pending'             before-update trigger
I9 document_extracted_biomarkers.verification_status is       convention + DTO projects from
   pre-acceptance only; not authoritative after observation   the active revision
   creation
I10 exactly one active revision per extracted_biomarker_id    existing unique partial index
I11 after promotion, observations.resolution_status =         enforced in same transaction as
   active_revision.resolver_result (atomic projection)        promote; asserted by fixture
```

## 4. Scope boundary: EH-104 / EH-112 / EH-120

```
EH-104 (Sprint 1, P0)        EH-112 (Sprint 2)               EH-120 (Sprint 3)
──────────────────────       ─────────────────────          ─────────────────────
schema contract              end-to-end persistence/         full verification state machine
storage ownership            serialization partial/          permissions
minimal cross-axis guards    ambiguous/unmapped             reasons, batch API
DTO projection               UI wording                      UI actions
explicit system auto-verify  trends/assessment exclusion     reprocessing/manual-decision
  API (defined, NOT wired)   metrics, fixtures                transitions
resolution_status sync       (incl. verified definition)     + RUNTIME activation of
fixtures                                                auto_verification

deps: EH-102, EH-103         deps: EH-104, EH-109, EH-111     deps: EH-104, EH-112
```

Roadmap intersections: EH-117 (review UX) deps EH-112/EH-113/EH-118; EH-119 (edit/correction)
deps EH-118/EH-120. EH-104 is the foundation that unblocks EH-112 → EH-120 → EH-117/EH-119.

**EH-104 does NOT activate `auto_verified` at runtime.** It defines the contract and the
explicit system decision API, but the runtime call site that would invoke auto-verification
is wired in EH-120. This keeps EH-104's scope and risk bounded.

## 5. Automatic-promotion call graph (key finding) + decision

```
decideAutomaticPromotion()                 src/lib/documents/normalization-policy.ts:23
  ├─ called by: scripts/verify-measurement-registry-runner.ts:25   ← TEST ONLY
  └─ imported by: src/lib/documents/normalization-revisions.ts:19  ← re-export, not called internally

Runtime promotion (promoteNormalizationRevision):
  ├─ src/lib/documents/biomarker-acceptance.ts:42
  │     after createNormalizationCandidate(verificationStatus:"user_verified", actorId=profileId)
  │     ⇒ USER path ⇒ user_verified, NOT auto
  └─ src/app/api/documents/[id]/biomarkers/route.ts:256
        after createManualCorrection(verificationStatus:"manually_corrected", actorId=profileId)
        ⇒ USER path ⇒ manually_corrected, NOT auto

RPC promote_observation_normalization_revision()  supabase/migrations/021:55
  └─ sets is_active=true, observation_id, promoted_at, promoted_by
  └─ does NOT set verification_status (stays as created)
  └─ does NOT compute auto_verified
```

Conclusion: no end-to-end automatic promotion exists. `auto_verified` is produced nowhere.
`decideAutomaticPromotion` is dead code at runtime.

Decision (per review): EH-104 introduces `createAutomaticVerification()` as a safe, explicit
system decision source but does **NOT** invoke it at runtime:

```
createAutomaticVerification(extractedBiomarkerId, input):   # defined in EH-104, NOT called yet
  resolution = resolveMeasurementDefinition(input)
  decision   = decideAutomaticPromotion({ resolution, mappingClassification, qualityGateApproved })
  if decision.allowed:
    createNormalizationCandidate({
      extractedBiomarkerId,
      input,
      verificationStatus: "auto_verified",
      verificationActorType: "system",
      verificationActorId: null,
    })
    # trigger sets verification_decided_at = now()
```

Until EH-120 wires the runtime call site, production rows may remain `pending`. This does
not change scoring eligibility (`resolution_status = 'resolved'` + reviewed assessment binding).

## 6. Partial/ambiguous → verified rule

A row with `resolver_result ∈ {partial, ambiguous, unmapped}` can NEVER be mutated directly
into a verified status. The only path to verification is:

1. Manual selection (`createManualCorrection`) creates/activates a **resolved** revision
   with a **reviewed** measurement definition (`compatibleManualDefinitions` already
   filters `maturity === 'reviewed'`).
2. That resolved revision may then carry `user_verified` / `manually_corrected`
   (or `auto_verified` if a system decision source runs, EH-120).

Guard I3 enforces the DB-level precondition (resolved + non-null definition); guard I3b
enforces the reviewed-maturity precondition inside the writing RPC/service.

## 7. resolution_status duplication: active revision is truth, observations is a projection

`resolution_status` exists on both `observations` and the active revision. This is
intentional but must be explicit:

- The **active normalization revision** is the source of truth for the resolver outcome.
- `observations.resolution_status` is an **atomically-synced projection** of the active
  revision's `resolver_result`, kept equal so scoring/querying can read `observations`
  without joining revisions.

The promote RPC (migration 021) currently updates `measurement_definition_key` and
`normalization_revision_id` on `observations` but NOT `resolution_status`. EH-104 extends
that same transaction to also set `observations.resolution_status = target.resolver_result`,
so every promotion/correction keeps the projection equal to the active revision. Invariant
I11 captures this; a fixture (see tasks) asserts equality after promotion.

## 8. Rejected terminality

A `rejected` revision stays `rejected` for audit. Reprocessing never mutates the
rejected row; it inserts a new revision (default `pending` or re-resolved). Guard I7
blocks any UPDATE that changes a `rejected` row's `verification_status`. The full
reprocessing transition flow (new revision promotion, supersession links) is EH-120.

## 9. DTO projection

Review UI already projects from the active revision
(`components/documents/document-viewer.tsx` reads `normalization.activeRevision.verification_status`
and `resolver_result`). EH-104 extends the same projection to the observation-level
DTOs that currently omit verification:

- `src/app/api/biomarkers/route.ts` (`OBSERVATION_SELECT` / row mapping)
- `src/app/api/health-profile/route.ts` (observation select)
- `src/app/api/documents/[id]/route.ts` (`OBSERVATION_SELECT` at line 27)

Each must join/project `resolver_result` + `verification_status` from the active
revision rather than from `document_extracted_biomarkers` or `observations`.

## 10. Index note

`normalization_revisions_active_manual_idx` (migration 021) is a partial index
`WHERE is_active AND verification_status IN ('user_verified','manually_corrected')`.
No runtime query in the codebase filters by that exact combination, so its serving
query is unconfirmed. EH-104 leaves the index unchanged; revisiting it (e.g. to add
`auto_verified`) is deferred until the queries it serves are identified.
