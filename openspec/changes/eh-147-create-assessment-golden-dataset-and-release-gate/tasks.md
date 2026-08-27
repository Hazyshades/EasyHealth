## 1. Golden fixture pack

- [x] 1.1 Add `QA/eh-147/fixtures/pack.json` with pack version `eh147-golden-v1`, score algorithm version, and the case file list
- [x] 1.2 Add complete in-range and complete out-of-range cases covering all eight named systems with synthetic document-native ranges
- [x] 1.3 Add SI/US unit, missing-group (every scoreable system), invalid/inverted reference, context-only, alternatives, inflammation, and pending vs `manually_corrected` cases
- [x] 1.4 Commit per-system expected `scoreability`, `state_score`, readiness codes, and admission outcomes derived from production functions — not live-rewritten in CI

## 2. Runner and release gate

- [x] 2.1 Implement `scripts/verify-eh147-assessment-golden.ts` to evaluate fixtures through production eligibility, laboratory projection, readiness, scoring, and unit presentation
- [x] 2.2 Support `--technical-check`, `--check` (hash-bound Clinical Product approval), and `--report`; fail closed on mismatch or stale approval
- [x] 2.3 Register `pnpm test:eh147` and `pnpm check:eh147` in `package.json`
- [x] 2.4 Add the technical suite to `ci/verification-suite-policy.json` and the Measurement Registry verify workflow
- [x] 2.5 Add `QA/eh-147/approvals.json` schema with no fabricated Clinical Product approval

## 3. QA, docs, and evidence

- [x] 3.1 Create `QA/eh-147/checklist.md` from the roadmap template with synthetic data, interface checks that do not invent screens, and developer-evidence items
- [x] 3.2 Record that database tests are not applicable
- [x] 3.3 Add a verification pointer on `docs/05-data/score-required-groups.md` without duplicating the group table
- [x] 3.4 Run Registry documentation generate/check/test, Wiki render/staging, and record publication or `PENDING`/`BLOCKED` on exactly one Registry tracking issue

## 4. Verification

- [x] 4.1 Run `pnpm test:eh147`, `pnpm check:eh147` (expect fail-closed pending approval), `pnpm test:eh141`, `pnpm test:eh142`, `pnpm test:eh143`, `pnpm test:eh145`, `pnpm typecheck`, and `openspec validate --change eh-147-create-assessment-golden-dataset-and-release-gate --strict`
- [x] 4.2 Confirm `pnpm check:ci-suite-coverage` and `pnpm check:ci-suite-coverage-contract` pass after the new suite is registered
