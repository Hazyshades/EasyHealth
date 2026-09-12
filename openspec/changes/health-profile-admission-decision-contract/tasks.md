## 1. Admission decision contract

- [x] 1.1 Add `projectHealthProfileLaboratoryAdmission` with `accepted` / `excluded` results.
- [x] 1.2 Transfer outcome, exclusion, binding, verification, resolver candidate, and version evidence.
- [x] 1.3 Preserve EH-164 censored text-marker precedence and non-numeric semantics.

## 2. Snapshot consumer cutover

- [x] 2.1 Cache one admission decision per persisted laboratory observation.
- [x] 2.2 Reuse cached decisions for direct inputs, score exclusions, and linked reported rows.
- [x] 2.3 Keep unlinked rows report-only and keep reported visibility/counts independent from admission.
- [x] 2.4 Preserve snapshot hash fields and existing score-exclusion reason mapping.

## 3. Regression and documentation evidence

- [x] 3.1 Add fixed before/after admission baseline fixtures and verifier.
- [x] 3.2 Migrate EH-142, EH-164, EH-123, and EH-147 verification callers.
- [x] 3.3 Run focused runtime, baseline, typecheck, OpenSpec, and Registry documentation checks.
- [x] 3.4 Regenerate canonical docs, publish the Wiki mirror, and track synchronization in issue #247.

## 4. Deferred follow-up

- [x] 4.1 Record `ready_for_scoring_count` semantics as a separate policy change; do not alter it in this implementation.
