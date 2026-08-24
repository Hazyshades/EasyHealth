# Design: eh-143-fix-review-findings

Domain: **health-profile**

## Context

PR #176 restructured EH-143 scoring correctly, but the drawer edit dropped `const status = assessmentStatusLabel(...)` while keeping its usages. TypeScript passes because `lib.dom.d.ts` declares `declare var status: string`; in the browser the identifier resolves to `window.status` (`""`), so every system drawer renders an empty, uncolored status chip. The repo has no ESLint setup, no component-test infrastructure, and no Playwright suite for this surface; verification is `tsx` scripts under `scripts/verify-*.ts`, registered in `ci/verification-suite-policy.json` and `.github/workflows/measurement-registry.yml`. The Registry-documentation synchronization gate (per repo rules) requires a Wiki mirror render + publication record and exactly one `[Registry Docs] <change>` tracking issue; EH-143 has neither, unlike EH-128/129/131/144/145.

## Goals / Non-Goals

**Goals:**

- Restore correct status-chip rendering in `HealthProfileDrawer`.
- Add an automated gate that fails if the chip ever renders empty again.
- Finish the EH-143 registry-documentation completion gates.
- Behavior-neutral cleanups called out by review: route response assembly, copy alignment, QA checklist evidence correction.

**Non-Goals:**

- No change to scoring semantics, API response shape, or persistence (EH-143 contract stays as specified).
- No payload `schema_version` field — that belongs to EH-144 ("versioned Health Profile freshness projection"), which already owns versioning.
- No introduction of ESLint/Playwright/component-testing infrastructure.
- No EH-146 body-map state work beyond the shared wording alignment.

## Decisions

1. **Restore the local binding rather than renaming usages or inlining label logic.**
   `assessmentStatusLabel(stateScore, dataConfidence)` is the canonical helper (returns `"Assessment unavailable"` for null scores — exactly right for the readiness world). One restored line returns to the pre-regression rendering path with zero behavior drift. Alternative rejected: moving the label into a prop/threaded value adds plumbing for a single consumer.

2. **Guard the bug class with a server-side render assertion script, not new test infrastructure.**
   New `scripts/verify-health-profile-drawer-status.ts` uses `react-dom/server`'s `renderToStaticMarkup` on `HealthProfileDrawer` with fixture `SystemInsight` objects and asserts:
   - null-score system renders `>Assessment unavailable<`;
   - scored system renders a non-empty numeric-status label;
   - system whose reasons include `outdated` renders the updating copy;
   - rendered markup never contains an empty chip (`><\/span>` immediately following the badge class group).
   Effects are skipped during static render, so `useEffect` is safe; `next/link` renders plain anchors. Registered as `test:health-profile-drawer-status` in `package.json`, `ci/verification-suite-policy.json` (`verify` job), and the measurement-registry workflow, matching the existing convention. Alternative rejected: ESLint `no-restricted-globals` — repo has no ESLint at all; introducing linter configuration for one class of bug is disproportionate, and the render test asserts the actual user-visible outcome.

3. **Copy alignment without a shared constants module.**
   The three surfaces (page banner, overall card, drawer) each use their message once; a shared module would be an identity wrapper. Align them on one wording family ("Health Profile assessment is updating" headline family + "The previous score is not shown as current" body family) inline. Revisit a constants module only when EH-146 makes states first-class.

4. **Route cleanup is a pure binding hoist.**
   `const persistedVersion = persistedProfile ? version : null;` replaces four repeated ternaries in the `assessment` object. No semantic change; covered by typecheck plus the manual E2E claims already recorded.

5. **Registry-docs gate completes through the standard flow.**
   Run `pnpm render:biomarker-wiki`, produce the explicit local staging export, attempt remote publication confirmation; if remote access is unavailable, record `PENDING`/`BLOCKED` with evidence inside exactly one `[Registry Docs] EH-143` issue created from `.github/ISSUE_TEMPLATE/registry-documentation-update.md`. Local `generate/check/test:biomarker-docs` already pass (re-verified during review).

6. **QA checklist correction is part of this change, not a follow-up.**
   Replace the "typecheck proves consumers migrated" claim with scoped wording, add scenario EH143-UI-06 covering the three status-chip states, per the roadmap QA checklist rules.

## Risks / Trade-offs

- [Static render of a `"use client"` component may import browser-only modules] → Mitigation: the drawer's imports (`next/link`, `@/lib/*`) are SSR-safe today; the script runs in CI, so any future unsafe import fails loudly there, which is itself the desired guard.
- [Render assertions couple the script to exact copy strings] → Mitigation: assert only on stable canonical labels from `assessmentStatusLabel` and one short outdated phrase prefix; keep fixtures local to the script.
- [Wiki publication may be blocked by remote access] → Mitigation: the gate explicitly permits a recorded `PENDING`/`BLOCKED` state with evidence; the tracking issue carries the handoff.
- [Chip fix could regress silently again after future edits] → Mitigation: decision 2's CI-registered render check runs on every push to the workflow's paths.

## Migration Plan

Follow-up commits land on the existing EH-143 branch so PR #176 carries the fix before merge; no database, API, or persisted-payload changes, so rollback is a revert. Verification suites run before push, per repo convention.

## Open Questions

None — all decisions are local and reversible.
