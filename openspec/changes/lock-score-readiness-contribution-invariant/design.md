## Context

The score/readiness policy derives readiness groups and contribution groups independently from the Registry 2.0 catalog. `SCORE_REQUIRED_GROUPS` lists what a system needs before it may be scored; `SCORE_CONTRIBUTION_GROUPS` lists the axes that can actually produce a number. Nothing in the type system, the policy, or any suite relates the two tables.

Today they happen to be consistent. `resolveReadinessGroup` and `selectContributionMarkers` both resolve a group through the same `pickUsableMarker` with the same `isUsableCoreMarker` predicate, so the following holds by construction of the two call sites, not by any declared contract:

```
every readiness group satisfied  ->  at least one usable marker
                                 ->  its key sits in some contribution group
                                 ->  that group resolves a usable marker
                                 ->  selections.length > 0  ->  state_score numeric
```

Measured across the current catalog, zero readiness keys are uncovered:

| system | readiness groups | contribution groups | uncovered keys |
| --- | --- | --- | --- |
| cardiovascular | 3 | 4 | 0 |
| metabolic | 1 | 1 | 0 |
| thyroid | 2 | 2 | 0 |
| liver | 5 | 6 | 0 |
| kidney | 2 | 8 | 0 |
| blood | 4 | 5 | 0 |
| nutrients | 3 | 3 | 0 |
| inflammation | 0 | 0 | n/a, non-scoreable |

The gap is enforcement, not correctness. Constraints shaping the design:

- The repository has no test framework. Verification is hand-written `scripts/verify-*.ts` run through `tsx` on `node:assert`.
- `ci/verification-suite-coverage.json` policy plus `check:ci-suite-coverage` requires every `test:*` script to be registered in the policy and run by a CI job, or CI reports it as `orphaned`.
- The repo forbids introducing a second convention beside an existing one. Catalog checks already exist in a recognisable shape: `registry-v2-candidate-corpus.ts --check` and `--technical-check`.
- PR #266 already pinned the scoreable-but-no-contributors case in `scripts/verify-score-exclusion-contract.ts` using a synthetic registry. That fixture is currently the only place the state is exercised, and nothing tells a reader whether it is reachable or not.

## Goals / Non-Goals

**Goals:**

- Make "every readiness key is covered by a contribution group" an enforced, fail-closed contract on the catalog rather than an observed coincidence.
- State the precondition in the canonical score-readiness documentation so a catalog author meets it before breaking it.
- Convert the synthetic scoreable-but-no-contributors fixture from an unexplained hypothesis into a documented counterfactual: the synthetic registry deliberately breaks the invariant so the policy's behaviour under violation stays pinned.
- Make the check itself non-tautological by proving it fails on a violating input.

**Non-Goals:**

- Changing the catalog, the policy, the API contract, or any score value. The invariant already holds, so this change is invisible at runtime.
- Introducing a shared type that makes the two tables structurally related. The tables serve different product concepts; coupling their types would force legitimate catalog edits to change type signatures.
- Adding a general-purpose catalog invariant framework. One check, in the existing style.
- Reviewing or replacing the eight text-grep guards on `document-viewer.tsx`, or the absent coverage on `measurement-resolution.ts`.

## Decisions

**D1. Assert the invariant in a dedicated verification script rather than inside an existing suite.**

Considered: extend `verify-eh141-score-required-groups.ts`, which already validates approved readiness groups. Rejected, because EH-141 is owned by the Clinical Product sign-off trail recorded in `docs/05-data/score-required-groups.md`. Adding a structural precondition there would make a product-approval suite fail on an engineering-only violation, blurring who owns the gate. A separate script keeps the two failure causes independently diagnosable.

**D2. Read the two catalog tables directly, not through the Registry 2.0 runtime facade.**

