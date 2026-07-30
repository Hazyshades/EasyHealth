## Context

PR #100 for EH-115 is mergeable for database checks, but Measurement Registry `verify` fails on the Registry 2.0 candidate release gate. The live report for catalog `2026-07-28.0` / resolver `7` / normalization `5` produces candidate-input hash `97403a4b8a93c4a1dc65f2f4d994a431fd8311b2a9358ae1289c409194310232`. All eight thresholds pass, 44/44 expected classifications match, and false concrete resolutions / processing errors remain zero. Committed approvals in `registry/candidate-release/v1/approvals.json` still bind to `92fad306…` from the resolver v6 renewal, so the gate correctly fails closed with `launchable=false`.

This is the same fail-closed class already handled by `fix-eh109-release-gates`, scoped now to renewing evidence for the current verified input without any EH-115 behavior change.

## Goals / Non-Goals

**Goals:**

- Renew every required hash-bound approval to the verified current candidate-input hash after recording the full threshold and classification report.
- Restore `launchable=true` for the committed candidate release so local and GitHub `verify` can pass.
- Keep stale prior-hash approvals failing closed.
- Unblock merge of PR #100 once required checks are green.

**Non-Goals:**

- Change scoring weights, thresholds, aliases, measurement definitions, corpus fixtures, or expected classifications.
- Change EH-115 decision-trace persistence, migrations, APIs, or UI.
- Weaken approval binding by removing resolver/catalog versions from the candidate-input hash.
- Fabricate approvals without first proving the new report remains within release thresholds.

## Decisions

### 1. Renew approvals only after comparing the full report

Generate the candidate report with `pnpm report:registry-v2-candidate-corpus`, record the exact candidate-input hash and every threshold/classification metric, then update all four required approvals to that same hash with explicit renewal identifiers and notes. Verify with `pnpm test:registry-v2-candidate-corpus` and `pnpm exec tsx scripts/registry-v2-candidate-corpus.ts --check`.

Alternative rejected: reuse the old hash or omit resolver version from the input identity. That would defeat fail-closed release gating.

### 2. Keep the change evidence-only

Touch only `registry/candidate-release/v1/approvals.json` (plus OpenSpec artifacts). Do not regenerate corpus fixtures, rewrite policy thresholds, or alter resolver code in this change.

Alternative rejected: broaden into a resolver or fixture repair. The report already proves behavior is within gate; only approval binding is stale.

### 3. Ship through the open EH-115 PR and treat green `verify` as the merge gate

Commit the renewed approvals on `Hazyshades/issue-15-eh-115-persist`, wait for GitHub `verify` and `database` to pass, then merge PR #100. After merge, move the Ease Health project item for issue #15 to `Done`.

Alternative rejected: open a separate master-only PR first. The failure already blocks #100, and the evidence renewal is independent of EH-115 runtime code, so landing it on the same branch unblocks the release path with less churn.

## Risks / Trade-offs

- [Approval renewal could look like fabricated review] → Renew only after the report proves every threshold and classification is unchanged; write explicit notes citing the reviewed hash, threshold report, and zero false-concrete/processing-error counts.
- [Another catalog/resolver bump could invalidate the new hash again] → Keep fail-closed binding; do not weaken hash inputs. Future bumps require another verified renewal.
- [Shipping on the EH-115 branch mixes release evidence with feature work] → Keep the commit scoped and titled as release-gate evidence so review remains auditable; do not fold unrelated papercuts or code edits into it.

## Migration Plan

1. Confirm current report metrics and candidate-input hash `97403a4b…`.
2. Renew all required approvals in `approvals.json` to that hash with new ids/notes.
3. Run candidate-corpus test/check and `pnpm verify:registry`.
4. Commit and push to PR #100; merge after required GitHub checks are green.
5. Rollback before merge by reverting the approvals commit; after merge, renew again rather than rewriting history.

## Open Questions

None. The local report and CI failure identify a bounded, reproducible evidence renewal.
