## 1. Health Profile reported-results contract

- [x] 1.1 Extend Health Profile result and display-state types with `reported_results` and `reported_but_not_scoreable` without changing score, readiness, or freshness fields
- [x] 1.2 Load current profile-owned processed extracted rows with stable source ids in the Health Profile snapshot path and correlate them to existing observations
- [x] 1.3 Implement the pure reported-results projection using existing laboratory outcome and assessment-eligibility helpers with exclusive safe reason buckets
- [x] 1.4 Apply display-state precedence for onboarding, no recognized biomarkers, reported but not scoreable, and body map while preserving existing score boundaries
- [x] 1.5 Serialize the reported-results summary through `GET /api/health-profile` and preserve profile ownership and authorization behavior

## 2. Health Profile and dashboard recovery experience

- [x] 2.1 Add the reported-but-not-scoreable Health Profile notice with factual counts, preserved-value explanation, review-results link, and clearer-report action
- [x] 2.2 Render the reported-results notice alongside mixed body-map coverage without replacing existing system scores or readiness explanations
- [x] 2.3 Update the dashboard health-assessment widget to distinguish processing, no recognized results, reported-but-not-scoreable, and score-available states using the shared summary
- [x] 2.4 Remove duplicate-upload wording from the dashboard path when processed documents already contain reported rows and keep links session-authorized

## 3. Raw evidence and extraction seam

- [x] 3.1 Align extraction pipeline row types and persistence mapping so stated section context, raw values, units, ranges, confidence, and model provenance are preserved verbatim or explicitly absent
- [x] 3.2 Ensure the observations-only document review fallback exposes extraction confidence and uses the same raw-evidence rendering contract as extracted rows
- [x] 3.3 Add a deterministic prompt-to-persistence seam assertion proving captured context survives mapping and absent context cannot unlock a specimen or other clinical axis

## 4. Regression hardening

- [x] 4.1 Extend document-review verification to cover stable hook order across loading, error, empty, and loaded transitions
- [x] 4.2 Extend batch verification coverage to prove operation initialization precedes row processing and initialization failure fails closed without row mutation
- [x] 4.3 Add unknown-date drawer coverage for one semantic freshness label, one factual explanation, and no duplicate date-unavailable copy
- [x] 4.4 Register every new verifier in the CI verification-suite policy and keep the checks runnable without unrelated external secrets

## 5. Evidence and release synchronization

- [x] 5.1 Add focused contract coverage for zero, mixed, and all-ready reported-result summaries and the four display states
- [x] 5.2 Run typecheck, focused health-profile/document/batch verifiers, and the relevant database checks against local Docker Supabase; record exact results and limitations
- [x] 5.3 Update `QA/eh-147/` or the applicable roadmap QA checklist with preconditions, product-interface steps, developer evidence, and any blocked interface evidence
- [x] 5.4 Run Registry documentation generation, drift checks, and contract tests; render the Wiki staging export and update the single Registry documentation tracking issue with publication status
- [x] 5.5 Validate the completed OpenSpec change and confirm deferred #111 panel-policy work and #127 reported-results ownership are not described as implemented
