## 1. Assessment state contract

- [x] 1.1 Add a pure Health Profile assessment lifecycle mapper for current, processing, outdated, and error states, with safe handling for missing job/version metadata.
- [x] 1.2 Extend `GET /api/health-profile` assessment metadata with the derived display state and persisted-version flag without changing stored assessment payloads.
- [x] 1.3 Propagate the lifecycle type through profile and dashboard response types while preserving nullable system scores and strict-readiness details.

## 2. Shared assessment surfaces

- [x] 2.1 Update `OverallAssessmentCard` and the dashboard health-assessment widget to distinguish insufficient evidence from processing, outdated, and error lifecycle states, preserve old scores during updates, and keep non-diagnostic copy visible.
- [x] 2.2 Update body-map badges, connectors, list selectors, and tooltips to render scored versus insufficient evidence neutrally, expose lifecycle context, use em-dash placeholders, and retain accessible keyboard activation/focus semantics.
- [x] 2.3 Harden `HealthProfileDrawer` dialog focus and state copy for scored, insufficient, processing, outdated, and error contexts while preserving readiness explanations and source/deep links.

## 3. Health Profile interaction and responsive behavior

- [x] 3.1 Render the explicit lifecycle notice and retry action on the Health Profile page, pass lifecycle context into the map/drawer, and synchronize direct/deep-linked selections with browser history.
- [x] 3.2 Preserve system selectors, source evidence, disclaimers, and same-origin return paths at mobile widths; reduce narrow-layout map height and prevent horizontal overflow.
- [x] 3.3 Add or update deterministic UI-state verification coverage for lifecycle mapping, neutral insufficient styling/copy, and unchanged strict score/readiness behavior.

## 4. QA and verification

- [x] 4.1 Create `QA/eh-146/checklist.md` with executable manual checks for scored, insufficient, processing, outdated, error, tooltip, keyboard, mobile, disclaimer, and deep-link flows, explicitly marking unavailable fixtures.
- [x] 4.2 Run the EH-146 verification script, targeted Health Profile regressions, and TypeScript checks; fix any regressions caused by the state contract.
- [x] 4.3 Perform an authenticated browser smoke of the available Health Profile map/drawer/deep-link/mobile paths and record pass, blocked, or not-applicable evidence in the checklist. Browser smoke was blocked by missing local environment variables; the checklist records the exact limitation.
