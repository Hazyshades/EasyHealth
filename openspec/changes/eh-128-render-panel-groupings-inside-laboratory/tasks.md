## 1. Laboratory event projection

- [x] 1.1 Add `src/lib/timeline/panel-grouping.ts` with typed observation/member projections, deterministic panel/member/observation ordering, exact definition-key detection, many-to-many assignment, and ungrouped preservation.
- [x] 1.2 Add neutral missing-member metadata and provenance-link helpers that preserve document IDs and only append valid source pages.

## 2. Timeline presentation

- [x] 2.1 Add the laboratory event card that renders panel headings, role/order metadata, observed values, neutral not-reported rows, ungrouped measurements, and source links without clinical warning styling.
- [x] 2.2 Add the authenticated `/app/timeline` page with timeline-event and biomarker API composition, medical-date ordering, document-type/date-range filters, bounded pagination, and loading/error/empty states for all supported event types.
- [x] 2.3 Add the Timeline navigation item and page metadata without changing existing navigation behavior.

## 3. Regression and QA evidence

- [x] 3.1 Add deterministic EH-128 synthetic grouping fixtures and `scripts/verify-eh128-panel-grouping.ts`; expose it as `pnpm test:eh128`.
- [x] 3.2 Create `QA/eh-128/checklist.md` from the roadmap template with synthetic lab data, panel/missing/ungrouped/provenance UI checks, and separate developer evidence requirements.

## 4. Verification and release hygiene

- [x] 4.1 Run the focused EH-128 verification, typecheck, and production build; exercise the timeline route with the available local interface or record the exact environment limitation.
- [x] 4.2 Run OpenSpec validation and the required Registry documentation generation, drift, test, Wiki render/staging, and tracking-status checks; record unchanged/pending publication evidence.
