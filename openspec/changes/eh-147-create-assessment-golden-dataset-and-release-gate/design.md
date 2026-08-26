## Context

Current-state assessment is already deterministic:

- EH-142 `evaluateAssessmentEligibility` / `projectHealthProfileLaboratoryInput` admit only resolved, reviewed, verified, numeric, document-range-backed observations.
- EH-141 `evaluateSystemScoreReadiness` requires every reviewed group; inflammation is `non_scoreable`.
- `computeSystemStateScore` averages `markerStateScore` over contribution-group selections after readiness passes; otherwise the score is `null`.
- EH-145 provenance explains contributors and exclusions; EH-144 freshness must be `current` for a usable core marker; EH-119 `manually_corrected` is an eligible verification status.

Issue #47 still lacks a single golden pack that Clinical Product can approve and CI can fail closed on. Existing `test:eh141`/`test:eh142`/`test:eh143`/`test:eh145` prove isolated contracts with synthetic unit-less markers; they do not lock representative ranges, SI/US presentation, or correction admission across all eight systems.

Functional owner is QA / Clinical Product. Engineering owns the runner and hash; Clinical Product owns expected-output sign-off.

## Goals / Non-Goals

**Goals:**

- Commit a versioned synthetic fixture pack with per-system expected scoreability, `state_score`, readiness reason codes, and admission outcomes.
- Cover representative document-native ranges (in-range, out-of-range, one-sided), SI and US presentation, missing groups, invalid/missing ranges, context-only substitutions, inflammation factual-only, and pending vs `manually_corrected` eligibility.
- Run production functions only; fail CI on any mismatch.
- Emit a regression report (counts, failed case ids, pack hash).
- Separate technical match (`--technical-check`) from product acceptance (`--check` requires hash-bound Clinical Product sign-off).
- Provide a tester checklist that does not invent a new UI.

**Non-Goals:**

- Changing score formulas, readiness groups, eligibility reasons, Registry definitions, aliases, or assessment bindings.
- Database migrations, pgTAP, or writing observations.
- Diagnoses, disease-risk labels, or treatment advice.
- Replacing EH-141–EH-145 runners.
- Claiming Health Profile v1 accepted without Clinical Product evidence.
- Browser E2E as the primary gate.

## Decisions

### 1. Golden pack is committed JSON, not generated at test time

Store cases under `QA/eh-147/fixtures/` plus a manifest (`pack.json`) listing case files, algorithm version `HEALTH_PROFILE_SCORE_ALGORITHM_VERSION`, and a documented pack version `eh147-golden-v1`. Expected outputs are committed, not recomputed and rewritten during CI.

Alternative rejected: snapshotting live `buildHealthProfile` output into expected files on every run. That cannot detect a scoring regression; it would bless the new behavior.

When a deliberate scoring-policy change ships later, EH-147 expected files and pack hash update in the same change as the formula, with a new Clinical Product sign-off.

### 2. Two evaluation seams, one runner

Each case may include:

- **Admission rows** (EH-142 shaped): verification, resolution, raw_reference_text, value kind. The runner calls `evaluateAssessmentEligibility` and, when eligible, `projectHealthProfileLaboratoryInput`.
- **Profile observations** already admitted (EH-141/143/145 shaped): `buildHealthProfile` / `evaluateSystemScoreReadiness` / `computeSystemStateScore`.

Range/unit/missing-group/inflammation cases use the profile seam with reviewed specimens and catalog keys. Correction and eligibility-boundary cases use the admission seam so pending rows never reach the score.

Alternative rejected: only calling `buildHealthProfile`. That would skip the EH-142 gates the issue names (corrections, unusable ranges).

### 3. Case families required in v1

