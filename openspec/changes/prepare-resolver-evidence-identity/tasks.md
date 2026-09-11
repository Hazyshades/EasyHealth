## 1. Prepared evidence contract

- [ ] 1.1 Define the prepared Resolver evidence type, effective-axis fields, and discriminated panel-policy context.
- [ ] 1.2 Consolidate override application and stated-axis filtering before reviewed panel-policy admission.
- [ ] 1.3 Preserve distinct `stated`, `applied`, `no_match`, and `conflict` policy outcomes, including fail-closed ambiguous matches.
- [ ] 1.4 Update the Resolver seam to consume prepared specimen/policy context without re-matching captured headings.
- [ ] 1.5 Replace review and writer duplication with thin source-row adapters over the shared preparation module.
- [ ] 1.6 Route correction, confirmation, reprocessing, Health Profile preview, and corpus preparation through the appropriate shared seam.

## 2. Resolver input identity

- [ ] 2.1 Define the versioned canonical input-identity record and its allowlisted field table.
- [ ] 2.2 Implement deterministic null handling, object-key ordering, collection normalization, and SHA-256 hashing.
- [ ] 2.3 Keep raw comparator text as factual value evidence while excluding raw headings, OCR content, extraction confidence, action state, and release metadata.
- [ ] 2.4 Make equivalent panel headings hash through the same policy context while distinguishing stated and policy-derived specimens.
- [ ] 2.5 Integrate one prepared record into Resolver evaluation, decision-trace construction, and writer request generation.
- [ ] 2.6 Add identity unit coverage for provenance, context, nulls, value text, unsupported policy matches, and release-only changes.

## 3. Persistence and service contracts

- [ ] 3.1 Add nullable `input_identity_format_version` persistence beside revision input hashes without rewriting legacy rows.
- [ ] 3.2 Extend trusted writer payloads and database RPC validation for the hash/version pair.
- [ ] 3.3 Add prior/next identity versions and independent input/outcome/release facts to reprocessing rows.
- [ ] 3.4 Propagate prior/next identity versions and change facts through observation change history and its triggers.
- [ ] 3.5 Update TypeScript revision, selector, batch, and history types to read stored identity and release metadata.
- [ ] 3.6 Preserve trace-schema, Resolver, normalization, and Registry-release versions as separate fields.

## 4. Acceptance, correction, and historical restore

- [ ] 4.1 Migrate regular acceptance and automatic verification to the shared prepared evidence and identity seam.
- [ ] 4.2 Migrate current correction and manual-selection evaluation without changing hard-evidence or EH-164 behavior.
- [ ] 4.3 Add an explicit same-source historical-restore path for undo/reversal.
- [ ] 4.4 Copy the target revision's saved decision evidence, trace, hash, identity version, and release metadata during restore.
- [ ] 4.5 Enforce atomic same-source and expected-active checks for restore and reject incomplete historical targets.
- [ ] 4.6 Prove restore does not invoke current Resolver or current panel-specimen policy and leaves prior revisions immutable.

## 5. Reprocessing diff and apply

- [ ] 5.1 Read prior identity, outcome, and release values from the stored active revision and compute next values from current prepared evidence.
- [ ] 5.2 Implement independent `inputChange`, `outcomeChange`, and `releaseChange` facts with unavailable states for incompatible legacy data.
- [ ] 5.3 Define explicit create-revision and activate-revision decisions instead of deriving mutation from hash equality.
- [ ] 5.4 Keep release-only changes audit-only by default and require explicit release-refresh intent for release-only revision creation.
- [ ] 5.5 Preserve existing user-verified and manually-corrected protections in the apply contract.
- [ ] 5.6 Apply eligible rows only through the service-only writer and expected-active CAS boundary.
- [ ] 5.7 Add reprocessing coverage for independent input, outcome, release, legacy, manual-protection, and no-change combinations.

## 6. Candidate corpus integration

- [ ] 6.1 Route candidate corpus fixture adapters through shared prepared evidence and identity generation.
- [ ] 6.2 Keep candidate/release artifact identity separate from prepared input identity in corpus reports.
- [ ] 6.3 Verify corpus/writer identity parity and preserve non-mutating corpus execution.

## 7. Verification and documentation

- [ ] 7.1 Run focused Resolver, preparation, writer, reversal, and reprocessing verification covering all new contract scenarios.
- [ ] 7.2 Run the existing EH-164 regression evidence and confirm accepted text markers remain excluded from numeric score/trend contribution.
- [ ] 7.3 Update affected canonical Registry/biomarker documentation and record the implementation contract accurately.
- [ ] 7.4 Run biomarker documentation generation, checks, tests, Wiki render/staging export, and update the single tracking issue with publication status.
- [ ] 7.5 Validate the completed OpenSpec change with strict validation and review the apply-ready task list.
