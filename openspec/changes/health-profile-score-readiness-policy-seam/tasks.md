> **Status:** Implementation and verification evidence are present in the working tree; this task list makes the previously implicit architecture change reviewable and tracks its GitHub issue and branch isolation.

# Tasks: health-profile-score-readiness-policy-seam

## 1. Contract

- [x] 1.1 Define the `AssessmentCandidate`, explicit evaluation context, policy result, and unchanged public output boundary.
- [x] 1.2 Record exact identity, freshness, readiness, scoring, confidence, provenance, exclusion, aggregate, lifecycle, and legacy-payload invariants.

## 2. Policy implementation

- [x] 2.1 Add `src/lib/health-profile-score-policy.ts` with one `evaluateHealthProfileScorePolicy` entry point.
- [x] 2.2 Add the neutral `src/lib/health-profile-marker-status.ts` classifier and remove duplicated factual classification logic.
- [x] 2.3 Keep admission and direct-input filtering outside the policy; make `buildHealthProfile` the assembly seam.
- [x] 2.4 Preserve Registry 2.0 groups, score formulas, freshness boundaries, null-result behavior, provenance, exclusions, and overall threshold.

## 3. Consumer migration

- [x] 3.1 Migrate Health Profile snapshot, verification scripts, score provenance, golden fixtures, reported-result, and censored-marker consumers.
- [x] 3.2 Keep EH-146 lifecycle state separate from observation freshness and retain completed scores during recalculation.
- [x] 3.3 Remove production references to `suppressOutdatedHealthProfileAssessment`.

## 4. Evidence and documentation

- [x] 4.1 Run focused score, readiness, freshness, lifecycle, admission, projection, reported-result, and drawer checks.
- [x] 4.2 Update canonical docs, glossary, OpenSpec cross-references, QA evidence, and architecture status.
- [x] 4.3 Regenerate and verify biomarker documentation and publish the Wiki mirror at commit `0502d5c`.

## 5. Tracking and isolation

- [x] 5.1 Create one GitHub issue for this score/readiness policy change and link this OpenSpec, branch, canonical docs, Wiki status, verification, and known blockers — [Issue #249](https://github.com/Hazyshades/EasyHealth/issues/249).
- [ ] 5.2 Create a dedicated branch from the current baseline and commit only the changes made for this dialogue; preserve unrelated worktree changes without loss.
- [ ] 5.3 Validate this OpenSpec change strictly before delivery.