`registry-v2-runtime.ts` re-exports `getRegistryV2ScoreReadinessGroups` and `getRegistryV2ScoreContributionGroups` as per-system accessors. The check needs the whole table at once to compare keys across the two, so it imports `SCORE_REQUIRED_GROUPS` and `SCORE_CONTRIBUTION_GROUPS` from the catalog module. The runtime facade stays the only path for the policy itself, so the check does not become a second way to read the policy's inputs.

**D3. Treat the check as a structural assertion over `Record<NamedBodySystemId, ...>`, not over the runtime snapshot.**

`NAMED_BODY_SYSTEMS` and `NON_SCOREABLE_SYSTEMS` drive the iteration. A system with an empty readiness-group list is skipped rather than asserted: `inflammation` is intentionally factual-only and has no contribution groups, so requiring coverage there would be a false failure. The skip is stated in the output when it fires, so a new empty-group system is visible as a decision rather than as silence.

**D4. Prove the check fails, using a deliberate counterfactual in the same script.**

A check that only ever sees a passing catalog cannot be distinguished from a check that always passes. The script therefore builds a copy of the tables with one readiness key removed from its coverage, runs the same assertion function against it, and asserts the failure. The assertion function takes the tables as parameters specifically so this is possible without mutating the real catalog.

**D5. Register the script exactly like every other suite.**

`package.json` gains `test:score-readiness-contribution-invariant`; `ci/verification-suite-policy.json` gains a matching entry with owner `health-profile` and a reason naming the invariant; `.github/workflows/measurement-registry.yml` gains a step in the existing `verify` job next to the other score-readiness suites. Skipping any one of the three makes `check:ci-suite-coverage` report `orphaned`, which is how the repository already prevents unregistered suites.

**D6. Document the precondition next to the approved-groups table.**

`docs/05-data/score-required-groups.md` states the coverage precondition once, immediately under the approved-groups table, because that is where a catalog author looks when adding a key. The score-exclusion detail rule already added by PR #266 stays where it is, under "Exclusions and limits".

**D7. Scope the EH-145 smoke negative assertion to one row.**

`global.split("<li").find(...)` yields a chunk running from the matched row to the end of the document, so the "no machine code" assertion currently inspects the tail rather than the row it names. The change slices on `</li>` as well, so the assertion matches its message. This is a test-accuracy fix, not a behaviour change: the current form is strictly stronger, catching a machine code in any later row, and the new form would miss that. The suite therefore keeps a whole-document negative alongside a row-scoped positive, so neither guarantee is lost.

## Risks / Trade-offs

**[The new check blocks a legitimate catalog edit]** -> A clinical product owner may reasonably want a readiness key that is deliberately not a scoring axis. Mitigation: the check fails closed and names the exact uncovered key and system, so the fix is either to add the contribution group or to document the exemption in the catalog with a comment the check recognises. Shipping the first version without the exemption mechanism is deliberate; it keeps the rule total, and the exemption is a separate decision once someone actually needs it.

**[Duplicated coverage with `verify-eh141-score-required-groups.ts`]** -> Both suites read the same tables. Mitigation: EH-141 validates product-approved group *content*; this one validates a structural *relation*. If a future change makes them overlap, collapsing them is a deliberate follow-up, not a defect in either.

**[The synthetic registry in `verify-score-exclusion-contract.ts` now looks like a production scenario]** -> A future reader may assume the scoreable-but-no-contributors case is reachable today. Mitigation: annotate the fixture to say the opposite, that it deliberately violates the new invariant so the policy's behaviour under violation stays pinned. This is a comment change, not a behaviour change.

**[Scope creep from the smoke assertion fix]** -> Touching a passing suite for cosmetic accuracy can break a green build. Mitigation: the change is assertion-only, verified by running `smoke:eh145` before and after, and by re-running with the old chunking restored to confirm the guarantee it dropped is now covered by the whole-document negative.

**[`docs/05-data/score-required-groups.md` is not a Wiki-mirror page]** -> The Registry documentation gate will report the mirror as unaffected, which can read as skipped work. Mitigation: record it as a verified not-applicable with evidence, following the same shape used in tracking issue #267, not as a pending task.
