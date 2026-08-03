## Context

Registry 2.0 already exposes deterministic `resolved`, `ambiguous`, `partial`, and `unmapped` outcomes. Its current resolver generates candidates by `normalizedValue`, evaluates unit/specimen/modifier evidence, counts accepted evidence, and assigns fixed confidence from the final outcome. It does not distinguish reviewed from provisional candidate authority, treat a value-kind mismatch as conflict, consume timing/method/context evidence, or specify how a score selects a winner. The atomic normalization writer already persists `resolver_evidence`, catalog manifest version, and resolver version in an append-only active revision.

EH-102 defined the safety boundary: only a reviewed concrete definition may resolve, while provisional records provide recognized partial results. EH-104 made the resolver outcome independent from verification. EH-110 owns the authoritative alias lifecycle; EH-109 must consume that contract rather than reimplement it.

## Goals / Non-Goals

**Goals:**

- Produce a stable, inspectable decision for every raw result from authorized label matches and structured contextual evidence.
- Evaluate reviewed and provisional candidates without promoting a provisional candidate to a concrete identity.
- Make hard incompatibilities, missing identity axes, numeric scores, score components, tie behavior, and confidence derivation explicit and persistable.
- Preserve raw inputs and the existing four-state resolver/result storage model.
- Keep manual selection constrained to compatible reviewed candidates while retaining both automatic and manual evidence.

**Non-Goals:**

- Define alias provenance, approval, deprecation, laboratory attribution, or bounded-fuzzy matching policy; those are EH-110 deliverables.
- Add clinical unit/specimen compatibility rules or launch scenario packs beyond the generic engine; EH-111, EH-113, and EH-114 own those policies.
- Change consumer display, trends, health scoring, or reprocessing behavior; EH-112, EH-115, and EH-116 own those consumers.
- Infer clinical identity from an LLM proposal, prevalence, or unsupported contextual hints.

## Decisions

### 1. Treat alias authority as a registry input

The resolver SHALL receive candidates only from definition keys and aliases that the Registry 2.0 authority policy marks active and eligible for the supplied source/laboratory context. EH-110 supplies the definitive `AliasDefinition` lifecycle and match-authority result; the resolver consumes it as an immutable input and records the authority identifier, match type, approval state, provenance, and corpus references in label evidence.

A reviewed alias can generate a reviewed or provisional candidate. A provisional alias can generate a candidate only where the EH-110 policy permits it, and cannot independently yield `resolved`. A deprecated, inactive, source-inapplicable, or unapproved alias cannot generate a candidate. A proposed key from extraction/LLM can add a traceable candidate hint but cannot satisfy the authoritative-label requirement for `resolved`.

Alternative rejected: duplicate approval and source filtering in the resolver. That would split the EH-110 authority policy and make launch corpus ownership non-auditable.

### 2. Evaluate an explicit evidence matrix

Each candidate records accepted, missing, and rejected evidence for these axes: authorized label; value kind; normalized unit and unit family; specimen; modifier; timing; method; section/panel; neighbouring rows; and reference-range shape. Evidence records retain source, observed value, expected values, policy code, strength, and deterministic score contribution.

Observed incompatibility on value kind, unit family/token, specimen, modifier, timing, or method is a hard conflict and excludes the candidate. Absence of a candidate-defining axis is missing evidence, never compatibility. Section/panel, neighbours, and reference shape only provide bounded support: they cannot generate a candidate, override a hard conflict, or fill a missing concrete identity axis.

The engine starts from this generic weight table; EH-111 can extend its axis policy without changing the decision structure:

| Evidence | Score |
| --- | ---: |
| authorized exact label | 40 |
| authorized normalized label | 36 |
| authorized OCR/bounded-fuzzy label | 28 |
| compatible value kind | 15 |
| compatible unit | 15 |
| compatible specimen | 10 |
| compatible modifier, timing, or method | 5 each |
| section/panel or neighbour support | 3 each |
| reference-shape support | 2 |

No score is assigned to missing evidence; hard-conflicted candidates have no selectable score. Definitions that declare an axis `unspecified` do not require or score that axis.

Alternative rejected: count accepted evidence equally. It lets weak section context compensate for identity evidence and obscures why outcomes change.

### 3. Select outcomes by admissibility before score

Candidates are evaluated and serialized in ascending definition key order. Candidate ranking is descending selectable score, then descending label-authority rank (exact, normalized, OCR/bounded-fuzzy), then ascending definition key solely for stable presentation.

