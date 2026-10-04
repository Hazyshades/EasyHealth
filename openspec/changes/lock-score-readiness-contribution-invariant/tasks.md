## 1. Catalog invariant check

- [x] 1.1 Create `scripts/verify-score-readiness-contribution-invariant.ts` with an assertion function that takes a per-system lookup returning that system's readiness and contribution groups, plus the non-scoreable set, and returns the uncovered keys per system. Read the groups through `getRegistryV2ScoreReadinessGroups` and `getRegistryV2ScoreContributionGroups` from `src/lib/biomarkers/registry-v2-runtime.ts`, the same accessors `health-profile-score-policy.ts` imports, and take `NAMED_BODY_SYSTEMS` and `NON_SCOREABLE_SYSTEMS` from the same module. Do not read the static `SCORE_REQUIRED_GROUPS` or `SCORE_CONTRIBUTION_GROUPS` tables: nothing in the scoring path consumes them, so a check built on them would pass while a real binding regression went unnoticed.
- [x] 1.2 Skip systems with an empty readiness-group list and print the exemption, so `inflammation` and any future factual-only system are recorded as a decision rather than passing silently.
- [x] 1.3 Assert the shipped catalog returns no uncovered key, printing one line per system with its readiness-group count, contribution-group count, and exemption status.
- [x] 1.4 Build a synthetic copy of the tables with one readiness key dropped from its system's contribution coverage, assert the assertion function rejects it, and assert the failure names the system and the key.
- [x] 1.5 Make the script exit non-zero on any uncovered key, following the fail-closed convention of `registry-v2-candidate-corpus.ts --technical-check`.
- [x] 1.6 Run the script directly and confirm it passes on the shipped catalog and reports the counterfactual rejection.

## 2. Suite registration

- [x] 2.1 Add `test:score-readiness-contribution-invariant` to `package.json` pointing at the new script.
- [x] 2.2 Add the matching entry to `ci/verification-suite-policy.json` with job `verify`, environment `node-only`, owner `health-profile`, and a reason naming the coverage invariant.
- [x] 2.3 Add the step to the `verify` job in `.github/workflows/measurement-registry.yml` next to the other score-readiness suites.
- [x] 2.4 Run `pnpm check:ci-suite-coverage` and confirm the totals move from 112 covered to 113 with zero orphaned, partial, or invalid.
- [x] 2.5 Run `pnpm check:ci-suite-coverage-contract` to confirm the policy edit did not break the policy contract.

## 3. Documentation

- [x] 3.1 Add the coverage precondition to `docs/05-data/score-required-groups.md` directly under the approved-groups table, stating it once and naming `inflammation` as exempt.
- [x] 3.2 Annotate the synthetic registry in `scripts/verify-score-exclusion-contract.ts` to record that its `thyroid` contribution group deliberately violates the new invariant, so the scoreable-but-no-contributors fixture reads as a documented counterfactual rather than a reachable production state. Comment only, no assertion or expectation changes.
- [x] 3.3 Run `pnpm check:documentation-links`.
- [x] 3.4 Run `pnpm generate:biomarker-docs`, `pnpm check:biomarker-docs`, and `pnpm test:biomarker-docs`, and confirm the generated output is unchanged because the catalog itself did not change.

## 4. Smoke assertion accuracy

- [x] 4.1 In `scripts/eh145-smoke-provenance-panel.mts`, slice the exclusion row on `</li>` as well as `<li` so the row-scoped assertions inspect one row rather than the document tail.
- [x] 4.2 Keep a whole-document negative assertion alongside the row-scoped positive, so the guarantee the current chunking provided (catching a machine code in any later row) is not lost.
- [x] 4.3 Run `pnpm smoke:eh145` and confirm it passes, and confirm it still fails when the machine code is reintroduced into any row.

## 5. Verification

- [x] 5.1 Run `pnpm typecheck` and `pnpm typecheck:worker`.
- [x] 5.2 Run the new suite plus `test:score-exclusion-contract`, `test:eh145`, `smoke:eh145`, `test:eh141`, `test:eh143`, `test:eh144`, `test:eh146`, `test:eh147`, `test:biomarkers`, and `check:ci-suite-coverage`.
- [x] 5.3 Confirm `prettier --check` passes on every file whose style this change controls: the new script, both touched verification scripts, `package.json`, and the workflow. **Exception, deliberately not met:** `docs/05-data/score-required-groups.md` and `ci/verification-suite-policy.json` were already prettier-dirty at `HEAD` as part of paper cut `pc_afdf8e83f341` (796 files repo-wide) and are left in their committed style rather than reformatted, because reformatting adds roughly 130 lines of unrelated churn.
- [x] 5.4 Confirm no change to `GET /api/health-profile` output: the invariant already holds, so no score, readiness, or provenance value moves.
- [x] 5.5 Complete the Registry documentation gate: create one `[Registry Docs]` tracking issue recording the canonical page change, the zero-diff generated output, and a verified not-applicable Wiki status with the evidence that `docs/05-data/score-required-groups.md` is not one of the seven mirrored pages.
