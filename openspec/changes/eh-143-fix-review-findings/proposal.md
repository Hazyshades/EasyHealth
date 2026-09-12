> **Status:** The score/readiness calculation is now owned by the internal `health-profile-score-policy` module. EH-146 supersedes the former job-freshness score suppression described below: queued or processing recalculation retains the completed score and exposes `assessment.display_state` separately. Observation-level `outdated` and `unknown_date` remain score-readiness outcomes. Historical proposal context is retained.

# Proposal: eh-143-fix-review-findings

Domain: **health-profile**

## Why

The thermo-nuclear review of commit `4a146e0` / PR #176 (issue #43) found one shipped regression and two process gaps. `HealthProfileDrawer` lost its local `const status = assessmentStatusLabel(...)` binding while keeping its three usages, so the identifier silently resolves to the DOM global `window.status` (`""`) — every system drawer now renders an empty, uncolored status chip. Typecheck cannot catch this class (`lib.dom.d.ts` declares `var status: string`), so no automated gate flagged it. Separately, the Registry-documentation synchronization gate for EH-143 was never completed: no `[Registry Docs] EH-143` tracking issue exists and Wiki-mirror publication is unrecorded, while sibling changes (EH-128/129/131/144/145) all have one.

## What Changes

- Restore canonical status-label derivation in `HealthProfileDrawer`: re-add `const status = assessmentStatusLabel(system.state_score, system.data_confidence)` and remove the now-dead `assessmentStatusLabel` import if unused elsewhere in the file.
- Add deterministic regression coverage that renders `HealthProfileDrawer` server-side (`react-dom/server` `renderToStaticMarkup` in a `tsx` verification script) and asserts non-empty labels for null-score, scored, and observation-stale systems, plus retention of a completed score when the lifecycle state is `outdated`.
- Simplify `GET /api/health-profile` response assembly by hoisting the repeated `persistedProfile ? version : …` ternaries into one `persistedVersion` binding. Behavior-neutral cleanup.
- Keep the profile page banner, `OverallAssessmentCard`, and drawer on the shared EH-146 lifecycle wording; the lifecycle state is separate from score/readiness labels and does not move presentation copy into the policy module.
- Complete the Registry-documentation synchronization gate for EH-143: run `pnpm render:biomarker-wiki` plus the explicit local staging export, confirm remote Wiki publication, and update the existing matching tracking issue `Hazyshades/EasyHealth#247` with canonical docs, commands, status, and remaining gaps.
- Correct the misleading evidence line in `QA/eh-143/checklist.md` ("typecheck proves consumers migrated") and add a manual UI scenario covering the status-chip rendering states.

No breaking changes: API shape, scoring semantics, and persistence are untouched.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `health-profile-score-readiness`: add presentation-layer requirements — the Health Profile UI must derive assessment status labels exclusively from the canonical helper (`assessmentStatusLabel`) and must never render an empty or ambient-resolved status value; readiness-driven UI states (`missing` guidance, `invalid` notice, observation-level `outdated`/`unknown_date`) remain rendered as specified. EH-146 owns job lifecycle state, and queued or processing updates retain completed scores.
