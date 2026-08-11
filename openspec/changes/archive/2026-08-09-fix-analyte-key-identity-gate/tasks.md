## 1. Resolver: narrow the analyte tier

- [x] 1.1 In `src/lib/biomarkers/measurement-resolution.ts:914-918`, derive the analyte set from `ranked` (`selectable && score !== null`, line 862-864) instead of `candidates`, so a hard-conflicted candidate cannot contribute an analyte. Leave `measurementDefinitionKey` (line 921) untouched.
- [x] 1.2 Bump `MEASUREMENT_RESOLVER_VERSION` from `9` to `10` (`measurement-resolution.ts:42`) and update its doc comment to name this change.
- [x] 1.3 ~~Confirm `digestMeasurementRegistryManifest()` output is unchanged so the approval hash is not invalidated.~~ Half right, and the wrong half was load-bearing. The manifest digest is unchanged (`5341c12e…f7357`, matches the recorded release digest), but `candidateInputHash` covers `resolverVersion`, so the `9` → `10` bump detaches all seven approvals and `launchable` becomes false. Tracked in group 7.

## 2. Database: split the identity guard into two tiers

- [x] 2.1 Add `supabase/migrations/046_incomplete_analyte_identity_gate.sql` that recreates `public.write_observation_normalization_revision_v2_legacy` with `create or replace function`, copying `045` verbatim except the incomplete branch, which becomes `elsif target_definition_key is not null then`.
- [x] 2.2 Verify the `resolved` branch (`045:127-133`) is carried over unchanged: both links required plus `p_reviewed_measurement_definition`.
- [x] 2.3 Verify the migration does not touch the EH-115 wrapper `write_observation_normalization_revision_v2` (`039:232`), its grants, or its signature.
- [x] 2.4 Apply migration `046` to the target environment and confirm the function body reflects the new guard. Applied locally via `supabase db reset` (chain 001→046 clean); `pg_proc.prosrc` now has `or target_analyte_key is not null` at position 0 and `elsif target_definition_key is not null then` present, with `resolved_normalization_requires_concrete_identity` intact and both `write_observation_normalization_revision_v2` / `..._legacy` still at 13 arguments. **The reporter's remote project still needs this deployment.**

## 3. Seam coverage

- [x] 3.1 In `supabase/tests/writer_rpc_seam.sql`, add a case submitting the real `buildNormalizationResolutionPayload` output for a `partial` row carrying an analyte key and no definition key; assert one observation and one revision commit with `analyte_key` set, `measurement_definition_key` null, and `verification_status = 'pending'`.
- [x] 3.2 In the same file, add a negative case: a `partial` payload carrying a measurement definition key still raises `incomplete_normalization_cannot_have_concrete_identity` and commits nothing.
- [x] 3.3 ~~Update `QA-Db_tests/eh111_clinical_compatibility.sql:115-125`, which asserts the one-tier rule.~~ Corrected during implementation: both `throws_ok` payloads there carry a measurement definition key, so they still throw under the two-tier guard and needed no change. The real gap was the missing positive case, added as row `…1134`: a `partial` payload carrying only an analyte key writes atomically, and the projection exposes the analyte with a null definition key.
- [x] 3.4 Confirm both new cases run in CI via `.github/workflows/measurement-registry.yml`.

## 4. Runner and corpus alignment

- [x] 4.1 Re-run `scripts/verify-measurement-registry-runner.ts` and reconcile the corpus against the narrowed analyte derivation; record any row whose analyte key changed from null to a concrete analyte.
- [x] 4.2 Re-run `scripts/verify-eh113-cbc-launch-catalog.ts`, `scripts/verify-observation-provenance-runner.ts`, and `scripts/verify-alias-order-insensitivity.ts`; all existing analyte-tier assertions must still hold.
- [x] 4.3 Re-run `scripts/verify-eh112-incomplete-outcomes.ts` and confirm the read projection still nulls `analyteKey` for a non-ready binding (line 136) — this change must not move that boundary.
- [x] 4.4 ~~Extend the runner with an input whose only second analyte comes from a hard-conflicted candidate, which must now expose the surviving analyte.~~ Corrected during implementation: measurement shows no such input exists — 584 catalog-faithful cases produce zero differences, and the only observable change drops an analyte rather than gaining one. Added the honest regression instead: `urine_glucose` with a numeric value, whose sole candidate `glucose_urine_dipstick` is ordinal-only, stays `partial` with a null analyte key; the paired ordinal case still resolves the analyte. Mutation-checked — the assertion fails without the resolver fix.