| Family | Systems | Asserts |
| --- | --- | --- |
| `complete-in-range` | all seven scoreable systems together, plus inflammation CRP | every scoreable system `scoreable` with expected numeric scores; inflammation `non_scoreable` / `null` |
| `complete-out-of-range` | same complete set with values outside document ranges | still scoreable; scores strictly below in-range counterparts |
| `si-us-units` | metabolic (glucose/HbA1c) and at least one lipid or CBC marker with a real unit family | SI vs US `labUnitSystem` changes display unit/value/refs but not scoreability or in/out classification |
| `missing-group` | one case per scoreable system dropping one required group | `incomplete`, `state_score` null, readiness code `missing` |
| `invalid-reference` | at least liver or blood with a required marker present but no usable bounds, and one inverted range at the eligibility seam | profile `invalid`; eligibility `missing_document_reference_range` / `invalid_document_reference_range` |
| `context-only` | metabolic glucose-only; cardiovascular total cholesterol replacing a lipid axis | remains incomplete |
| `alternatives` | metabolic HbA1c instead of fasting glucose; blood hematocrit instead of hemoglobin; kidney creatinine instead of eGFR | scoreable |
| `correction` | same resolved numeric row with `pending` vs `manually_corrected` | pending excluded (`verification_required`); corrected admitted |
| `freshness-current` | complete metabolic with current dates | scoreable only when freshness is `current` (EH-144 consumed, not redefined) |

All values are synthetic. Canonical keys and specimens come from reviewed Registry bindings, not invented aliases.

### 4. Expected output schema is explicit and narrow

Per system, commit:

- `scoreability`
- `state_score` (integer or null)
- readiness reason `code`s in catalog order
- `satisfied_by` keys for satisfied groups when asserting alternatives

Do not commit full provenance blobs or holistic synthesis text. Provenance reason codes for excluded context-only rows MAY be asserted on the complete-in-range case only where EH-145 already defines them.

Overall profile score is asserted when the complete pack is used.

### 5. Hash-bound sign-off, two check modes

Compute a SHA-256 over canonical JSON of the fixture pack (sorted case ids + expected outputs + algorithm version). Store Clinical Product approval in `QA/eh-147/approvals.json` bound to that hash, following the Registry candidate-release pattern at smaller scale.

- `pnpm test:eh147` → `--technical-check`: fixtures match production functions. This is the CI job.
- `pnpm check:eh147` → `--check`: technical match **and** a current Clinical Product approval for the pack hash. Product/release owners run this before calling Health Profile v1 accepted.

CI MUST NOT fail solely because sign-off is pending. The QA checklist and issue comment MUST record `PENDING` until an approver writes the hash-bound record.

### 6. No database test

EH-147 does not persist, migrate, or authorize rows. Database coverage is not applicable; record that in the checklist. Corrections are modeled as eligibility inputs, not EH-119 RPC writes.

### 7. Docs pointer, not a new clinical policy

Add a short "Golden dataset" verification pointer on `docs/05-data/score-required-groups.md` to `pnpm test:eh147`. Do not duplicate the group table. Run biomarker doc generate/check/test; Wiki/tracking issue records confirmation of unchanged catalog pages plus the new pointer if that page is generated or canonical.

## Risks / Trade-offs

- **Clinical Product sign-off is human.** → Technical CI stays unblocked; `--check` and the issue checklist stay honest about `PENDING`.
- **Expected scores encode today's formula.** → Pack version + algorithm version + hash make a later formula change an explicit EH-147 update, not a silent snapshot refresh.
- **Unit cases depend on `presentObservation`.** → Use real reviewed measurement keys and document-native units from the catalog; skip markers without a conversion family.
- **Fixture drift vs Registry binding edits.** → Runner resolves specimens/units from reviewed bindings; a binding change that alters readiness fails EH-141 and EH-147 together.
- **Long reports.** → Machine JSON to stdout/file with fail-closed summary; keep markdown for humans in `QA/eh-147/report.md` generated by `--report` (not required in CI).

## Migration Plan

No runtime migration. Deploy is merge of fixtures + runner + CI step. Rollback is revert of that diff; scoring behavior is unchanged.

## Open Questions

- None blocking implementation. Clinical Product hash-bound approval is a release-owner action after the technical pack exists; it is not an engineering blocker for `test:eh147`.
