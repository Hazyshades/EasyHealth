## Why

The Registry 2.0 resolver already preserves four outcomes and candidate evidence, but it scores by counting accepted facts, evaluates only a subset of available evidence, and derives confidence solely from the final outcome. It needs a deterministic evidence policy after EH-110 freezes the alias authority contract so that it can resolve concrete laboratory identities without encoding ad-hoc string matching or silently ignoring conflicts.

## What Changes

- Consume EH-110 alias admissions as the sole label-evidence authority and distinguish reviewed-resolution candidates from provisional recognition candidates.
- Define a typed evidence matrix for alias/label, unit, specimen, modifier, timing, method, section/panel context, neighbouring rows, reference-range shape, and value kind.
- Classify evidence as support, missing, or hard conflict; make value-kind incompatibility, incompatible unit, contradictory specimen, timing, method, and modifier explicit conflicts rather than missing axes.
- Replace acceptance-count scoring with documented deterministic weights, candidate eligibility gates, confidence calibration, winner margin, and stable candidate-key tie ordering.
- Preserve the four resolver results (`resolved`, `ambiguous`, `partial`, `unmapped`) with a complete outcome matrix for reviewed/provisional candidates, missing identity axes, hard conflicts, and no admissions.
- Persist the selected decision, candidate evidence, conflict/missing-axis detail, alias admission provenance, resolver version, and evidence-policy version through the existing normalization writer and active-revision DTO without treating incomplete records as verified.
- Add pure resolver and persistence regressions covering context evidence, reviewed/provisional behavior, deterministic ties, confidence derivation, and incomplete outcomes.

## Capabilities

### New Capabilities
- `measurement-resolution-evidence`: Defines authoritative evidence evaluation, deterministic candidate selection, four-state outcomes, confidence, and revision-persistence behavior for Registry 2.0 laboratory resolution.

### Modified Capabilities
- None. The repository has no main capability specs; this change establishes the first resolver-evidence capability specification.

## Impact

- **Domain:** documents — extracted laboratory-result normalization, active revision persistence, and observation DTOs.
- **Code:** `src/lib/biomarkers/types.ts`, `measurement-resolution.ts`, normalization writer services, observation revision schema/DTO mapping, document reader tests, and resolver regressions.
- **Dependencies:** EH-110 alias authority and lifecycle contract is a required implementation predecessor; EH-102/EH-104/EH-105 provide the Registry 2.0 model, four outcomes, and atomic active-revision writer.
- **Downstream handoff:** EH-111 supplies detailed unit/value/specimen compatibility rules; EH-112 consumes the persisted incomplete-state contract.
- **Breaking:** the old score-as-evidence-count and outcome-only confidence assumptions are removed; consumers must use the persisted evidence-policy output.