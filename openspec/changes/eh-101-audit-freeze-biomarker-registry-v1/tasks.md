## 1. Baseline Generator

- [x] 1.1 Add a typed Registry v1 baseline builder that reads `BIOMARKER_DEFINITIONS`, converts the effective `ALIAS_MAP` to sorted serializable entries, and does not alter either runtime source.
- [x] 1.2 Add canonical serialization that sorts semantic set-like content, excludes volatile fields, and produces deterministic SHA-256 digests.
- [x] 1.3 Add explicit `generate` and read-only `check` entry points with package scripts and clear mismatch diagnostics.
- [x] 1.4 Add generator self-tests proving identical inputs produce identical bytes/digests and changes to catalog or resolver content change the appropriate digest.

## 2. Registry and Resolver Artifacts

- [x] 2.1 Generate `docs/biomarker-registry/v1.0.0/registry.json` with every canonical definition and all compatibility metadata required by the spec.
- [x] 2.2 Generate deterministic alias ownership and effective-resolution inventories, including canonical-key precedence and all normalized multi-owner source aliases.
- [x] 2.3 Define and generate `resolver-cases.json` for canonical/EN/RU aliases, collisions, `Na` versus missing tokens, short chemistry symbols, name fallback, empty/unknown input, and Registry 2.0 decomposition risks.
- [x] 2.4 Generate `manifest.json` with snapshot schema version, registry version, source-file inventory, per-artifact digests, definition counts by system, alias counts, collision counts, specimen/conversion counts, equivalence groups, and derived-marker counts.
- [x] 2.5 Verify every current v1 key appears exactly once and the generated baseline reproduces the observed 113-definition catalog without hardcoding that count as future runtime behavior.

## 3. Audit Review

- [x] 3.1 Create `AUDIT.md` with scope, methodology, source inventory, current catalog summary, and a clear statement that this is a retrospective legacy compatibility baseline alongside Registry 2.0.
- [x] 3.2 Document each normalized alias collision with owners, effective v1 winner, risk classification, and later roadmap owner where known.
- [x] 3.3 Audit short/contextual aliases, blocked/missing tokens, first-registration and canonical-key precedence, OCR/name fallback, and unknown-token behavior without correcting them.
- [x] 3.4 Audit specimen policies by distinguishing explicit policies, intentionally generic definitions, metadata gaps, and specimen-sensitive breaking risks.
- [x] 3.5 Audit conversion policies by distinguishing linear/equal/formula rules, explicit `none` policies, and absent conversions; record follow-up requirements without adding new medical conversion logic.
- [x] 3.6 Inventory equivalence groups and derived markers, explicitly preserving BUN/urea as the current equivalence group and documenting distinct measurement families that must not be collapsed.
- [x] 3.7 Document Registry 2.0 breaking risks for differential absolute/percent values, RDW-CV/RDW-SD, reticulocytes, glucose specimen variants, fasting context, and free/total thyroid measurements.
- [x] 3.8 Assign stable finding IDs and approved classifications so manifest summary counts can be checked against the reviewed audit.

## 4. Drift Protection and Verification

- [x] 4.1 Add Registry v1 baseline check mode to the existing measurement-registry CI workflow and scope its triggers to relevant catalog, normalization, generator, and baseline paths.
- [x] 4.2 Add tests that fail for an omitted/duplicate canonical key, direct `Map` serialization loss, changed effective alias outcome, stale audit summary, and non-deterministic output.
- [x] 4.3 Run baseline generation twice and verify byte-for-byte stability plus matching manifest digests.
- [x] 4.4 Run TypeScript type-check, existing biomarker verification, existing Registry 2.0 verification, and strict OpenSpec validation.
- [x] 4.5 Confirm the implementation changes no runtime catalog/resolver outputs, database state, API contracts, score policy, or Registry 2.0 promotion behavior.

## 5. Release Handoff

- [x] 5.1 Document the baseline release procedure, tag annotation text, clean-worktree requirement, verification commands, rollback boundary, and immutability policy.
- [x] 5.2 Review and record the final artifact digests and audit summary in the release handoff.
- [x] 5.3 Commit the complete verified EH-101 baseline so the snapshot, audit, tooling, and CI check share one traceable repository revision.
- [x] 5.4 Create and verify the annotated `registry-v1.0.0` tag on that clean baseline commit; pushing the tag requires the repository release owner's explicit action.
