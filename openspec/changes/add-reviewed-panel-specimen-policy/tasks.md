# Tasks: reviewed panel specimen policy

Depends on #106 (`fix-inferred-specimen-as-stated-evidence`) being in place: the
stated-evidence filter must run before a policy can supply anything.

## 1. Failing harness first

- [x] 1.1 Add `scripts/verify-panel-specimen-policy.ts` asserting the target
      behaviour before any of it exists: a haemoglobin row with unit `g/L`, no
      stated specimen, and captured heading
      `Complete blood count with manual smear microscopy + ESR` resolves to
      `hemoglobin_whole_blood` with `specimen_from_reviewed_panel` in its
      accepted evidence. Confirm it fails.
- [x] 1.2 Add the two negative fixtures that must never pass: a glucose row under
      the same heading stays `partial` with `specimen` missing and selects no
      whole-blood glucose definition; an hba1c row under the same heading behaves
      the same way.
- [x] 1.3 Add the boundary fixtures: unrecognised heading yields no policy;
      absent heading yields no policy; a row that states its own specimen keeps
      the stated code and is not overridden by a differing policy.
- [x] 1.4 Add the ordering fixture: a row where the extraction model supplied
      `serum` under a CBC heading must end up with `whole_blood` from the policy,
      never `serum`.
- [x] 1.5 Wire `"test:panel-specimen": "tsx scripts/verify-panel-specimen-policy.ts"`.

## 2. Policy as a catalog entity

- [x] 2.1 Add the `PanelSpecimenPolicy` type and a `PANEL_SPECIMEN_POLICIES`
      collection in `src/lib/biomarkers/`, exported through the biomarkers index.
- [x] 2.2 Declare the single launch policy `cbc_whole_blood`: heading forms
      `complete blood count`, `cbc`, `full blood count`, `fbc`, plus the Cyrillic
      `общий анализ крови` and `оак`; specimen `whole_blood`; maturity
      `reviewed`; a review reference.
- [x] 2.3 Declare its `appliesToAnalytes` allowlist of the 18 CBC constituents
      (`basophils`, `eosinophils`, `hematocrit`, `hemoglobin`, `lymphocytes`,
      `mch`, `mchc`, `mcv`, `monocytes`, `mpv`, `neutrophils`, `pdw`,
      `plateletcrit`, `platelets`, `rbc`, `red_cell_distribution_width`,
      `reticulocytes`, `wbc`). Add an inline comment recording that `glucose` and
      `hba1c` are excluded deliberately because both have reviewed whole-blood
      definitions and both affect scoring.
- [x] 2.4 Add policies to `serializeMeasurementRegistryManifest` so the manifest
      digest covers them. Verify the digest changes when a policy is edited and
      does not change when unrelated code moves.
- [x] 2.5 Add catalog validation: a policy must be `reviewed` to apply, its
      analytes must all exist, its heading forms must be non-empty and unique
      across policies, and two reviewed policies must not both match one heading
      form. Wire into `validateMeasurementRegistry` so `verify:registry` gates it.

## 3. Specimen provenance through the resolver

- [x] 3.1 Extend `MeasurementResolutionInput` with
      `specimenSource: "stated" | "reviewed_panel_policy" | null`.
- [x] 3.2 Add `specimen_from_reviewed_panel` to `ResolutionReasonCode`.
- [x] 3.3 Teach `evaluateSpecimenCompatibility` to emit
      `specimen_from_reviewed_panel` at weight 8 when the source is the policy,
      and keep `specimen_compatible` at weight 10 for a stated specimen. Both
      clear the missing-axis set.
- [x] 3.4 **Verify weight 8 across the whole CBC set**, not just the two worked
      examples in the design. If any CBC constituent falls below the bar of 55
      with a policy-derived specimen, record the measured scores and revisit the
      figure before continuing.
- [x] 3.5 Add `specimen_from_reviewed_panel: true` to `TRACE_REASON_CODES`.

