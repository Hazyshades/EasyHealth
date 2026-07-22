# Registry 2.0 Candidate-release Corpus v1

This directory is a versioned, de-identified release fixture. It is evaluated
by `pnpm check:registry-v2-candidate-corpus`; the runner reads these inputs and
prints evidence only. It does not call application writers or mutate patient,
database, score, readiness, trend, or manual-decision state.

- `corpus.json` contains the required 44 launch rows, exact raw label/unit/value
  kind, expected classification, and fixture-only manual-correction evidence.
- `documents.json` and `documents/` provide de-identified document metadata for
  panel, language, laboratory, and specialty coverage.
- `policy.json` defines numeric gates and named reviewers.
- `approvals.json` must bind every approval to the current candidate input hash.
- `reset-rollback.md` records the pre-launch reset and forward-only rollback
  procedure.

After changing a hashed input, run
`pnpm report:registry-v2-candidate-corpus`, review the new candidate input hash,
and refresh the required approval evidence before the check can pass.
