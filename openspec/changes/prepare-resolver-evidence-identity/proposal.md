## Why

The Resolver currently receives evidence prepared by multiple adapters, while `input_evidence_hash` omits resolution-relevant provenance such as whether a specimen was stated or supplied by a reviewed panel policy. The same gap makes reprocessing substitute a recomputed current hash for the historical prior value, and lets reversal paths reinterpret a saved decision through the current panel policy instead of restoring what was recorded.

This change establishes one prepared-evidence contract and a versioned Resolver input identity before the coordinated historical-read change is proposed.

## What Changes

- Add one shared evidence-preparation seam for review, acceptance, automatic verification, correction, reversal, reprocessing, and the candidate corpus. Source-row adapters may differ, but stated-axis filtering and reviewed panel-policy admission run once in the shared seam and produce the same prepared evidence record.
- Define a canonical **Resolver input identity** distinct from the Resolver outcome, decision trace, Registry release, and writer request hash. The identity records effective specimen and provenance source, canonical panel-policy context, resolution-relevant axes, and an explicit identity-format version; raw captured headings and raw OCR content do not enter the persisted identity representation.
- Ensure the Resolver consumes the prepared evidence record without re-running panel-policy admission. Equivalent headings that resolve to the same reviewed policy produce the same policy context; stated and policy-derived specimens remain distinct even when their effective specimen value matches.
- Make regular acceptance, automatic verification, correction, undo, and reprocessing use the same prepared record for resolution, trace construction, and input identity hashing. The corpus adapter consumes this seam without redesigning the complete corpus runner.
- Make reversal restore the selected historical revision's saved evidence, input hash, identity-format version, and decision metadata. Reversal SHALL NOT call the current panel policy or perform a new Resolver evaluation for the restored decision. A new Resolver evaluation remains an explicit acceptance, correction, or reprocessing operation with its own apply decision.
- Persist the identity-format version alongside revision hashes and propagate prior/next identity versions through reprocessing rows and observation change history. Existing legacy hashes remain unchanged and are not silently backfilled.
- Record three independent reprocessing facts: whether prepared input identity changed, whether Resolver outcome changed, and whether the deployed Registry/resolver release changed. A single hash comparison SHALL NOT decide revision creation or activation.
- Define an explicit reprocessing apply contract that determines which combinations of input, outcome, and release changes create a new revision and which revision becomes active. Dry-run audit rows retain all three facts even when no revision is applied.
- Preserve the EH-164 invariant for both coordinated changes: comparator/detection-limit markers may remain accepted Health Profile text inputs with `value: null`, but never contribute to numeric score or trend calculations.
- Keep historical persisted-decision reading, its source/quality status model, and its conflict state in the separate coordinated proposal; this change only defines the data that that reader consumes.

## Capabilities

### New Capabilities

- `resolver-input-identity`: Shared prepared evidence and versioned canonical identity for one Resolver evaluation.
- `registry-reprocessing-contract`: Independent input/outcome/release change facts and an explicit revision-application contract.

### Modified Capabilities

- `context-aware-measurement-resolution`: Resolver evaluation consumes one admitted prepared evidence record and does not duplicate panel-policy admission.
- `resolver-decision-trace`: New revisions and reprocessing records carry the identity-format version while keeping raw evidence redacted and release metadata separate from input identity.
- `registry-v2-acceptance-correction`: Reversal restores the saved historical decision contract instead of re-evaluating it through current evidence-admission policy.
- `document-extraction-review`: Undo/reversal restores the saved historical decision contract without re-evaluating current evidence-admission policy.
- `registry-release-corpus-governance`: Candidate corpus evaluation uses the shared preparation and identity seam and reports identity separately from release identity.

## Impact

- Affected domains: `documents`, Registry/biomarker resolution, reprocessing, and candidate-release corpus governance.
- Affected code: shared document evidence builders, `MeasurementResolutionInput`/Resolver seams, normalization writers and correction routes, reprocessing diff/application types and service, candidate corpus adapters, and persisted trace/revision readers.
- Affected persistence: revision identity-format metadata, prior/next reprocessing identity metadata and change-ledger propagation, plus the corresponding service-only RPC payloads and validation.
- Affected contracts: internal review/reprocessing payloads gain explicit identity and change facts; existing Health Profile marker, scoring, and trend behavior remains unchanged.
- Legacy rows and hashes remain readable without reinterpretation; incompatible identity versions are not compared as if they were equal.
- The coordinated historical-read proposal will depend on this persisted identity contract but is not implemented or specified here.
