## Why

The score/readiness policy currently has an unwritten invariant that makes a whole class of score states unreachable: every readiness-group key must also appear in some contribution group of the same system. It holds today for all eight named systems, but nothing asserts it. A future catalog edit that adds a readiness key without a matching contribution group would silently create a system that reports `scoreable` with `state_score: null` and an exclusion reason of `score_not_available`, and every existing suite would stay green.

The invariant is also what makes the exclusion-detail contract readable. PR #266 narrowed `reason_detail` to fire only when `score_not_available` coincides with a genuinely incomplete readiness group, and pinned the scoreable-but-no-contributors case as a guard. That guard only means something once the invariant is enforced rather than assumed.

## What Changes

- Add a catalog-level contract check asserting that, for every scored named system, each readiness-group key is covered by at least one contribution group of the same system. Non-scoreable systems are exempt.
- Fail the check closed, matching the existing `registry-v2-candidate-corpus --check` and `--technical-check` convention, so CI rejects the catalog rather than reporting a warning.
- Record the invariant in the canonical score-readiness documentation so a future catalog author meets it before breaking it, not after.
- Add a negative fixture proving the check actually fails on a system whose readiness key has no contribution group, so the contract cannot silently degrade into a tautology.
- Tighten the EH-145 provenance smoke assertion so the "no machine code" check is scoped to one exclusion row instead of every row after it.

No breaking change. No score, readiness, or API behaviour changes: the invariant already holds, so this change only makes the existing state enforced rather than accidental.

## Capabilities

### New Capabilities

None. This adds no product surface; it constrains an existing one.

### Modified Capabilities

- `health-profile-score-readiness`: the existing requirement states readiness-complete implies a numeric score, but never states the catalog precondition that makes it true. Add the precondition as a requirement with its own scenarios, so a catalog edit that breaks it is a contract failure rather than a behavioural surprise.

## Impact

- `src/lib/biomarkers/registry-v2-runtime.ts` and `src/lib/biomarkers/measurement-resolution.ts`: read-only input to the new check, through the same accessors the policy imports. No edit.
- `src/lib/biomarkers/catalog/index.ts`: read-only input for the system list and the non-scoreable set. The static `SCORE_REQUIRED_GROUPS` and `SCORE_CONTRIBUTION_GROUPS` tables there are deliberately *not* used: nothing in the scoring path reads them, so asserting against them would guard a source the policy does not consume. No edit.
- `scripts/verify-score-readiness-contribution-invariant.ts`: new verification script, registered in `package.json`, `ci/verification-suite-policy.json`, and the `verify` job of `.github/workflows/measurement-registry.yml`.
- `docs/05-data/score-required-groups.md`: one clause added to the approved-groups section stating the coverage precondition.
- `scripts/eh145-smoke-provenance-panel.mts`: assertion scoped to a single exclusion row.
- No database, migration, RPC, or API change. `GET /api/health-profile` responses are unaffected.
- Registry documentation gate applies: the change touches Registry CI, so it needs a `[Registry Docs]` tracking issue. `generate:biomarker-docs` output is expected to be unchanged because the catalog itself does not change.
