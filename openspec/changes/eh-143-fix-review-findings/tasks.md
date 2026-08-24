# Tasks: eh-143-fix-review-findings

Domain: **health-profile**

## 1. Drawer status regression fix

- [x] 1.1 Restore `const status = assessmentStatusLabel(system.state_score, system.data_confidence);` in `src/components/health-profile-drawer.tsx` before the JSX return, keeping the three existing chip usages working
- [x] 1.2 Align the drawer's outdated-state copy with the shared wording family from design decision 3 ("Health Profile assessment is updating" / "The previous score is not shown as current")

## 2. Regression gate for the chip rendering

- [ ] 2.1 Create `scripts/verify-health-profile-drawer-status.ts` using `react-dom/server` `renderToStaticMarkup` with fixture `SystemInsight` objects; assert null-score systems render `Assessment unavailable`, scored systems render a non-empty canonical label, outdated systems render the updating copy, and no empty status chip is ever emitted
- [ ] 2.2 Register the script as `test:health-profile-drawer-status` in `package.json`, add its entry to `ci/verification-suite-policy.json` (`verify` job), and add the workflow step to `.github/workflows/measurement-registry.yml`

## 3. Behavior-neutral cleanups

- [x] 3.1 Hoist the repeated `persistedProfile ? version : …` ternaries in `src/app/api/health-profile/route.ts` into one `persistedVersion` binding and reuse it across the `assessment` object fields
- [x] 3.2 Align profile page banner and `OverallAssessmentCard` copy to the same wording family as the drawer (single "updating" phrasing family across all three surfaces)

## 4. QA checklist correction

- [x] 4.1 In `QA/eh-143/checklist.md`, replace the overstated typecheck-evidence line with scoped wording and note the DOM-global shadowing blind spot
- [x] 4.2 Add manual scenario EH143-UI-06 covering the three status-chip states (incomplete → `Assessment unavailable`, complete → numeric-derived label, outdated → unavailable + updating copy)

## 5. Registry documentation synchronization gate

- [x] 5.1 Run `pnpm generate:biomarker-docs`, `pnpm check:biomarker-docs`, and `pnpm test:biomarker-docs`; confirm all pass on the fix branch
- [x] 5.2 Run `pnpm render:biomarker-wiki` and produce the explicit local staging export
- [x] 5.3 Confirm remote Wiki publication, or record `PENDING`/`BLOCKED` with evidence, inside exactly one `[Registry Docs] EH-143` tracking issue created from `.github/ISSUE_TEMPLATE/registry-documentation-update.md`, linking canonical docs, commands, and verification results — recorded as `PENDING` with staging evidence in Hazyshades/EasyHealth#178

## 6. Verification

- [x] 6.1 Run `pnpm test:health-profile-drawer-status`, `pnpm test:eh143`, `pnpm test:eh141`, `pnpm test:health-profile-lab-input`, `pnpm typecheck`, and both CI coverage checks; all must pass
- [x] 6.2 Validate the change with `openspec validate --change eh-143-fix-review-findings` before opening the PR
