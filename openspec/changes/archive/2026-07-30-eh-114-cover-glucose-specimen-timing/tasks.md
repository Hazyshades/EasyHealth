## 1. Registry model and resolver

- [x] 1.1 Add post-prandial timing to the Registry 2.0 measurement identity types and preserve it in resolver evidence.
- [x] 1.2 Add reviewed post-prandial plasma and qualitative urine-dipstick glucose definitions without altering existing serum, plasma, whole-blood, or fasting identities.
- [x] 1.3 Add focused resolver assertions for explicit variants, missing specimen/timing, conflicting context, and conversion availability.

## 2. Candidate release evidence

- [x] 2.1 Extend the de-identified Registry 2.0 candidate corpus and document fixtures with required glucose specimen and timing variants.
- [x] 2.2 Update candidate-corpus runner coverage and false-concrete regression assertions, then regenerate governed candidate evidence as needed.

## 3. QA and verification

- [x] 3.1 Create the EH-114 tester-facing QA checklist with safe data, unavailable-interface boundaries, and developer evidence requests.
- [x] 3.2 Run focused resolver, candidate-corpus, registry, type, and OpenSpec validation; record the results in the QA checklist.
- [ ] 3.3 Run the EH-114 database persistence test against the disposable local Supabase stack and record the result.
