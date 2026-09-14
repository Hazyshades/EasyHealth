## Context

Registry 2.0 laboratory resolution currently has two production row-to-input builders: the review path and the normalization writer path. Both apply the stated-axis provenance filter and then call the reviewed panel-specimen matcher, while `measurement-resolution.ts` can apply that panel policy again from `capturedHeading`. The same extracted row can therefore reach preview, acceptance, correction, reprocessing, and corpus evaluation through subtly different evidence-preparation paths.

`buildInputEvidenceHash` is also built from the raw `MeasurementResolutionInput`. It includes the effective specimen but not the specimen provenance source, and it hashes the captured section text rather than the canonical policy fact that the section established. The hash is stored on normalization revisions, but the revision model and reprocessing selectors do not carry an identity-format version. Reprocessing currently reconstructs the `prior` hash from the current row, and the undo path reconstructs a target decision by resolving current input again.

The existing Health Profile admission contract is a separate boundary. A comparator or detection-limit result may be accepted as textual evidence with `value: null` and `value_kind: "text"`; it is not a numeric score or trend contribution. This change must preserve that EH-164 invariant and must not redefine `evaluateAssessmentEligibility` or Health Profile scoring.

This design covers the first coordinated change only: shared evidence preparation, Resolver input identity, writer/reprocessing/corpus integration, and historical restoration of a saved decision. The separate historical-read change will consume the persisted identity metadata and define its source/quality status model.

## Goals / Non-Goals

**Goals:**

- Give review, writer, correction, reversal, reprocessing, and corpus adapters one ordered evidence-preparation seam.
- Make stated-axis filtering precede reviewed panel-policy admission and preserve whether the effective specimen was stated or policy-derived.
- Make the Resolver consume prepared evidence without re-running panel-policy admission from raw heading text.
- Define a deterministic, privacy-safe, versioned Resolver input identity that is separate from the outcome, decision trace schema, Registry release, and writer request hash.
- Persist identity format metadata and propagate it through revisions, reprocessing rows, and observation change history without rewriting legacy hashes.
- Restore a selected historical decision by copying its saved decision evidence, hash, version, and release metadata rather than evaluating current input.
- Represent input, outcome, and release changes as independent reprocessing facts and make revision creation/activation an explicit apply decision.
- Keep corpus execution non-mutating and make it use the same preparation and identity seam as production writers.
- Preserve EH-164 textual-marker admission, numeric score exclusion, and trend exclusion exactly.

**Non-Goals:**

- Do not implement the separate persisted-decision historical-read module or its `persisted`/`preview` source and `unavailable`/`conflict` quality axes.
- Do not centralize Registry release construction or change release version semantics.
- Do not redesign the complete candidate corpus runner, fixture set, or launch thresholds.
- Do not change Health Profile admission, censored-marker presentation, readiness, numeric scoring, or trend behavior.
- Do not rewrite or backfill existing legacy hashes, traces, or decisions.
- Do not persist raw OCR, raw captured headings, patient content, or arbitrary Resolver input in traces or identity records.

## Decisions

### D1 — One prepared-evidence module owns admission ordering

Each source-row shape gets a thin adapter that supplies a row-neutral source
envelope containing the raw measurement evidence, clinical-axis provenance,
source analyte key, and any active measurement override. The shared preparation
module is pure and mutation-free; its proposed implementation boundary is
`src/lib/documents/measurement-evidence-admission.ts`. Review, writer, and
candidate-corpus modules own translation into that envelope, not evidence
policy.

The module performs exactly this order:

1. Apply the measurement override and normalize the effective value, value kind,
   unit, reference bounds, and raw value text. Comparator/detection-limit text
   remains factual value evidence.
2. Build `RowProvenance` and apply `statedAxisValue` to specimen, modifier,
   method, and timing.
3. Canonicalize non-evidence sentinels such as `none`, `unknown`, and
   `unspecified` to an absent axis before policy matching or Resolver
   evaluation. This does not alter the EH-164 textual-marker contract.
4. If a concrete stated specimen remains, retain it and do not evaluate panel
   policy. Otherwise, evaluate reviewed panel policy using the captured
   heading and the source analyte key, including the policy allowlist.
5. Return a discriminated panel-policy result: `stated`, `applied`,
   `no_match`, or `conflict`. Zero applicable policies produce `no_match`;
   one distinct policy produces `applied`; multiple distinct policies produce
   `conflict`. Multiple matching heading forms belonging to one policy count
   once. Conflict policy keys are sorted for deterministic diagnostics.
6. Build one `PreparedEvidence` record and a Resolver input containing the
   effective axes, policy context, and canonical section-support facts. Raw
   captured heading text remains source provenance but is not sent to Resolver
   as a policy decision input.

The policy matcher must expose the distinction between zero and multiple
matches rather than returning `null` for both. A policy-derived specimen is
usable only for the declared source analyte and its reviewed allowlist; it
must not be attached to an unrelated candidate definition. A policy conflict
fails closed: the effective specimen is absent, Resolver emits a stable hard
reason such as `panel_specimen_policy_conflict`, and no concrete mapping may
be returned.

