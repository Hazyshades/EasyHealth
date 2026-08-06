# Tasks: unstated axes must not behave as stated evidence (#106)

## 1. Reproduction and the static check

- [x] 1.1 Add `scripts/verify-stated-axis-evidence.ts` with the failing assertion
      first: a chemistry row whose `source_text` and `section_context` contain no
      specimen wording must resolve to `partial` with `specimen` among the
      missing axes, even when a concrete `specimen` is supplied on the row.
      Confirm it fails today.
- [x] 1.2 Add the positive cases that must keep working: specimen stated in the
      row's own `source_text`; specimen stated only in `section_context`;
      modifier stated in the label (`Neutrophils, absolute (NEU)` → `absolute`);
      `Direct bilirubin` → `direct`.
- [x] 1.3 Add a document-level auditor to the same script: given a set of
      extracted rows, report every row carrying a concrete axis value absent from
      its own provenance, naming row and axis.
- [x] 1.4 Wire `"test:stated-axis": "tsx scripts/verify-stated-axis-evidence.ts"`.
- [x] 1.5 Add an offline diagnostic that runs the auditor against a real document
      id using service-role credentials, so the check can be pointed at stored
      data without re-extraction. Record the baseline for
      `f0a8d0c2-d950-4463-a5b8-b685a5f8c6a2` (expected today: 44/44 rows carry an
      unstated concrete specimen).

## 2. The stated-evidence predicate

- [x] 2.1 Add a single shared helper that decides whether an axis value is stated
      by a row's captured provenance (`source_text` + `section_context`), with
      the axis-specific lexical forms for specimen (`serum`, `plasma`,
      `whole blood`, `urine`) including the Cyrillic variants already present in
      `inferSpecimen`.
- [x] 2.2 Cover the helper directly: unstated → false; stated in snippet → true;
      stated in section only → true; unknown/default values (`unspecified`,
      `none`) → not applicable.
- [x] 2.3 Keep the helper free of catalog and resolver imports so it can be used
      by both the extraction parser and the input projection.

## 3. Enforce on read (the load-bearing fix)

- [x] 3.1 Apply the predicate in `measurementInputFromExtracted`
      (`src/lib/documents/normalization-review.ts`): drop concrete `specimen`,
      `modifier`, `method` and timing values that are not stated, passing the
      axis as absent instead.
- [x] 3.2 Confirm the projection is the single chokepoint by checking every
      caller — review preview, acceptance/correction writer path, EH-116
      reprocessing — and that none of them constructs
      `MeasurementResolutionInput` independently. Fix any that do.
- [x] 3.3 Run `pnpm test:stated-axis` and confirm it passes.
- [x] 3.4 Re-run the offline diagnostic from 1.5 against
      `f0a8d0c2-…` and record the new outcome distribution
      (baseline: `resolved 27 / partial 17`).
- [x] 3.5 Confirm `Glucose` in that document no longer resolves to
      `glucose_serum`.

## 4. Enforce on write (hygiene)

- [x] 4.1 Add the missing `specimen` instruction to the lab extraction prompt in
      `src/lib/documents/extraction.ts`, mirroring the existing `method` wording,
      and forbid inferring the axis from the analyte label or from prevalence.
- [x] 4.2 Apply the predicate in the extraction parser so an unstated concrete
      axis is stored as the explicit unknown value.
- [x] 4.3 Review `inferSpecimen` (`src/lib/biomarkers/qualitative.ts:90`): its own
      heuristics are already provenance-based, but its `explicit` pass-through is
      the hole. Decide whether the explicit branch keeps its trust or is gated by
      the predicate, and record the decision in a comment.
- [x] 4.4 Bump the extraction `processing_version`.
- [ ] 4.5 Re-extract the sample document and confirm the stored rows carry no
      unstated concrete axis (auditor reports 0).

## 5. Observability (separable — may be dropped without affecting safety)

- [x] 5.1 Add one additive nullable `jsonb` column on
      `document_extracted_biomarkers` recording discarded axis inferences.
      No constraint change, no backfill.
- [x] 5.2 Populate it from the write-time filter. Never read it in the resolver,
      never copy it onto observations, never include it in identity or the
      decision trace.
- [x] 5.3 Add a pgTAP fixture asserting the column is nullable, is not referenced
      by any identity constraint, and that a row with a populated value still
      resolves exactly as one with the column null.
