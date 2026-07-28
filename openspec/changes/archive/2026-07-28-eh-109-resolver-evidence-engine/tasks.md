## 1. Alias-authority integration prerequisite

- [x] 1.1 Complete EH-110's AliasDefinition lifecycle, provenance, approval, source/laboratory attribution, fixture ownership, and match-authority contract before enabling EH-109 authority-sensitive matching.
- [x] 1.2 Adapt Registry 2.0 construction to expose only active, source-applicable authoritative alias matches and their provenance to the resolver; add negative authority fixtures.

## 2. Resolver domain contract

- [x] 2.1 Extend measurement-resolution input and definition contracts for timing, method, panel/section, neighbouring rows, reference shape, declared required axes, and alias-authority results.
- [x] 2.2 Add versioned decision-trace, candidate eligibility, score-component, authority, hard-conflict, missing-axis, and outcome-rationale types; bump the resolver version.
- [x] 2.3 Define centralized generic evidence weights, authority ranking, confidence bands, minimum score, and dominance-margin policy without duplicating EH-110 lifecycle rules.

## 3. Pure resolver engine

- [x] 3.1 Replace normalized-string-only candidate matching with authorized reviewed/provisional candidate generation; retain non-authoritative proposed keys as trace-only hints.
- [x] 3.2 Evaluate label, value kind, unit, specimen, modifier, timing, method, section/panel, neighbouring-row, and reference-shape evidence with explicit accepted, missing, and hard-conflict outcomes.
- [x] 3.3 Implement deterministic scoring, candidate serialization/ranking, admissibility, tie handling, four-state outcome selection, analyte projection, and evidence-derived mapping confidence.
- [x] 3.4 Update compatible manual-definition filtering and validation so only compatible reviewed candidates are selectable and manual selection preserves the automatic trace.

## 4. Normalization persistence and review boundary

- [x] 4.1 Persist the versioned resolver decision trace, outcome, evidence-derived confidence, catalog manifest version, and resolver version through the existing atomic normalization-revision writer.
- [x] 4.2 Update normalization revision payload types and the review DTO to expose the structured trace without altering the active-revision publication invariant.
- [x] 4.3 Remove fixed manual-resolution confidence values and derive manual-selection confidence through the shared policy.

## 5. Regression coverage and verification

- [ ] 5.1 Add resolver unit coverage for reviewed/provisional authority, every hard-conflict and missing-axis path, context-only support, extraction-only proposals, and all four outcomes.
- [ ] 5.2 Add deterministic tie, near-margin, score, confidence, authority-lifecycle, source/laboratory attribution, and launch-corpus regression fixtures.
- [ ] 5.3 Add normalization persistence and manual-selection regressions proving stored traces reproduce the resolver contract and incompatible selections publish nothing.
- [ ] 5.4 Run `pnpm test:biomarkers`, `pnpm test:measurement-registry`, and `pnpm test:document-review`; exercise a document-review flow with resolved, partial, ambiguous, and unmapped synthetic rows.

## 6. QA and handoff

- [ ] 6.1 Update `QA/eh-109/checklist.md` with safe tester-visible document-review checks, developer-evidence requests for resolver/persistence assertions, and explicit EH-111/EH-112/EH-113/EH-114/EH-115/EH-116 deferrals.
- [ ] 6.2 Record implementation evidence against the EH-109 acceptance criteria and hand off the stable resolver contract to EH-111 and EH-112.