The same `PreparedEvidence` object is passed unchanged to Resolver evaluation,
identity canonicalization, decision-trace construction, writer request
generation, and eligibility checks. No caller may reconstruct a second input
between those operations.

The Resolver consumes the prepared effective specimen and policy context. It
does not inspect or re-match the raw captured heading and does not import the
admission module. Direct Resolver fixtures may construct already-prepared
inputs; source-row policy tests must use the shared preparation seam.

Active persisted observations use the separate historical-decision reader
contract, and undo/reversal copies saved historical data without a new
admission. Health Profile admission remains a separate projection boundary;
only an unlinked/no-active-row preview uses the shared preparation seam.

**Alternative rejected:** Keep the current matcher inside the Resolver and
merely call a shared builder first. That leaves two policy owners, collapses
no-match and conflict, and permits a caller to hash one prepared input while
the Resolver silently derives another specimen.

### D2 — Identity is a canonical prepared-input record, not a decision hash

The identity module receives the prepared evidence record and emits a versioned canonical record before hashing it with SHA-256. The record contains only allowlisted fields needed to identify the prepared evidence, with fixed object-key order, explicit nulls, deterministic list ordering, and the identity format version included in the hashed serialization.

The canonical record contains:

- raw measurement evidence needed to preserve the reported label/unit/value text and value kind, including comparator text;
- the effective specimen and its source (`stated`, `reviewed_panel_policy`, or unknown);
- policy context (`stated`, `applied`, `no_match`, or `conflict`), policy key when present, effective specimen, and policy source;
- prepared modifier, timing, method, laboratory, and other resolution axes;
- canonical section-support/context facts instead of raw captured heading text;
- normalized, de-duplicated neighbouring-label evidence and canonical reference-bound values where those facts are part of the prepared record;
- the proposed key only when the preparation contract declares it part of the input identity.

Extraction confidence and writer action state are excluded. Registry release/version metadata is stored alongside the decision but is not an input-identity field. The existing request hash remains a separate idempotency identity.

Equivalent panel headings that yield the same reviewed policy key produce the same policy context. A stated specimen and a policy-derived specimen remain different identities even when the effective specimen string is equal. A legacy row with no identity-format version is not silently interpreted as a v1 record.

**Alternative rejected:** Hash the complete source row or raw captured heading. That makes equivalent policy wording produce different identities, leaks representation details into historical comparison, and treats extraction metadata as Resolver evidence.

### D3 — Identity format version is a separate persistence axis

New normalization revisions persist `input_identity_format_version` next to `input_evidence_hash`. The field is distinct from `resolver_trace_schema_version`, `resolver_version`, `normalization_version`, and Registry catalog manifest identity. Reprocessing rows and observation change events carry prior/next identity versions with their corresponding hashes.

The writer accepts the version/hash pair as part of the trusted resolution payload and validates the pair atomically with the revision and observation projection. New writes require the current format version. Legacy rows remain nullable and unchanged; equality is asserted only when both sides have a known compatible identity format.

**Alternative rejected:** Encode the identity format only in the trace schema version. Trace schema evolution and input canonicalization evolve independently and must not force one migration axis to masquerade as the other.

### D4 — Reversal is historical restoration, not a new evaluation

Undo/reversal uses an explicit restore operation targeting a revision belonging to the same extracted source. The operation copies the target revision's persisted decision fields, resolver evidence, decision trace, input hash, identity-format version, and release metadata into the append-only reversal revision, links the supersession/reversal relationship, and synchronizes the observation projection through the existing atomic writer boundary.

The restore operation does not call `matchReviewedPanelSpecimenPolicy`, `resolveMeasurementDefinition`, or any other current Resolver evaluation. It does not rebuild the target decision from the current row. If the target lacks the saved data required by the restore contract or fails same-source/CAS checks, the transaction fails closed without a partial promotion. A new evaluation is available only through an explicit acceptance, correction, or reprocessing operation.

This preserves reversibility without claiming that a current extracted row is equivalent to the historical input. The saved hash/version and decision trace are historical evidence; they are not recomputed during restore.

**Alternative rejected:** Re-run the current Resolver with the target override and selected definition. That reinterprets a historical user decision through current panel policy, aliases, and compatibility rules and can produce a new decision while presenting it as an undo.

### D5 — Reprocessing records three independent change facts

The reprocessing diff reads `prior` identity, outcome, and release values from the stored active revision. It computes `next` from the current prepared evidence and deployed release. It records independently:

- `inputChange`: `changed`, `unchanged`, or `unavailable` when identity formats cannot be compared;
- `outcomeChange`: `changed` or `unchanged` for the explicit resolver-outcome tuple (result, definition key, analyte key, and confidence band);
- `releaseChange`: `changed`, `unchanged`, or `unavailable` when prior release metadata is absent.

