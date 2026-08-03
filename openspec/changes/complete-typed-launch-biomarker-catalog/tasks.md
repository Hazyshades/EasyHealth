## 1. Catalog inventory and unit model

- [x] 1.1 Reconcile the candidate corpus against the current Registry 2.0 definitions; classify each required row as an existing reviewed definition, a new typed provisional definition, or a duplicate placeholder to remove.
- [x] 1.2 Define reusable unit policies for required launch units, including protein concentration, bilirubin concentration, arbitrary coefficient/titer/IU units, ESR rate, and specialty protein concentration.
- [x] 1.3 Extend unit normalization only where a required corpus spelling is not already normalized; add negative coverage for unknown and dimension-conflicting units.

## 2. Typed Registry 2.0 launch definitions

- [x] 2.1 Replace the generic sample-fixture definition generator with explicit typed provisional definitions for total protein, direct bilirubin, ASO, ESR, Giardia antibodies, helminth IgG tests, total IgE, and ECP.
- [x] 2.2 Reuse existing reviewed total-bilirubin, ALT, AST, and CRP definitions for exact corpus labels and remove any shadow sample placeholders that introduce incompatible unit evidence.
- [x] 2.3 Give every new provisional definition explicit provenance, identity axes, aliases, value kind, accepted units or intentional unitlessness, and empty assessment bindings.
- [x] 2.4 Confirm new definitions cannot resolve to concrete runtime identities, conversion policies, score inputs, trends, or readiness bindings solely from fixture recognition.

## 3. Resolver and candidate-release governance

- [x] 3.1 Update candidate-corpus unit coverage so a row is covered only by an accepted typed candidate or an intentionally unitless qualitative definition, independent of whether the safe outcome is `partial`.
- [x] 3.2 Preserve release failure for unknown-unit and unit-dimension conflicts; add a regression that proves an incompatible unit cannot be counted as covered.
- [x] 3.3 Update corpus expectations and runner assertions for all required launch rows, including typed partial outcomes, zero false concrete resolutions, and consumer ineligibility for provisional definitions.
- [ ] 3.4 Ensure the corpus runner uses the final merged glucose baseline and does not discard existing glucose rows, policy requirements, or approval-owner rules.

## 4. Verification and release evidence

- [x] 4.1 Add focused registry/resolver tests for every new typed definition, accepted unit, intentionally unitless qualitative test, missing-context result, and unit-conflict negative.
- [ ] 4.2 Run the focused registry, candidate-corpus, runtime-cutover, typecheck, and affected database/persistence verification commands; record exact output in developer evidence.
- [x] 4.3 Generate the final candidate manifest and report; verify full required-row coverage, expected classifications, raw preservation, unit coverage, zero processing errors, and zero false concrete resolutions.
- [ ] 4.4 Obtain and record fresh hash-bound Registry Safety, required Assessment Owner, and Release Manager approvals for the final candidate input; do not alter approval evidence without those reviews.
- [x] 4.5 Create or update the applicable roadmap QA checklist with synthetic/de-identified tester flows and developer-evidence requirements before marking any EH roadmap item complete.
- [ ] 4.6 Validate this OpenSpec change strictly, reconcile its requirements with automated and manual evidence, and only then update or close the relevant roadmap issue.