## 5. End-to-end verification

- [x] 5.1 ~~Blocked on deploying migration `046`.~~ Migration `046` is now deployed on the reporting project, confirmed by data the old guard made impossible: 26 active revisions with `resolver_result = 'partial'` and a non-null `analyte_key`. Document `e3734113-f20c-46c4-a9f5-a15c944162a4` accepted all 44 of 44 rows, 26 of them carrying analyte-level identity. Document `f1410a30-6b94-49d4-8555-877dd4324f12` still shows the pre-fix split — 18 `accepted`, 26 `needs_review` — matching the original 207 exactly; those 26 are now acceptable and only need the accept action re-run.
- [x] 5.2 Query the resulting revisions and confirm each carries a non-null `analyte_key`, a null `measurement_definition_key`, and `resolver_result` of `partial` or `ambiguous`. Proven against the deployed primitive with the real writer output: `resolveMeasurementDefinition` + `buildNormalizationResolutionPayload` for an ALT row with no printed specimen produced `partial` / `analyte_key = 'alt'` / null definition, and the RPC committed one observation and one active revision with `verification_status = 'pending'` and the projection linked.
- [x] 5.3 Confirm the accepted incomplete rows are still excluded from trends and assessment: `registry_binding_ready` is false and `isAbnormalObservation` (`src/lib/reports.ts:164-166`) skips them. Verified on the committed row shape: `registry_binding_ready = false`, and a value of 28 against a 0–20 range returns `false` from `isAbnormalObservation` while the same value returns `true` when the binding is ready — the exclusion is the binding gate, not the value.
- [x] 5.4 Confirm the API surfaces a null `analyte_key` for those rows, since every read path overwrites the column with the EH-112 projection (`biomarkers/route.ts:122`, `reports/route.ts:190`, `structured-context.ts:247`). Verified: `serializeLaboratoryOutcome` returns `analyte_key: null` for the stored `alt` row because the binding is not ready.

## 6. Documentation and closure

- [x] 6.1 Create `QA/issue-120/checklist.md` with a tester-facing manual section (preconditions, safe test data, numbered actions, observable results) and a separate developer-evidence section for the migration, pgTAP, and corpus assertions.
- [x] 6.2 Run `openspec validate fix-analyte-key-identity-gate --strict` and resolve any finding. (The flag is positional, not `--change`; papercut logged.)
- [x] 6.3 ~~Post delivery evidence to issue #120 and close it.~~ Evidence posted (issue #120, comment `5226756130`). **Left open deliberately:** the migration is not deployed to the reporting environment and the candidate release is not re-signed, so the reported symptom is not yet resolved there. Closing is tasks 5.1 and 7.5.

## 7. Release governance

- [x] 7.1 Capture the new `candidateInputHash` after the resolver-version bump: `1ef42fbeb5152fec2c6c1de51e0a86ff68ed9cfc80c5555d002f87d7d0c08c03`, moved from `f00c0e6f4b0c041c75935186f1d8dee2d7d6f0cefb83dee22739e71bda74efd1`.
- [x] 7.2 Confirm the expected failure shape matches the `#105` precedent: all seven approvals in `registry/candidate-release/v1/approvals.json` report "bound to a different candidate input hash", the seven matching "missing hash-bound …" errors follow, and `launchable` is false.
- [x] 7.3 Confirm nothing clinical moved, so the re-approval is a signature refresh rather than a fresh review: corpus report rows and `thresholdChecks` are byte-identical with and without the resolver change, and `digestMeasurementRegistryManifest()` still equals the recorded release digest.
- [x] 7.4 Seven approval records re-signed against `1ef42fbe…08c03` in `registry/candidate-release/v1/approvals.json`, as `registry-v2.0.0-candidate.3` covering #120. Signed by Project Owner, the named approver on all seven prior records, on explicit instruction. Notes state the substance: the resolver-version bump is the sole cause of the hash move, no catalog entry changed, and the corpus is byte-identical to candidate.2 — a signature refresh, not a fresh clinical review.
- [x] 7.5 `pnpm check:registry-v2-candidate-corpus` → `approvalErrors: []`, `launchable: true`, 53 rows, all 8 threshold checks pass. `pnpm verify:registry` green end to end. Remaining: tag `registry-v2.0.0-candidate.3` on the merge commit once this change is committed.