A changed input does not imply a changed outcome. A changed release does not imply either input or outcome changed. A changed outcome does not imply the prepared input changed. The dry-run record retains all three facts regardless of whether a revision is applied.

The default automatic apply policy is explicit: an input or outcome change can make a row apply-eligible subject to existing protection of user-verified and manually-corrected decisions; a release-only change is audit-only unless a caller selects an explicit release-refresh intent; an unavailable comparison is never treated as equal. The apply result records `create_revision` and `activate_revision` decisions separately and uses the existing service-only writer/CAS path for any mutation. Hash equality alone is not an apply policy.

**Alternative rejected:** Reuse the existing `unchanged` branch as a hash comparison. It loses independent release changes, conflates historical input availability with equality, and makes revision activation an incidental consequence of one digest.

### D6 — Corpus is a consumer of the same seam

The candidate corpus keeps its non-mutating behavior and release artifact identity. Its row adapter calls the shared preparation module and identity function, then evaluates the candidate release with those prepared facts. Corpus report hashes distinguish prepared input identity from candidate/release artifact identity. The change does not move production persistence into the corpus or duplicate the complete corpus orchestration.

### D7 — EH-164 remains a regression invariant

No identity or reprocessing decision changes Health Profile marker semantics. A comparator/detection-limit marker may remain an accepted text input with `value: null` and `value_kind: "text"`; the marker is factual evidence only and cannot contribute to numeric score or numeric trend. The implementation must retain the existing EH-164 verifier and add no alternate path that turns `non_numeric_value` into marker removal.

## Risks / Trade-offs

- **[Policy ambiguity]** A heading can match zero or multiple reviewed policies, and the current matcher collapses both to `null`. → Return a discriminated preparation result and fail closed on conflict; add direct no-match/conflict coverage.
- **[Over- or under-canonicalization]** Hashing raw representation creates false input changes, while dropping a resolution-relevant fact creates false equality. → Keep the canonical record allowlisted, version it, and test equivalent headings, stated/policy provenance, nulls, axes, values, and release-only changes independently.
- **[Legacy comparability]** Historical revisions have hashes without an identity-format version. → Keep legacy fields nullable, mark comparisons unavailable when formats are unknown, and never backfill by recomputing current input.
- **[Reversal source drift]** The current source row may no longer reproduce the target revision's prepared input. → Restore the persisted decision payload by target revision and validate same-source/CAS ownership; never derive decision fields from the current row during restore.
- **[Writer/RPC rollout]** New fields must cross TypeScript payloads, service-only RPCs, SQL validation, and history triggers atomically. → Add nullable columns and backward-compatible reads first, then require the new pair for new writes; retain one writer boundary and verify every mutation path.
- **[Release churn]** Treating every release change as a new clinical revision could create noisy history. → Record release change independently and make release-only refresh an explicit apply intent rather than an implicit hash consequence.
- **[Historical catalog availability]** A later historical-read change may not find the old definition in the current catalog. → Keep that quality state out of this proposal; the future reader must expose it instead of re-resolving.

## Migration Plan

1. Add the shared preparation and identity contracts in application code, with the current format version and independent pure verification evidence.
2. Add nullable identity-version columns to normalization revisions, reprocessing prior/next rows, and observation change events. Extend service-only RPC payload validation and history propagation without rewriting existing rows.
3. Switch review previews, regular acceptance, automatic verification,
   prospective correction, reprocessing `next`, and corpus adapters to the
   shared preparation seam. Historical undo/reversal restores saved data
   without preparation; active persisted reads remain owned by the separate
   historical-read change. New revisions persist the hash/version pair and
   separate release metadata.
4. Deploy the reprocessing diff/apply contract. Dry runs first expose the three change facts; application uses explicit create/activate decisions and existing manual-decision protections.
5. Keep legacy rows readable with unavailable identity comparison. Do not run a semantic backfill or silently activate a reprocessed revision.
6. Roll back application behavior before removing any additive columns or RPC parameters. Because legacy data is untouched, rollback can leave the new nullable metadata in place; a mixed-version deployment must not treat a null identity version as equal to a v1 identity.

## Resolved implementation questions

- The format-1 canonical field table is the flat allowlisted record recorded
  in `registry/adr/0002-resolver-input-identity.md`; effective corrected
  measurement fields and the source analyte key are included, while raw
  headings and source-record identifiers are excluded.
- User-initiated historical restore uses the service-only
  `restore_observation_normalization_revision_v1` RPC, which copies the
  target revision's persisted decision, trace, identity, and release fields
  and uses the existing atomic projection boundary. EH-122 batch undo uses its
  dedicated `eh122_reverse_observation_normalization_verification` RPC so it
  preserves the pending-verification transition while copying those fields.
- `releaseChange` compares the five-field deployed release tuple:
  catalog manifest version/digest, Resolver version, normalization version,
  and compatibility-policy version. `--release-refresh` is the explicit
  apply intent.
- Review, writer, reprocessing, and corpus adapters all call the shared
  preparation function; source-row identity reports include format version
  alongside the hash.
