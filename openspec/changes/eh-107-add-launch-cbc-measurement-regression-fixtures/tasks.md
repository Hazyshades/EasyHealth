## 1. Fixture Pack

- [x] 1.1 Add CBC regression fixture types (`id`, `family`, input fields, expected classification/key/forbiddenKeys) in a dedicated module under `src/lib/biomarkers/` or `scripts/lib/`.
- [x] 1.2 Author five-part differential absolute vs percent fixtures for neutrophils, lymphocytes, monocytes, eosinophils, and basophils, including exact sample forms (`NEU%`, `LYMF%`, `MON%`, `EOS%`, `BAS%`) and antipair `forbiddenKeys`.
- [x] 1.3 Author RDW-CV vs RDW-SD positive pairs, bare/generic RDW non-concrete cases, and cross-variant `forbiddenKeys`.
- [x] 1.4 Author synthetic reticulocyte absolute vs percent fixtures with unit-driven antipair guards.
- [x] 1.5 Author exact-label fixtures for RBC, HGB, HCT, MCV, MCH, and MCHC using launch-sample printed forms (including `Hemoglobin (HGB)`).
- [x] 1.6 Author platelet family fixtures for platelets, MPV, PDW, and plateletcrit with sample labels/units.
- [x] 1.7 Author segmented, band, and manual differential variant fixtures that forbid collapse into the wrong total/automated concrete keys.
- [x] 1.8 Author compatible and invalid unit fixtures (percent vs cell-count and other dimension mismatches) with hard non-resolution or non-wrong-key expectations.
- [x] 1.9 Tag every fixture with a checklist `family` and assert the pack covers all EH-107 families before per-row evaluation.

## 2. Pure Runner and Assertions

- [x] 2.1 Implement a pure CBC suite evaluator that calls `resolveMeasurementDefinition` (or the shared Registry 2.0 resolver entrypoint) and compares actual classification/key against fixture expectations.
- [x] 2.2 Fail any fixture that returns a concrete key when none is allowed, a non-matching pinned key, or any key in `forbiddenKeys`.
- [x] 2.3 Add `scripts/verify-cbc-measurement-regression-runner.ts` (name may match repo verify-* convention) that runs the pack twice for determinism and prints a clear pass/fail summary.
- [x] 2.4 Statically assert the evaluator/runner does not import acceptance, promotion, Supabase, or other mutation/writer modules.
- [x] 2.5 Capture and review initial expected outcomes against the current resolver; apply only minimal identity fixes if an antipair already collapses, without promoting new reviewed CBC catalog definitions.

## 3. CI and Local Verify Integration

- [x] 3.1 Wire the CBC regression runner into `.github/workflows/measurement-registry.yml` (or the active registry verification workflow).
- [x] 3.2 Expose the runner through the same local package/script entrypoints used for other registry verify runners, if applicable.
- [x] 3.3 Confirm the EH-106 candidate corpus runner still passes unchanged after CBC suite addition.

## 4. QA Evidence and Issue Alignment

- [x] 4.1 Create `QA/eh-107/checklist.md` with preconditions, developer-evidence commands, fixture-family coverage list, and an explicit note that there is no new user-facing UI to manual-test.
- [x] 4.2 Record that the CBC regression suite is complementary to the 44-row candidate corpus and is required for the EH-107 release gate.
- [x] 4.3 Verify issue #7 checklist families are each evidenced by at least one passing fixture in the suite output or QA notes.
