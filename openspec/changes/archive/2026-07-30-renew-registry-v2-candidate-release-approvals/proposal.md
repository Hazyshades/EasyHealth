## Why

PR #100 (EH-115) and current `master` both fail the Measurement Registry `verify` job because Registry 2.0 candidate approvals remain bound to the pre-resolver-v7 hash `92fad306…`, while the live candidate-input hash is `97403a4b…`. Thresholds and classifications are already green; only stale hash-bound approvals keep `launchable=false` and block merge.

## What Changes

- Renew the four required Registry 2.0 candidate approval records (`false_concrete_review`, two `score_affecting_binding`, and `release_gate`) to the verified current candidate-input hash after confirming every threshold passes and 44/44 classifications still match.
- Keep fail-closed behavior for any approval bound to a prior hash.
- Make the candidate release launchable again so `pnpm test:registry-v2-candidate-corpus`, `pnpm verify:registry`, and PR #100 `verify` can pass without changing resolver scoring, corpus fixtures, or EH-115 behavior.
- Push the renewed evidence through PR #100 (or a follow-up release PR) and merge only after required GitHub checks are green.

## Capabilities

### New Capabilities
- `release-gate-integrity`: Hash-bound Registry 2.0 release approvals may be renewed only for a fully verified candidate input and must make stale approvals fail closed.

### Modified Capabilities

None. Resolver, alias, incomplete-outcome, and decision-trace requirements stay unchanged; this change renews release evidence for the current verified input.

## Impact

- Domain: `documents` / Registry 2.0 launch evidence.
- `registry/candidate-release/v1/approvals.json`: renewed hash-bound release, false-resolution, and score-affecting approval evidence for candidate-input hash `97403a4b8a93c4a1dc65f2f4d994a431fd8311b2a9358ae1289c409194310232`.
- Candidate-corpus verification scripts and Measurement Registry CI `verify` on PR #100 / `master`.
- No resolver scoring, measurement identity, API, UI, migration, or stored observation behavior changes.
