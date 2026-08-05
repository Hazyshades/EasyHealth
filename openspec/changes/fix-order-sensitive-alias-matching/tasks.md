# Tasks: fix order-sensitive alias matching (#105)

## 1. Reproduction harness first

- [x] 1.1 Add `scripts/verify-alias-order-insensitivity.ts` with the failing fixtures
      before any production change: assert that `Alanine aminotransferase (ALT)`
      and `ALT (alanine aminotransferase)` produce the same outcome, candidate
      key set, missing axes and conflict codes. Confirm the script fails today.
- [x] 1.2 Extend it to cover all 12 affected launch labels (ALT, AST, ASO, HGB,
      HCT, PLT, PCT, NEU%, LYMF%, MON%, EOS%, BAS%) in both orderings, driven
      from the printed labels of `lab_data/sample_lab_report_english_mock.pdf`.
- [x] 1.3 Add the negative fixture that must keep failing to match:
      `neutrophils_absolute_neu` against `neutrophils_neu` (token containment,
      not permutation) MUST NOT be admitted.
- [x] 1.4 Add a single-token fixture proving `token_set` admits nothing that
      `normalized` did not already admit.
- [x] 1.5 Wire `"test:alias-order": "tsx scripts/verify-alias-order-insensitivity.ts"`
      into `package.json`, next to the other `test:*` entries.

## 2. Token-set projection

- [x] 2.1 Add a `tokenSetKey(normalizedToken: string): string | null` helper to
      `src/lib/biomarkers/normalize.ts` that splits the snake-case token, drops
      empties, de-duplicates, sorts, and returns `null` for fewer than two
      distinct tokens.
- [x] 2.2 Add `"token_set"` to `AliasMatchType` in `src/lib/biomarkers/types.ts`.
- [x] 2.3 Add `"alias_token_set_match"` to `ResolutionReasonCode` in
      `src/lib/biomarkers/types.ts`.
- [x] 2.4 Build a module-init `TOKEN_SET_INDEX: Map<string, AliasDefinition[]>`
      in `src/lib/biomarkers/measurement-resolution.ts`, populated only from
      aliases whose authored `matchType` is `exact` or `normalized` and whose
      projection yields at least two tokens.
- [x] 2.5 Verify no field was added to `AliasDefinition` and that
      `MEASUREMENT_CATALOG_MANIFEST_DIGEST` is byte-identical before and after
      this task group.

## 3. Admission

- [x] 3.1 Refactor `aliasMatches` (`measurement-resolution.ts:546`) into
      `matchAliasMode(...) : AliasMatchType | null`, preserving the existing
      evaluation order so `exact` and `normalized` still win when they fire.
- [x] 3.2 Add the `token_set` branch, consulted only after every ordered mode
      has declined, comparing `tokenSetKey` for **set equality** — never
      containment.
- [x] 3.3 Update `findAliasAdmissions` (`:553`) to build `MatchedAlias` with the
      mode that actually fired, while inheriting the source alias's `key`,
      `matchAuthority`, `approvalStatus`, `lifecycle` and `provenance` unchanged.
- [x] 3.4 Map `token_set` to `["alias_token_set_match", 32]` in
      `candidateEvidence` (`:689-696`), between `alias_normalized_match` (36)
      and `alias_ocr_variant_match` (28).
- [x] 3.5 Confirm the laboratory-scope guard and the `lifecycle !== "active"`
      guard still short-circuit before any token-set evaluation.
- [x] 3.6 Run `pnpm test:alias-order` and confirm it now passes.

## 4. Collision invariant

- [x] 4.1 Add a static check that no two distinct **reviewed** measurement
      definitions expose the same token-set projection through an
      admission-eligible alias; on violation, fail and name both definition keys.
- [x] 4.2 Assert that a reviewed/recognition-only collision is permitted and
      does not fail the build.
- [x] 4.3 Wire the check into the `verify:registry` chain so it gates every
      future catalog edit.
- [x] 4.4 Run it against the current catalog and record the result; if a genuine
      collision exists today, stop and resolve it before continuing.

## 5. Decision trace and versions

- [x] 5.1 Add `alias_token_set_match: true` to `TRACE_REASON_CODES`
      (`measurement-resolution.ts:877`).
- [x] 5.2 Add migration `supabase/migrations/042_alias_token_set_trace_code.sql`
      redefining `eh115_validate_resolver_decision_trace` with
      `alias_token_set_match` appended to the evidence-code allowlist, changing
      nothing else in the function.