A candidate is admissible for concrete resolution only when it is reviewed, has Registry 2.0 reviewed provenance, has an authorized label, has no hard conflict or missing definition-required axis, meets a score of at least 55, and leads every other admissible reviewed candidate by at least five points. Exactly one admissible leader produces `resolved`. Equal leaders, a lead below the five-point margin, or multiple otherwise indistinguishable reviewed candidates produce `ambiguous`; lexical ordering never breaks a clinical tie.

If no reviewed candidate is admissible but one or more authorized candidates are recognized, the result is `partial`; it carries compatible candidate keys, missing axes, and conflicts. No authorized candidate yields `unmapped`. A provisional candidate, an extraction-only proposal, or a candidate with missing identity evidence can therefore prove recognition but cannot create a concrete measurement definition key.

Alternative rejected: select the first candidate after sorting. It would appear deterministic while hiding a safety-relevant tie.

### 4. Derive confidence from reproducible evidence

For a selected candidate, mapping confidence equals `min(0.99, selectableScore / 100)`. For an `ambiguous` result, it equals the leading reviewed candidate score divided by 100, capped at 0.99, only as a measure of candidate support; it does not identify a definition. For `partial`, it equals the leading compatible candidate score divided by 100, capped at 0.99; for `unmapped`, it is `0`. The band is high for confidence at least `0.85`, medium for `0.60–0.84`, and low below `0.60`.

`extractionConfidence` remains raw extraction metadata and never contributes to mapping score or band. The returned trace contains all score components, total, candidate eligibility, selected/runner-up relationship, and outcome rationale so a persisted decision can be explained without rerunning a later registry version.

Alternative rejected: assign fixed confidence by outcome. It conflates distinct evidentiary cases and cannot reveal an evidence regression.

### 5. Persist a versioned decision trace at the normalization boundary

The resolver output adds a versioned `ResolverDecisionTrace` alongside the existing candidate-evidence JSON. It contains the input evidence snapshot needed for interpretation, authority metadata, per-axis evidence, selected and runner-up keys, score totals, eligibility, missing axes, conflicts, outcome, and confidence derivation. `resolver_evidence` stores this schema through the existing atomic normalization writer; the writer also records the catalog manifest and resolver versions already required by Registry 2.0.

The review DTO exposes the trace as structured data. Manual selection is permitted only for a compatible reviewed candidate and appends explicit `manual_selection` evidence while retaining the automatic candidates and conflicts. It must use the same confidence derivation rather than writing a fixed confidence value.

Alternative rejected: persist only candidate keys and final state. Future catalog releases could not reproduce or safely inspect a historical decision.

## Risks / Trade-offs

- [EH-110 has not yet frozen the alias contract] → Keep authority matching behind the EH-110 interface and do not enable authority-sensitive cutover until its lifecycle, provenance, corpus, and negative cases are implemented.
- [Generic weights may overfit the initial corpus] → Keep weights centralized, test the decision matrix, and let EH-111 add clinical compatibility policy without bypassing hard conflicts.
- [Persisted JSON traces grow revision rows] → Store only normalized evidence and policy identifiers, retain raw inputs in the existing extracted row, and avoid duplicate raw document content.
- [Contextual evidence could become hidden inference] → Restrict section, neighbour, and reference-shape evidence to support-only weights and test that it never bypasses required axes or conflicts.
- [Manual overrides could erase automatic safety signals] → Preserve the original trace and require compatible reviewed manual targets.

## Migration Plan

1. Land EH-110 alias authority/lifecycle data and corpus contract; adapt Registry 2.0 construction to emit the resolver authority input.
2. Add the versioned resolver trace and evidence matrix types, then implement pure candidate generation, evaluation, ranking, and outcome selection behind a bumped resolver version.
3. Update the normalization writer, revision payload, manual-selection validation, and review DTO atomically so every new revision persists the complete trace.
4. Add unit and corpus fixtures for reviewed/provisional candidates, each conflict axis, missing axes, ties, unknown labels, and negative-authority aliases; run the existing biomarker and document-review regressions.
5. Backfill nothing: existing revisions retain their recorded resolver version and evidence shape. New processing uses the new version; EH-116 owns controlled reprocessing once the contract is stable.
6. Roll back by restoring the prior application release before new revisions are created. Do not reinterpret or overwrite append-only historical revisions.

## Open Questions

- EH-110 must finalize the exact alias-authority result shape and the authority ranking for bounded-fuzzy matches before coding the adapter.
- EH-111 must decide whether any definition axes are conditionally required by unit family or value kind; the generic engine will consume that declared policy.
- Clinical product review must approve the initial score threshold and five-point dominance margin against the launch corpus before production enablement.