## 4. Applying the policy after the filter

- [x] 4.1 Add the lookup: given a captured heading and a candidate analyte,
      return the matching reviewed policy or nothing. Normalize headings through
      the same token pipeline the aliases use; no regular expressions.
- [x] 4.2 Apply the lookup in both row-to-input builders — `measurementInputFromExtracted`
      and `measurementInputFromWriterRow` — **after** the #106 stated-evidence
      filter, and only where the filter left the specimen absent.
- [x] 4.3 Assert by test that the policy can never preserve a model-supplied
      value: the filter runs unconditionally first.
- [x] 4.4 Confirm a stated specimen is never overridden by a differing policy.
- [x] 4.5 Run `pnpm test:panel-specimen` and confirm it passes.

## 5. Capturing the heading

- [x] 5.1 Add the section-heading field to the lab extraction contract in
      `src/lib/documents/extraction.ts`, instructing the model to transcribe the
      heading exactly as printed and explicitly not to classify it.
- [x] 5.2 Parse and store it, replacing the literal `null` at
      `worker/src/pipeline.ts:460`.
- [x] 5.3 Confirm the existing instruction forbidding an inferred specimen is
      still present and unweakened.
- [x] 5.4 Extend the #106 audit script to also report captured headings that
      match no reviewed policy, with affected row counts, so under-coverage is
      measurable.
- [x] 5.5 Add a check that a stored heading occurs in the page text for that
      row's page, using `document_pages.ocr_text`, so a paraphrased or fabricated
      heading is detectable.
- [x] 5.6 Bump the extraction `processing_version`.

## 6. Trace and database

- [x] 6.1 Add a migration widening `eh115_validate_resolver_decision_trace` with
      `specimen_from_reviewed_panel`, changing nothing else in the function.
- [x] 6.2 Add a pgTAP fixture: a trace carrying the new code is accepted; a trace
      written before the policy existed still validates; an unknown code is still
      rejected.
- [x] 6.3 Wire the fixture into the Measurement Registry `database` job.

## 7. Corpus, fixtures and governance

- [x] 7.1 Add the positive corpus row: haematology analyte under a matching
      heading, expecting `resolved` with the policy evidence code.
- [x] 7.2 Add the negative corpus rows: glucose under a CBC heading expecting
      `partial`; a haematology analyte under an unrecognised heading expecting
      `partial`.
- [x] 7.3 Add `panelSpecimenPolicyOwners` to
      `registry/candidate-release/v1/policy.json` mapping `cbc_whole_blood` to
      `assessment-owner`.
- [x] 7.4 Extend candidate validation so a reviewed policy without a hash-bound
      approval blocks launchability, and so the approval record enumerates the
      seven score-affecting keys the policy can reach.
- [x] 7.5 Re-audit the existing 52 corpus rows for expectations that this change
      alters. Review each individually and record the reason; do not bulk-update.

## 8. Verification

- [x] 8.1 Run `pnpm typecheck`, `pnpm test:panel-specimen`, `pnpm test:stated-axis`,
      `pnpm test:alias-order`, `pnpm test:cbc-regression`, `pnpm test:eh112`,
      `pnpm test:eh113`, `pnpm test:eh106`, `pnpm test:eh116`,
      `pnpm test:document-review`, `pnpm verify:registry`, `pnpm build`.
- [x] 8.2 Note that `pnpm test:eh111` fails on a pre-existing assertion at
      `scripts/verify-eh111-clinical-compatibility.ts:184`; confirm unchanged and
      do not fix it here.
- [x] 8.3 Run the database fixtures against the local Supabase stack.
      `supabase test db --local` cannot connect from this worktree CLI
      (`LegacyDbConnectError`), so the same pgTAP file was applied through the
      running `supabase_db_easyhealth` container: all three assertions passed.
- [x] 8.4 Diff the candidate corpus report before and after; record every changed
      classification with its reason.
