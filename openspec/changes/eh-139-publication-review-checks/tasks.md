## 1. Knowledge Base content contract

- [x] 1.1 Add the typed article, source, lifecycle, freshness-policy, publication-decision, deprecation, and stale-report contracts.
- [x] 1.2 Implement fail-closed validation and public-eligibility helpers with the 365-day review policy and injectable `asOf` timestamp.
- [x] 1.3 Add the version-controlled Knowledge Base registry entry point, preserving an empty public catalog until clinically reviewed article content is supplied.

## 2. Public Knowledge Base surface

- [x] 2.1 Add the server-rendered article component that visibly renders title, last reviewed date, every source link, Markdown body, and medical disclaimer.
- [x] 2.2 Add the public Knowledge Base index and canonical article route with not-found handling for draft, review, stale, and unknown content.
- [x] 2.3 Add safe permanent redirects for deprecated slugs, accepting only fresh internal replacements and falling back to the Knowledge Base index.

## 3. Governance verification

- [x] 3.1 Add the real-registry build check with actionable validation errors and a JSON stale-content report mode.
- [x] 3.2 Add deterministic behavioral verification for lifecycle visibility, required review/source evidence, stale boundaries, deprecation targets, and rendered metadata.

## 4. Build and release integration

- [x] 4.1 Expose Knowledge Base check and verifier package scripts and run the real-registry check before production compilation.
- [x] 4.2 Register the behavioral verifier in the CI workflow and verification-suite policy.
- [x] 4.3 Create `QA/eh-139/checklist.md` with executable interface checks and separate developer evidence for non-UI governance contracts.

## 5. OpenSpec completion

- [x] 5.1 Run focused verification, typecheck/build checks, and strict OpenSpec validation; record only observed results.
