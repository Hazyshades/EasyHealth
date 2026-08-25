# Proposal: eh-143-fix-review-findings

Domain: **health-profile**

## Why

The thermo-nuclear review of commit `4a146e0` / PR #176 (issue #43) found one shipped regression and two process gaps. `HealthProfileDrawer` lost its local `const status = assessmentStatusLabel(...)` binding while keeping its three usages, so the identifier silently resolves to the DOM global `window.status` (`""`) — every system drawer now renders an empty, uncolored status chip. Typecheck cannot catch this class (`lib.dom.d.ts` declares `var status: string`), so no automated gate flagged it. Separately, the Registry-documentation synchronization gate for EH-143 was never completed: no `[Registry Docs] EH-143` tracking issue exists and Wiki-mirror publication is unrecorded, while sibling changes (EH-128/129/131/144/145) all have one.

## What Changes

- Restore canonical status-label derivation in `HealthProfileDrawer`: re-add `const status = assessmentStatusLabel(system.state_score, system.data_confidence)` and remove the now-dead `assessmentStatusLabel` import if unused elsewhere in the file.
- Add deterministic regression coverage that renders `HealthProfileDrawer` server-side (`react-dom/server` `renderToStaticMarkup` in a `tsx` verification script) and asserts the status chip contains a non-empty label for null-score, scored, and outdated systems — the exact bug class that slipped through.
- Simplify `GET /api/health-profile` response assembly by hoisting the repeated `persistedProfile ? version : …` ternaries into one `persistedVersion` binding. Behavior-neutral cleanup.
- Unify the three divergent "assessment updating" phrasings (profile page banner, `OverallAssessmentCard`, drawer) on one shared wording family sourced from a single module constant set.
- Complete the Registry-documentation synchronization gate for EH-143: run `pnpm render:biomarker-wiki` plus the explicit local staging export, confirm remote Wiki publication or record `PENDING`/`BLOCKED` with evidence, and create exactly one `[Registry Docs] EH-143` tracking issue using `.github/ISSUE_TEMPLATE/registry-documentation-update.md`.
- Correct the misleading evidence line in `QA/eh-143/checklist.md` ("typecheck proves consumers migrated") and add a manual UI scenario covering the status-chip rendering states.

No breaking changes: API shape, scoring semantics, and persistence are untouched.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `health-profile-score-readiness`: add presentation-layer requirements — the Health Profile UI must derive assessment status labels exclusively from the canonical helper (`assessmentStatusLabel`) and must never render an empty or ambient-resolved status value; readiness-driven UI states (`missing` guidance, `invalid` notice, `outdated` withholding) remain rendered as specified. Existing API/suppression requirements are unchanged.
