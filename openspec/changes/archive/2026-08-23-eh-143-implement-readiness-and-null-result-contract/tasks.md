## 1. Readiness evaluation and result contract

- [x] 1.1 Replace legacy readiness aggregates with typed, ordered `missing` and `invalid` reasons; classify each required group once and reuse that evaluation for strict nullable scoring.
- [x] 1.2 Remove the unreachable soft-score fallback and ensure every unavailable named-system and overall score is `null`, never a partial average or `0`.
- [x] 1.3 Add a pure outdated-assessment transformation and `assessment_freshness` contract that suppresses stale persisted numeric scores while retaining factual evidence.

## 2. Health Profile API and presentation

- [x] 2.1 Apply stale-assessment suppression in `GET /api/health-profile` from the recalculation job state without making the read endpoint perform routine recomputation.
- [x] 2.2 Migrate the Health Profile drawer and overall assessment surfaces to canonical readiness reasons and an explicit updating state for `outdated` assessments.

## 3. Automated verification

- [x] 3.1 Add an EH-143 verification runner covering all eight named systems, missing and invalid groups, alternatives, context-only inputs, null overall threshold, and stale-score suppression.
- [x] 3.2 Register the focused EH-143 command and run it with the affected Health Profile and typecheck regressions.

## 4. Roadmap QA evidence

- [x] 4.1 Create `QA/eh-143/checklist.md` with tester-safe Health Profile checks, explicit unavailable/updating-result expectations, and developer evidence for API and worker-state contracts.
- [x] 4.2 Record EH-143 database-test applicability and existing assessment-job persistence evidence without adding a redundant schema test.
