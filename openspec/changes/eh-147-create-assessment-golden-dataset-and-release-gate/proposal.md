## Why

Health Profile scoring, readiness, eligibility, provenance, and presentation already ship (EH-141, EH-142, EH-143, EH-145, plus EH-144/EH-146). Issue #47 / EH-147 is the remaining P0 Validation release gate: there is no versioned golden dataset that proves current-state assessments stay stable across representative document-native ranges, units, missing required groups, and post-correction inputs. Without that gate, Health Profile v1 cannot be accepted.

## What Changes

- Add a versioned, synthetic assessment golden fixture pack covering all eight named body systems with committed per-system expected outputs.
- Cover representative in-range and out-of-range document-native reference ranges, SI/US unit presentation, missing and invalid required groups, context-only substitutions, inflammation as factual-only, and `manually_corrected` versus pending correction eligibility.
- Add a pure, fail-closed runner that feeds production Health Profile admission/readiness/score/provenance functions and emits a machine-readable regression report.
- Register the runner as the EH-147 CI release gate (`pnpm test:eh147`) without changing score formulas, Registry bindings, or persistence.
- Record Clinical Product sign-off against a hash of the golden pack; technical CI may pass without that human approval, but the product release check must not claim Health Profile v1 accepted until sign-off exists.
- Add `QA/eh-147/checklist.md` and confirm Registry documentation is unchanged (this change consumes Health Profile laboratory projection; it does not edit catalog data).

## Capabilities

### New Capabilities

- `assessment-golden-dataset`: Versioned synthetic fixtures, per-system expected outputs, boundary coverage, executable regression report, and Health Profile v1 sign-off/release-gate evidence for current-state assessments.

### Modified Capabilities

- None. Existing `health-profile-score-readiness`, `incomplete-laboratory-outcomes`, `score-required-groups`, and score-provenance contracts remain the runtime authority; this change only locks their observable outputs.

## Impact

- **Domain:** `health-profile`.
- **Runtime code:** unchanged scoring/readiness/eligibility APIs in `src/lib/health-systems.ts`, `src/lib/health-profile-input.ts`, and `src/lib/health-profile-assessment-eligibility.ts`.
- **New artifacts:** golden fixtures under `QA/eh-147/`, runner `scripts/verify-eh147-assessment-golden.ts`, `pnpm test:eh147`, CI verify job + `ci/verification-suite-policy.json`, sign-off record, QA checklist.
- **Dependencies:** consumes delivered EH-141 groups, EH-142 eligibility, EH-143 null-score contract, EH-145 provenance, EH-119 `manually_corrected` eligibility, and EH-144 current freshness for scoreable markers.
- **Non-impact:** no migration, no Registry definition/binding edits, no API shape change, no diagnosis or clinical recommendation copy.
- **Documentation gate:** regenerate/check biomarker docs to prove no catalog drift; record Wiki/tracking status. No new clinical policy pages unless the golden index needs a short pointer from `docs/05-data/score-required-groups.md`.
