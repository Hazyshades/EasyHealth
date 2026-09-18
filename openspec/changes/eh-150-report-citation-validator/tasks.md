# Tasks: eh-150-report-citation-validator

Domain: **reports**

## 1. Validator core

- [ ] 1.1 Define stable validation statuses and issue codes for schema, source identity, profile ownership, scope, source kind, and claim support failures.
- [ ] 1.2 Implement the pure contract validator in `src/lib/report-citation-validator.ts` with a batched authorized source resolver.
- [ ] 1.3 Sanitize unsupported factual claims into visible machine-generated limitations; retain only explicitly non-factual questions without citations.
- [ ] 1.4 Return validated content and safe issues without source text, values, tokens, PINs, or cross-profile metadata in errors/logs.

## 2. Validator contract and handoffs

- [ ] 2.1 Publish the generation-boundary validator contract and integration instructions for EH-148; do not edit the EH-148 route or persistence files.
- [ ] 2.2 Define the validator version/status metadata contract consumed by EH-148 for report persistence; do not implement persistence in EH-150.
- [ ] 2.3 Expose one read-only validation result contract for EH-151 and EH-153; each consumer owns its share/export adapter rejection.

## 3. Verification and handoff

- [ ] 3.1 Add fixtures for valid, missing, unknown, broken, out-of-scope, cross-profile, archived, and uncited-claim cases.
- [ ] 3.2 Verify that sanitization does not preserve unsupported factual prose and that valid limited reports show limitations.
- [ ] 3.3 Run the EH-150 QA checklist and hand the stable validator interface to EH-151 and EH-153.
