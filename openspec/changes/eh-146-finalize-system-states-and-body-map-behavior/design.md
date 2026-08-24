## Context

The Health Profile is assembled from two existing contracts:

- `buildHealthProfile` returns a deterministic `state_score`, nullable strict-readiness result, data confidence, readiness groups, source evidence, and all named-system placeholders.
- `GET /api/health-profile` reads the latest append-only assessment version and the singleton recalculation job. A completed version can remain visible while a newer job is queued, processing, retryable-failed, or failed.

The current client renders the score/readiness axis in the body map and drawer, and renders job status as one generic amber block on the profile page. It does not expose whether that job state describes the current snapshot or an older snapshot. Body-map badge accessibility exists (focusable SVG groups plus Enter/Space activation), but labels, tooltips, dialog focus, and narrow-layout sizing need one consistent contract.

Constraints: keep the strict readiness/scoring algorithm unchanged; preserve factual marker/source links and same-origin deep links; do not add diagnosis, disease-risk, treatment, Registry, or persistence behavior; keep the existing first-party client compatible with profiles that have no assessment version yet.

## Goals / Non-Goals

**Goals:**

- Separate the two independent axes users need to understand:
  - score evidence: `scored` versus `insufficient` for each system;
  - assessment lifecycle: `current`, `processing`, `outdated`, or `error` for the snapshot shown.
- Compute lifecycle state once from assessment job status plus whether a current version exists, and expose it in the Health Profile API.
- Make map badges, chips, drawer metrics, overall cards, and lifecycle notices use factual, non-diagnostic copy and neutral insufficient styling.
- Preserve keyboard activation, visible focus, drawer semantics, selection state, and safe `system`/`returnTo` deep links.
- Keep the body map usable on narrow screens and preserve all eight named systems and source evidence.
- Add deterministic state mapping checks and a tester-facing EH-146 QA checklist.

**Non-Goals:**

- Changing readiness groups, score formulas, Registry catalog data, observation projection, or assessment persistence/RPCs.
- Adding a new score, interpreting values as diagnoses, recommending tests or treatment, or using red danger styling to represent insufficient evidence.
- Adding a realtime subscription or polling loop; existing reload/retry actions remain the lifecycle refresh mechanism.
- Replacing the existing drawer with a new navigation model or changing document/biomarker authorization.
- Providing a separate system-level database status; lifecycle remains a profile-wide assessment axis while each system retains its own score/readiness state.

## Decisions

### 1. Model evidence and lifecycle as separate axes

Add a pure helper in `src/lib/health-profile-assessment-state.ts`:

```ts
type HealthProfileAssessmentDisplayState =
  | "current"
  | "processing"
  | "outdated"
  | "error";

resolveAssessmentDisplayState(jobStatus, hasCurrentVersion)
```

`queued` or `processing` with a current version is `outdated`; the same statuses without a version are `processing`. `retryable_failed` and `failed` are `error` regardless of version. `succeeded` with a version is `current`; a missing job is treated as `current` only when a version exists and otherwise as `processing` for the initial fallback. This preserves an old completed payload while making its freshness explicit instead of hiding it or presenting it as the newest result.

A system remains `scored` exactly when `state_score !== null`; otherwise it is `insufficient` and continues to expose strict-readiness reasons. Lifecycle never changes the numeric score or readiness calculation. This avoids the unsafe shortcut of converting a processing/error condition into a health score or treating insufficient evidence as failure.

**Alternative considered:** infer lifecycle separately in every client from `status` and `fallback`. Rejected because the dashboard and profile could diverge, and because `fallback` describes storage presence rather than user-facing freshness.

### 2. Extend only response metadata, not persisted assessment payloads

`GET /api/health-profile` will add `assessment.display_state` and `assessment.has_current_version` beside the existing status, error, and fallback fields. The worker continues to persist the same `HealthProfileAssessment` payload; no migration or RPC change is needed. The profile and dashboard clients consume the explicit field and retain the latest payload during updates.

**Alternative considered:** add lifecycle fields inside `HealthProfileResult` and persist them in every version. Rejected because lifecycle is derived from mutable job state and would make an append-only assessment snapshot stale by construction.

### 3. Use neutral state language and styling

- Numeric values are labeled `Current state assessment`, never risk, probability, or diagnosis.
- `null` scores render `—` with muted slate treatment and labels such as `Insufficient data` or `Assessment unavailable`; no `0`, red fill, or danger chip represents missing evidence.
- `processing`, `outdated`, and `error` use factual update messages. An error describes recalculation failure and the availability of the last completed snapshot, not the person's health.
- Map badge native tooltips and accessible names include score/readiness state and the non-diagnostic boundary. Chips and drawer metrics expose the same state on keyboard focus/selection.
- Keep `MEDICAL_DISCLAIMER` and add a concise current-state disclaimer where the compact dashboard card otherwise has no profile disclaimer.

**Alternative considered:** use red/green health semantics for all badge states. Rejected because it violates EH-146's acceptance criterion and turns data lifecycle into implied clinical risk.

### 4. Preserve and harden existing interaction contracts

Keep SVG system badges as focusable `role="button"` groups, add explicit dialog affordance and tooltip text, and support Enter/Space activation. Focus-visible styling remains in global CSS. The drawer receives dialog focus on open and retains Escape/back/close behavior. Profile selection continues to update the existing same-origin URL helper, with a `popstate` listener so browser back/forward and direct deep links reconcile the selected chip after navigation.

**Alternative considered:** replace badges with `foreignObject` HTML buttons. Rejected because it changes the existing responsive SVG layout and creates inconsistent browser rendering; the current SVG button semantics are sufficient when completed with focus and dialog metadata.

### 5. Make mobile layout a sizing change, not a content fork

Keep the same systems, labels, score placeholders, drawer, and source links at every viewport. Reduce the profile map container's mobile minimum height and use the existing `preserveAspectRatio="xMidYMid meet"` SVG behavior; retain the larger desktop sizing at `min-[1100px]`. System chips wrap rather than scroll or disappear. This keeps narrow screens from reserving a desktop-height blank panel without introducing a second mobile map.

### 6. Verify pure behavior and user-visible paths separately

Add `scripts/verify-eh146-system-states.ts` for the lifecycle mapping and factual score-state helpers, register it as `pnpm test:eh146`, and run `pnpm typecheck`. Manual QA covers no-data/insufficient, scoreable, update-in-progress/outdated, failed-update, keyboard selection, tooltip/focus, mobile sizing, disclaimer copy, and deep-link return behavior. Runtime update/error cases are marked blocked unless a worker/job fixture is available; the checklist records exact evidence instead of claiming unavailable UI.

## Risks / Trade-offs

- A queued job with no persisted version can still show a deterministic fallback profile while the notice says `processing`; this is intentional so the page does not blank during the first calculation, but the notice must make the freshness boundary clear.
- A failed job with a persisted version shows factual old scores plus an error notice. Hiding the old snapshot would remove useful evidence; showing it without the notice would be misleading.
- Native SVG `title` tooltips vary slightly by browser and assistive technology. Accessible names and drawer text remain the authoritative equivalent; manual QA should verify both hover/focus and keyboard paths.
- Reducing mobile map height can make labels denser. The SVG remains aspect-ratio constrained and the drawer/chips provide the complete textual fallback.
- Existing historical payloads do not contain lifecycle metadata. The API derives it from the current job/version query, so no backfill is required; clients default missing metadata to the safe `current`/`processing` interpretation described above.
