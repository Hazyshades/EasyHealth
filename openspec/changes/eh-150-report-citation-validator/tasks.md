# Tasks: eh-150-report-citation-validator

Domain: **reports**

## 1. Validator core

- [ ] 1.1 Define stable current/recognized/retired validator versions, validation statuses, and issue codes for schema, source identity, profile ownership, scope, source kind, claim support, source-unavailable, and unsafe-content failures.
- [ ] 1.2 Implement the pure contract validator in `src/lib/report-citation-validator.ts` with a batched authorized source resolver.
- [ ] 1.3 Validate EH-148's closed factual-claim templates/parameters, sanitize unsupported factual claims and diagnosis/treatment/urgency/imperative fields into visible machine-generated limitations, retain only explicitly non-factual questions without citations, and omit removed claims from persisted/exported content.
- [ ] 1.4 Return validated content and safe issues without source text, values, tokens, PINs, or cross-profile metadata in errors/logs.

## 2. Validator contract and handoffs

- [ ] 2.1 Publish the generation-boundary validator contract and the handoff contract for EH-148's `public.create_validated_report` RPC; do not edit the EH-148 route, RPC migration, or persistence files.
- [ ] 2.2 Define the validator version/status/issue-code metadata contract consumed by EH-148 for report persistence, including the recognized historical-version compatibility policy; do not implement persistence in EH-150.
- [ ] 2.3 Expose one read-only validation result contract for EH-151 and EH-153; each consumer owns its share/export adapter rejection.

## 3. Verification and handoff

- [ ] 3.1 Add fixtures for valid, missing, unknown, broken, out-of-scope, cross-profile, archived, uncited-claim, adversarial unsafe-content, current-version, recognized-historical-version, and retired/unknown-version cases.
- [ ] 3.2 Verify sanitization does not preserve unsupported factual prose or unsafe directives, removed claims never serialize, current and recognized historical versions pass read/share/export gates, retired/unknown/missing versions fail closed, valid limited reports show `SOURCE_UNAVAILABLE` only for archived/removed sources under active documents, and tombstoned source documents invalidate the complete report before owner/share/export reads.
- [ ] 3.3 Run the EH-150 QA checklist and hand the stable validator interface to EH-151 and EH-153.