- [x] 5.3 Add a pgTAP fixture asserting a trace containing the new code is
      accepted, a trace persisted under the old allowlist still validates, and
      an unknown code is still rejected with `invalid_resolver_decision_trace`.
- [x] 5.4 Bump `MEASUREMENT_RESOLVER_VERSION` from `"8"` to `"9"`; leave
      `MEASUREMENT_CATALOG_MANIFEST_VERSION` and
      `MEASUREMENT_NORMALIZATION_VERSION` untouched.
- [x] 5.5 Run `classifyMeasurementDefinitionChange` over the release and record
      the classification in the QA checklist.

## 6. Release governance

- [x] 6.1 Run `pnpm check:registry-v2-candidate-corpus` and capture the new
      `candidateInputHash`.
- [x] 6.2 Confirm the expected failure: all seven approvals in
      `registry/candidate-release/v1/approvals.json` report
      "bound to a different candidate input hash", and the manifest is not
      launchable.
- [ ] 6.3 Obtain re-approval from each named owner against the new hash
      (`registry-safety-reviewer` ×1, `release-manager` ×1, `assessment-owner`
      ×5 for `alt_serum_catalytic_activity`, `glucose_serum`, `glucose_plasma`,
      `glucose_whole_blood`, `fasting_glucose`) and record them as new approval
      entries. Do not edit or carry forward existing entries.
- [ ] 6.4 Re-run the corpus check and confirm `launchable: true` with all
      thresholds at `1.0`, the 52-row count unchanged, and
      `maxFalseConcreteResolutions: 0` still satisfied.
- [ ] 6.5 Prepare the `registry-v2.0.0-candidate.2` annotated tag on the
      verified release commit; do not move `registry-v2.0.0-candidate.1`.

## 7. Regression and verification

- [x] 7.1 Confirm no label that previously produced `resolved` changed its
      selected `measurementDefinitionKey`, by diffing the candidate corpus
      report before and after.
- [x] 7.2 Run `pnpm test:cbc-regression`, `pnpm test:eh112`, `pnpm test:eh113`,
      `pnpm test:eh111`, `pnpm test:eh106` and `pnpm verify:registry`.
      Note: `test:eh111` currently fails on an unrelated pre-existing assertion
      at `scripts/verify-eh111-clinical-compatibility.ts:184` — confirm the
      failure is unchanged, do not fix it here.
- [x] 7.3 Run `pnpm typecheck` and `pnpm build`.
- [x] 7.4 Wire the database fixtures into CI: `test:alias-order-db` added to the
      Measurement Registry workflow's `database` job. Local execution remains
      blocked because Docker is unavailable in this environment, so the fixture
      is first executed by CI on this pull request.

## 8. Reprocessing and rollout

- [ ] 8.1 Run `pnpm reprocess:batch --document <sample doc id> --dry-run` and
      record the diff classification counts.
- [ ] 8.2 Review the dry-run diff for `regressed_resolution`,
      `identity_changed` and `manual_selection_lost`; withhold apply until each
      such row is explicitly reviewed.
- [ ] 8.3 Run the global dry run
      (`EH116_CONFIRM_GLOBAL=yes pnpm reprocess:batch --global --dry-run`) and
      record its counts as release evidence.
- [ ] 8.4 Apply only after the dry-run review is signed off, then verify a
      previously `unmapped` ALT row now reports the same outcome as the printed
      ordering.

## 9. QA and closeout

- [x] 9.1 Create `QA/issue-105/checklist.md` with tester-facing preconditions, the
      synthetic test document, numbered UI actions and observable expected
      results, plus a separate developer-evidence section. State the expected
      direction of movement explicitly: rows move out of
      **Measurement not recognized** into **More details needed** or
      **Multiple possible matches**, and this is the intended outcome, not a
      regression.
- [x] 9.2 Record before/after counts for
      `lab_data/sample_lab_report_english_mock.pdf` in the checklist
      (baseline: `42 results · 20 matched · 22 incomplete`).
- [x] 9.3 Add an automated-regression-coverage table mapping each boundary in
      this change to its verifying script or fixture.
- [x] 9.4 Note the deliberate non-goals in the checklist: no bounding-box
      overlay, no catalog growth, `proposedKey` still unused.
- [ ] 9.5 Update GitHub issue #105 with the evidence and close it via a pull
      request using `Closes #105`.