- [x] 8.5 Re-extract `sample_lab_report_english_mock.pdf` and record the measured
      outcome. Expected direction: the 28 CBC rows regain concrete identity, the
      16 biochemistry rows stay `partial`.
      Live worker `gpt-4o-mini` (doc `dfb04cd2-d9b5-429e-963a-1eea8ce107c5`): 16
      biochemistry/serology rows, 0 CBC, all `section_context` null.
      Layout-text + `gpt-4o` probe: 27 CBC rows resolved via
      `specimen_from_reviewed_panel`; ESR stayed partial (not on the 18-analyte
      allowlist); biochemistry stayed unmatched for specimen; glucose stayed
      partial.

## 9. Release with #105 and #106

- [x] 9.1 Confirm #105 and #106 are merged first.
      Both are on `origin/master` (`d8d2e52` / `fd1ecd5`). `registry-v2.0.0-candidate.2`
      already exists for those two changes, so this policy must not reuse that tag.
- [x] 9.2 Run `pnpm check:registry-v2-candidate-corpus` and capture the single
      candidate input hash covering all three changes.
      `candidateInputHash`=`f5e7bdcd97c6df589d77626811968af095e26972547e9090b5aa88c28ed63807`.
- [x] 9.3 Reissued the prior hash-bound approvals onto `f5e7bdcd…` and added
      `assessment-cbc-whole-blood-panel-policy-review-2026-08-29`
      (`scope: panel_specimen_policy`, `bindingKey: cbc_whole_blood`) after
      Project Owner sign-off. `approvals.json` is not a hashed input.
- [x] 9.4 Full gate `pnpm check:registry-v2-candidate-corpus`: `launchable: true`,
      75/75, `falseConcreteResolutions: 0`, `approvalErrors: []`.
- [ ] 9.5 Tag the next unused registry-v2 candidate covering this change **after
      merge to master**. Do not reuse `registry-v2.0.0-candidate.2`.
      `candidate.3` and `candidate.4` already exist; propose `registry-v2.0.0-candidate.5`.
- [x] 9.6 Run the EH-116 reprocess dry run and review the diff before any apply.
      Note that reprocessing alone will not restore CBC rows on existing
      documents, because it does not re-run extraction.
      Dry run on the live mini extract (batch `0bc8f74c-c65e-41e8-859d-572e419686e7`):
      16 candidates, 0 improved, 16 `needsReview`. No apply.

## 10. Existing documents (optional, ordered last)

- [x] 10.1 Decide between re-extraction and the deterministic backfill described
      in the design. Record the decision.
      Decision: re-extraction (design §7). No heading-heuristic backfill.
- [x] 10.2 If backfilling: locate each row's `source_text` within
      `document_pages.ocr_text` and take the nearest preceding heading; add
      fixtures for the heuristic before running it on real data.
      Skipped: not backfilling.
- [ ] 10.3 Verify on `f0a8d0c2-d950-4463-a5b8-b685a5f8c6a2` that the chosen path
      restores the CBC rows and leaves the biochemistry rows `partial`.
      Blocked on this local stack: that document id did not survive the fresh
      `supabase start`. Closest substitute is `dfb04cd2-d9b5-429e-963a-1eea8ce107c5`.

## 11. QA and closeout

- [x] 11.1 Create `QA/panel-specimen-policy/checklist.md`. State plainly that the
      reviewer is asked nothing new, and that the visible change is CBC results
      returning to **Matched measurement**.
- [x] 11.2 Record before/after counts for the sample document.
- [x] 11.3 Add the automated-regression-coverage table.
- [x] 11.4 Name the non-goals: no `Biochemistry ⇒ serum`, no LLM specimen
      citation, no per-row user override, no UI for editing policies.
- [x] 11.5 Record the residual risk: heading wording varies by laboratory, and an
      uncovered heading degrades silently to `partial` — mitigated only by the
      coverage report from 5.4.
