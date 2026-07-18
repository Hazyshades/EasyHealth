## Context

The current implementation provides structured units, aliases, resolver evidence, confidence bands, append-only normalization revisions, manual correction, and deterministic registry manifests. Those mechanisms are still required. What changed is the rollout boundary: EasyHealth has no production Registry v1 dataset or compatibility contract, and EH-102 now proposes one Registry 2.0 launch runtime with broad reviewed/provisional coverage.

## Goals / Non-Goals

**Goals:**

- Preserve deterministic unit, evidence, confidence, correction, and release governance.
- Measure readiness on representative raw laboratory rows and negative fixtures.
- Prevent false resolution and unreviewed assessment impact.
- Keep manual decisions durable during reprocessing.
- Make release approval reproducible from manifest diff and corpus results.

**Non-Goals:**

- Compare against Registry v1 as a production oracle.
- Preserve a permanent Registry v1/v2 feature flag or legacy rollback branch.
- Change assessment formulas, diagnosis policy, or external reference ranges.
- Treat LOINC/common-code frequency as automatic clinical approval.

## Decisions

### 1. Keep explicit unit ontology

Raw unit text, normalized unit, dimension, definition canonical unit, and conversion policy remain distinct. Unit spelling normalization occurs before resolver selection; numeric conversion occurs only after one compatible concrete definition is selected. Partial recognition never performs a definition-specific conversion.

### 2. Keep structured aliases and evidence

Aliases retain source, normalized value, match type, locale/laboratory when known, status, and fixture provenance. Resolver candidates record stable accepted/rejected evidence for label, unit, specimen, timing, method, section, neighbour, reference, and manual inputs. Weak context cannot override hard conflicts.

### 3. Keep extraction and mapping confidence independent

Extraction confidence describes source capture. Mapping confidence is derived from versioned semantic evidence. Resolver state and evidence are authoritative; a numeric score is never a clinical probability and cannot independently authorize activation.

### 4. Align promotion with launch maturity

Automatic activation requires:

- `resolved` state and one reviewed active concrete definition;
- no hard unit, value-kind, specimen, timing, or method conflict;
- deterministic output for the recorded releases;
- an approved mapping classification;
- no active manual decision being replaced;
- reviewed assessment binding for any assessment impact;
- passing launch-corpus gates for the affected definition/family.

Provisional, partial, ambiguous, unmapped, review-required, and breaking outcomes remain raw/candidate data for review.

### 5. Keep manual corrections append-only

Manual verification, correction, and undo create revisions. Reprocessing may append a better candidate but never silently replaces an active user-verified or manually-corrected decision. Standard correction choices respect hard source evidence; an unstated specimen is not offered as an ordinary required choice.

### 6. Publish complete deterministic releases

The canonical manifest covers analytes, definitions, maturity, aliases, unit policies, identity axes, source provenance, assessment bindings, and fixture coverage. Every change is classified additive, review-required, or breaking. Release evidence includes changed records and corpus results.

### 7. Replace legacy shadow mode with corpus runs

A corpus run executes extraction fixtures and/or stored de-identified extracted rows against a candidate registry/resolver without changing active observations. It reports:

- raw-preservation failures;
- analyte recognition, resolved, partial, ambiguous, and unmapped rates;
- false concrete resolution found by negative fixtures or sampled review;
- alias and unit coverage;
- manual correction and disagreement rates;
- processing errors;
- assessment-input additions/removals/changes;
- results segmented by panel, definition family, language, laboratory, specimen evidence, and value kind when available.

The supplied 44-row sample is mandatory but not sufficient alone. Additional de-identified documents must represent target launch laboratories, languages, and common panels.

### 8. Use gates instead of a fallback runtime

Promotion or launch is blocked when required thresholds or approval are missing. The safety mechanism is evidence before release plus append-only correction after release, not a second live registry. Before production, rollback is a coordinated code/database reset; after launch, registry releases remain forward-versioned and reversible through reviewed release history.

## Risks / Trade-offs

- [Corpus overfits one PDF] -> Require category/language/laboratory segmentation and add new failures as permanent fixtures.
- [High recognition hides false resolution] -> Track false concrete resolution separately and treat it as a blocking safety metric.
- [Provisional breadth inflates coverage] -> Report maturity and concrete resolution separately.
- [Removing feature flag increases cutover size] -> Complete migration and gates before production, when reset remains cheap.
- [Manual corrections accumulate] -> Feed correction patterns into reviewed alias/definition changes without auto-generalizing them.

## Migration Plan

1. Reconcile existing governance types with EH-102 maturity, partial state, nullable semantic identity, and assessment bindings.
2. Remove legacy identity from manifest, promotion rules, telemetry, and UI wording.
3. Convert shadow telemetry into non-mutating launch-corpus run output.
4. Add sample PDF fixtures and negative missing-context fixtures.
5. Define approval owners and numerical gates from representative corpus results.
6. Run full registry, resolver, observation, review, trends, assessment, type, and build verification before the first launch manifest is approved.

## Open Questions

- Minimum representative corpus size and laboratory/language distribution for closed beta.
- Clinical/product owner for approving score-affecting bindings and provisional-to-reviewed promotion.
- Whether numeric mapping confidence remains public API or is eventually replaced by state, band, and evidence.
