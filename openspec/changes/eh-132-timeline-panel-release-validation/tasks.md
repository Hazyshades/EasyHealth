## 1. Cross-feature fixture validation

- [x] 1.1 Add the deterministic EH-132 synthetic fixture matrix and verification runner for medical-event precision/timezones, Health Timeline ordering/date truthfulness, multi-laboratory compatibility and source preservation, unit conversion guards, panel membership, duplicate validator cases, and existing API/page wiring.
- [x] 1.2 Add the fixed-volume pure timeline projection performance check with warm-up, measured budget, fixture-count output, and failure diagnostics.

## 2. Database and CI release gates

- [x] 2.1 Add the transactional `QA-Db_tests/eh132_timeline_panel_release.sql` fixture covering one-event-per-document, date-role uniqueness/idempotency, partial and explicit-timezone date constraints, profile isolation, and duplicate/ownership rejection.
- [x] 2.2 Register `test:eh132` and `test:eh132-db` in `package.json`, the CI verification-suite policy, and the existing workflow's verify/database jobs so both suites are workflow-reachable.

## 3. Tester-facing release evidence

- [x] 3.1 Create `QA/eh-132/checklist.md` from the roadmap template with synthetic fixture preconditions, Health Timeline and available Biomarkers interface checks, developer evidence, explicit EH-129/panel UI limitations, P0 defect disposition, performance evidence, and product sign-off fields.

## 4. Release-evidence remediation

- [x] 4.1 Preserve explicit row-level specimen provenance when the extraction model omits the structured specimen field, without changing Registry identity or fabricating missing axes.
- [x] 4.2 Add positive and negative parser coverage, regenerate the Registry documentation surfaces, and record the required documentation publication status.
- [x] 4.3 Reprocess the synthetic comparison pair, load the dedicated synthetic browser profiles, and record the completed UI/volume evidence or precise environmental blocker.
- [x] 4.4 Collect release-volume timeline source documents in bounded backend pages and cover the full 2,000-row contract in the EH-132 runner.