- [x] 5.4 Wire `test:stated-axis-db`.

## 6. Corpus and fixtures

- [x] 6.1 Add the seam check to release evidence: no current extracted row in the
      evidence set may carry a concrete axis absent from its own provenance.
- [x] 6.2 Add the two required regression fixtures — conventional serum analyte
      with no stated specimen expecting `partial` with `specimen` missing, and a
      row whose specimen is stated only by section context expecting the axis
      satisfied.
- [x] 6.3 Audit the existing 52 corpus rows and 9 specimen-bearing fixtures for
      expectations that encode the defect. **Review each individually and record
      the reason; do not bulk-update expected classifications.**
- [x] 6.4 Check the EH-114 glucose database fixture
      (`supabase/tests/eh114_glucose_resolution_persistence.sql`) for inserted
      extracted rows that rely on an unstated specimen, and adjust or annotate.
- [x] 6.5 Bump `MEASUREMENT_NORMALIZATION_VERSION` `5` → `6`. Leave
      `MEASUREMENT_RESOLVER_VERSION` as #105 leaves it.

## 7. Verification

- [x] 7.1 Run `pnpm typecheck`, `pnpm test:stated-axis`, `pnpm test:alias-order`,
      `pnpm test:cbc-regression`, `pnpm test:eh112`, `pnpm test:eh113`,
      `pnpm test:eh106`, `pnpm test:eh116`, `pnpm test:document-review`,
      `pnpm verify:registry`, `pnpm build`.
- [x] 7.2 Note that `pnpm test:eh111` fails on a pre-existing assertion at
      `scripts/verify-eh111-clinical-compatibility.ts:184`; confirm the failure is
      unchanged and do not fix it here.
- [x] 7.3 Diff the candidate corpus report before and after. Record every row
      whose classification changed, with the reason. Expect movement toward
      `partial`; confirm no row gained a concrete identity it did not have.
- [x] 7.4 Run the database fixtures against a local Supabase stack, or record the
      blocker if Docker is unavailable.

## 8. Release with #105

- [ ] 8.1 Confirm #105 is merged first, so alias admission is settled before
      corpus expectations are finalised.
- [ ] 8.2 Run `pnpm check:registry-v2-candidate-corpus` and capture the new
      `candidateInputHash` covering both changes.
- [ ] 8.3 Prepare the seven approval records against that single hash for review —
      generate ids, hashes and notes, and leave the sign-off itself to the named
      owners. Do not synthesise an approval.
- [ ] 8.4 Obtain re-approval from `registry-safety-reviewer` (×1),
      `release-manager` (×1) and `assessment-owner` (×5: ALT serum and the four
      glucose keys), then confirm `launchable: true` with all thresholds at `1.0`.
- [ ] 8.5 Tag `registry-v2.0.0-candidate.2` covering #105 and #106 together.
- [ ] 8.6 Run the EH-116 reprocess dry run, review `regressed_resolution`,
      `identity_changed` and `manual_selection_lost` — regressions are expected
      here by design — and record the counts before any apply.
- [ ] 8.7 Apply only after the dry-run review is signed off.

## 9. QA and closeout

- [x] 9.1 Create `QA/issue-106/checklist.md`. State the expected
      `Matched measurement → More details needed` movement prominently, before any
      test step, so a tester does not report it as a failure.
- [x] 9.2 Record before/after counts for the sample document (baseline
      `resolved 27 / partial 17`, and 44/44 rows carrying an unstated specimen).
- [x] 9.3 Add a check that Health Profile inputs which disappear do so with a
      stated exclusion reason rather than silently.
- [x] 9.4 Add the automated-regression-coverage table mapping each boundary to its
      verifying script or fixture.
- [x] 9.5 Name the non-goals explicitly in the checklist: no panel-implies-
      specimen policy, `modifier: "<"` untouched, no re-extraction of existing
      documents.
- [x] 9.6 File the follow-up issue for the `modifier: "<"` parsing artifact.
      Filed as #108: the comparator is stored as a clinical modifier *and* the
      censoring is lost from the value (`< 0.20` stored as `0.2`). Confirmed on
      8 live rows. #106 rejects the punctuation-only value as a backstop only.
- [ ] 9.7 Update GitHub issue #106 with the evidence and close it via a pull
      request using `Closes #106`.
