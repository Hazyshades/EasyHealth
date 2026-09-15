## 1. Prepared evidence contract

- [x] 1.1 Define the pure, row-neutral `PreparedEvidence` type, effective
      measurement fields, provenance fields, source analyte key, and
      discriminated panel-policy context.
- [x] 1.2 Implement one preparation order: apply overrides and normalize
      effective measurement values first, then filter stated axes, canonicalize
      non-evidence sentinels, and only then evaluate reviewed panel policy.
- [x] 1.3 Change the reviewed panel matcher to expose zero, one, and multiple
      distinct policy matches instead of collapsing zero and multiple to `null`;
      deduplicate multiple heading forms belonging to one policy.
- [x] 1.4 Enforce the source-analyte allowlist for policy admission, preserve
      stable sorted conflicting policy keys, fail closed on conflict, and emit
      an allowlisted hard trace reason for ambiguous policy admission.
- [x] 1.5 Update the Resolver seam to consume the prepared specimen and policy
      context without inspecting or re-matching raw captured headings.
- [x] 1.6 Replace review and writer evidence-preparation duplication with thin
      adapters over the shared preparation module, including identical override
      and raw-value-text semantics.
- [x] 1.7 Pass one unchanged prepared record to Resolver evaluation, identity
      canonicalization, trace construction, writer request generation, and
      eligibility checks.
- [x] 1.8 Route prospective acceptance, confirmation, correction, reprocessing,
      and no-active-row preview through the seam; keep active persisted reads
      and historical undo on their separate restore/read contracts.
- [x] 1.9 Route candidate-corpus fixtures through the seam without using
      fixture `panel` metadata as Resolver section evidence, and preserve
      non-mutating execution and separate release-artifact identity.
- [x] 1.10 Add admission-order, sentinel, allowlist, conflict, and
      review/writer/corpus parity coverage before integrating identity hashing.

## 2. Resolver input identity

- [x] 2.1 Define the versioned canonical input-identity record and its allowlisted field table.
- [x] 2.2 Implement deterministic null handling, object-key ordering, collection normalization, and SHA-256 hashing.
- [x] 2.3 Keep raw comparator text as factual value evidence while excluding raw headings, OCR content, extraction confidence, action state, and release metadata.
- [x] 2.4 Make equivalent panel headings hash through the same policy context while distinguishing stated and policy-derived specimens.
- [x] 2.5 Integrate one prepared record into Resolver evaluation, decision-trace construction, and writer request generation.
- [x] 2.6 Add identity unit coverage for provenance, context, nulls, value text, unsupported policy matches, and release-only changes.

## 3. Persistence and service contracts

- [x] 3.1 Add nullable `input_identity_format_version` persistence beside revision input hashes without rewriting legacy rows.
- [x] 3.2 Extend trusted writer payloads and database RPC validation for the hash/version pair.
- [x] 3.3 Add prior/next identity versions and independent input/outcome/release facts to reprocessing rows.
- [x] 3.4 Propagate prior/next identity versions and change facts through observation change history and its triggers.
- [x] 3.5 Update TypeScript revision, selector, batch, and history types to read stored identity and release metadata.
- [x] 3.6 Preserve trace-schema, Resolver, normalization, and Registry-release versions as separate fields.

## 4. Acceptance, correction, and historical restore

- [x] 4.1 Migrate regular acceptance and automatic verification to the shared prepared evidence and identity seam.
- [x] 4.2 Migrate current correction and manual-selection evaluation without changing hard-evidence or EH-164 behavior.
- [x] 4.3 Add an explicit same-source historical-restore path for undo/reversal.
- [x] 4.4 Copy the target revision's saved decision evidence, trace, hash, identity version, and release metadata during restore.
- [x] 4.5 Enforce atomic same-source and expected-active checks for restore and reject incomplete historical targets.
- [x] 4.6 Prove restore does not invoke current Resolver or current panel-specimen policy and leaves prior revisions immutable.

## 5. Reprocessing diff and apply

- [x] 5.1 Read prior identity, outcome, and release values from the stored active revision and compute next values from current prepared evidence.
- [x] 5.2 Implement independent `inputChange`, `outcomeChange`, and `releaseChange` facts with unavailable states for incompatible legacy data.
- [x] 5.3 Define explicit create-revision and activate-revision decisions instead of deriving mutation from hash equality.
- [x] 5.4 Keep release-only changes audit-only by default and require explicit release-refresh intent for release-only revision creation.
- [x] 5.5 Preserve existing user-verified and manually-corrected protections in the apply contract.
- [x] 5.6 Apply eligible rows only through the service-only writer and expected-active CAS boundary.
- [x] 5.7 Add reprocessing coverage for independent input, outcome, release, legacy, manual-protection, and no-change combinations.

## 6. Candidate corpus integration

- [x] 6.1 Route candidate corpus fixture adapters through shared prepared evidence and identity generation.
- [x] 6.2 Keep candidate/release artifact identity separate from prepared input identity in corpus reports.
- [x] 6.3 Verify corpus/writer identity parity and preserve non-mutating corpus execution.

## 7. Verification and documentation

- [x] 7.1 Run focused Resolver, preparation, writer, reversal, and reprocessing verification covering all new contract scenarios.
- [x] 7.2 Run the existing EH-164 regression evidence and confirm accepted text markers remain excluded from numeric score/trend contribution.
- [x] 7.3 Update affected canonical Registry/biomarker documentation and record the implementation contract accurately.
- [x] 7.4 Run biomarker documentation generation, checks, tests, Wiki render/staging export, and update the single tracking issue with publication status.
- [x] 7.5 Validate the completed OpenSpec change with strict validation and review the apply-ready task list.
- [x] 7.6 Preserve EH-122 reversal replay idempotency by checking an existing
      request-hash successor before active-state guards.

- [x] 7.7 Align the EH-248 database fixture profile setup with the post-auth
      `profiles` schema.

- [x] 7.8 Use the pgTAP `has_column` assertion directly in the EH-248 database
      contract fixture.

- [x] 7.9 Supply the complete measurement-override writer argument list in the
      EH-248 database contract fixture.

- [x] 7.10 Align the shared `DocumentType` union with all supported typed
      document categories so worker typecheck matches runtime consumers.

- [x] 7.11 Scope Registry v1 import detection to legacy paths without
      flagging Knowledge Base catalog modules.

- [x] 7.12 Make the EH-104 document-delete source assertion tolerate
      formatting whitespace between the chained calls.
- [x] 7.13 Preserve incomplete review rows in shared evidence preparation while keeping mutation callers strict.
- [x] 7.14 Accept standard PDF line endings in the EH-132 fixture verifier.
- [x] 7.15 Make the EH-131 drawer source-link assertion formatting-tolerant.
- [x] 7.16 Verify the pushed commit against all Measurement Registry CI jobs; run `34951259532` passed.
