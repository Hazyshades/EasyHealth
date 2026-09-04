## 1. Safety policy and contract

- [x] 1.1 Add `src/lib/knowledge-base/safety-policy.ts` with a narrow copy/metadata audit boundary and stable finding types.
- [x] 1.2 Implement fail-closed detection for prohibited diagnostic/prescriptive claims and external reference-range or assessment fields, preserving excerpts and rule codes.
- [x] 1.3 Add deterministic EH-140 verifier fixtures covering safe education, prohibited claims, numeric/reference-range copy, forbidden metadata, and document-range-only assessment inputs.

## 2. Surface and link audits

- [x] 2.1 Add `scripts/verify-eh140-knowledge-base.ts` to discover future EH-134/EH-135/EH-138 content roots, run the safety policy, and support strict `--require-surface` release mode.
- [x] 2.2 Add conservative Knowledge Base JSX accessibility checks for semantic interactive controls, accessible images, hidden interactive content, and visible focus affordances; report absent UI as dependency-blocked evidence.
- [x] 2.3 Add deterministic local Markdown/MDX link resolution for Knowledge Base files and report missing tracked targets without network calls.

## 3. Verification and release wiring

- [x] 3.1 Add `test:eh140` and strict `check:eh140-kb` package scripts without adding runtime dependencies.
- [x] 3.2 Register the EH-140 suite in `ci/verification-suite-policy.json` and execute the baseline contract in `.github/workflows/measurement-registry.yml`.
- [x] 3.3 Create `QA/eh-140/checklist.md` from the roadmap template with safe synthetic data, copy/source/separation checks, keyboard/screen-reader/mobile/link cases, evidence fields, and explicit blocked dependency cases.
- [x] 3.4 Run the EH-140 verifier, typecheck, CI coverage checks, and relevant documentation-link checks; record observed results and remaining blocked manual evidence in the checklist.
