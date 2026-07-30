## 1. Release evidence verification

- [x] 1.1 Generate the current Registry 2.0 candidate report and record candidate-input hash `97403a4b…`, all eight threshold results, 44/44 classification match, and zero false-concrete/processing-error counts.
- [x] 1.2 Confirm committed approvals still bind to `92fad306…` and that the gate fails closed with `launchable=false` before renewal.

## 2. Approval renewal

- [x] 2.1 Renew the `false_concrete_review` approval for `registry-safety-reviewer` to the verified current candidate-input hash with an explicit renewal id and review note.
- [x] 2.2 Renew both `score_affecting_binding` approvals for `alt_serum_catalytic_activity` and `glucose_serum` under `assessment-owner` to the same hash with binding keys preserved.
- [x] 2.3 Renew the `release_gate` approval for `release-manager` to the same hash with an explicit renewal note citing the reviewed report.
- [x] 2.4 Run `pnpm test:registry-v2-candidate-corpus` and `pnpm exec tsx scripts/registry-v2-candidate-corpus.ts --check` and confirm `launchable=true`.

## 3. Verification and merge

- [x] 3.1 Run `pnpm verify:registry`, `pnpm typecheck`, and `openspec validate renew-registry-v2-candidate-release-approvals --strict`.
- [x] 3.2 Commit only the renewed approvals and this OpenSpec change, then push to `Hazyshades/issue-15-eh-115-persist` / PR #100.
- [x] 3.3 Confirm GitHub `verify` and `database` are green, then merge PR #100 into `master`.
- [x] 3.4 Move the Ease Health project item for issue #15 to `Done` after merge.
