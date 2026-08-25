# EH-132: Timeline and panel release validation

**Roadmap status:** Accepted — Health Timeline beta release evidence is complete, Registry Wiki publication is verified, and the product/QA release disposition was user-approved on 2026-08-22
**Build / environment:** Local Next.js server at `http://localhost:3000`, copied app/worker environment, local Supabase, Mailpit, headless Chromium at 1365×768 (device scale 1.25)
**Test run date:** 2026-08-22
**Tester:** Engineering automation

## What this checklist covers

EH-132 is the P0 release gate for the Health Timeline beta. It joins the existing timeline/event-date contracts with repeated laboratory comparison and static panel membership evidence, covering event ordering, partial and timezone-qualified dates, compatible multi-laboratory points, duplicate boundaries, and responsiveness at a documented synthetic volume.

This checklist does not certify a panel screen or the full EH-129 comparison UI: no panel interface is present in this checkout, and the existing Biomarkers page exposes trend selection and unit display but not a dedicated comparison date selector. Those limits are recorded as blocked or out of scope rather than treated as passing results.

## Before you start

- [ ] Use a dedicated EasyHealth test account with one active profile and no real patient data.
- [ ] Use only synthetic or de-identified documents and laboratory rows.
- [ ] Confirm the exact build, deployment URL, browser/version, viewport, and tester identity in the header.
- [ ] Use the generated synthetic timeline pack under `QA/eh-132/fixtures/`: the six `EH132-TIMELINE-01-*.pdf` files plus `EH132-TIMELINE-02-UNKNOWN-DATE.pdf`.
- [ ] Give the timeline documents explicit medical dates in different months; keep the unknown-date fixture undated; keep upload timestamps different from medical dates.
- [ ] Use `EH132-COMPARE-01-LAB-A-2026-08-13.pdf` and `EH132-COMPARE-01-LAB-B-2026-08-15.pdf` for the compatible pair, plus `EH132-COMPARE-02-CONTROLS-2026-08-16.pdf` for RDW/specimen/unresolved/ineligible controls.
- [ ] Finish processing for normal-path fixtures before starting interface checks. Keep one safe processing/failed fixture only if the environment can create it without real data.
- [ ] Use `EH132-PERF-01.json` as the deterministic 2,000-event seed definition only in an environment approved for performance testing; do not create that volume from production records.

## Test data

| ID | Test document or setup | Purpose |
| --- | --- | --- |
| `EH132-TIMELINE-01` | Six synthetic documents covering lab, instrumental, consultation, discharge, prescription, and referral with explicit dates. | Cross-feature event-type and chronological ordering matrix. |
| `EH132-TIMELINE-02` | One supported synthetic document with no explicit medical date and a later upload timestamp. | Unknown-date truthfulness and no upload-date substitution. |
| `EH132-COMPARE-01` | Two synthetic laboratory sources containing the same reviewed concrete definition in accepted native units, with values, reference bounds, laboratory names, and source document IDs. | Compatible multi-laboratory series and source/range retention. |
| `EH132-COMPARE-02` | Synthetic RDW-CV/RDW-SD, serum/plasma or urine conflict, unresolved, and ineligible rows. | Incompatible-series separation and exclusion. |
| `EH132-PANEL-01` | Checked-in Registry 2.0 panel catalog and the static panel verification runner. | Six-panel membership, ordering, duplicate rejection, and many-to-many lookup. Not a UI fixture. |
| `EH132-PERF-01` | Deterministic 2,000-event synthetic profile fixture. | Bounded pure projection benchmark and authenticated timeline responsiveness. |

## Interface checks

### EH132-UI-01: Review the integrated Health Timeline matrix

**Precondition:** `EH132-TIMELINE-01` is processed for the active test profile and `EH132-TIMELINE-02` is present.

1. Open **Health Timeline** from the authenticated application navigation.
2. Confirm the active profile label is visible.
3. Review the cards from top to bottom and compare their displayed dates with the explicit medical dates in `EH132-TIMELINE-01`.
4. Locate `EH132-TIMELINE-02` and inspect its date label.
5. Activate **Open source** for one laboratory card and one typed event card.

**Expected result:** The six supported event types appear in newest-first medical-date order; the undated card remains visible with an unknown-date label after dated events; no card uses upload time as its medical date; and each source action opens the matching original document for the active profile.

**Result:** `Pass` — the six supported event types and undated card rendered in chronological order, and the unknown-date card’s **Open source** action opened its matching document.
**Notes / evidence link:** On 2026-08-22, the authenticated EH132 Release QA profile returned 12 events. The timeline displayed laboratory, instrumental, consultation, discharge, prescription, and referral cards followed by `EH132-TIMELINE-02-UNKNOWN-DATE.pdf` with `Date not available` and `Medical date not recorded`. Activating that card’s visible **Open source** link navigated to `/app/documents/2c6f4265-3f31-4db8-ac99-6f8c75d0e72a`, whose review workspace showed the same synthetic filename and no medical date.

### EH132-UI-02: Verify inclusive filters and stable timeline navigation

**Precondition:** `EH132-TIMELINE-01` contains known dates inside and outside a chosen range, and the active profile has more than one timeline page or an approved safe fixture can provide it.

1. Open **Health Timeline**.
2. Select one supported value in **Document type** and record the visible result count.
3. Enter boundary dates in **From** and **To** that include one event on each boundary.
4. Review the cards and then select **Next** and **Previous** when available.
5. Clear the type and date controls.

**Expected result:** The type filter returns only that document type; both date boundaries are included; the unknown-date card is excluded while a date range is active; changing a filter returns to page one; and adjacent pages do not repeat cards.

**Result:** `Pass` for filter and pagination behavior; the full six-type matrix is now available.
**Notes / evidence link:** The authenticated UI sweep returned `1–10 of 22` for **Lab results**, and `1–1` for **Imaging study**, **Consultation**, **Discharge summary**, **Prescription**, and **Referral**. **Consultation** displayed the unknown-date fixture with `Date not available`; **Clear filters** restored `All document types` and `1–10 of 27`. The previously executed inclusive `From=2026-08-13` / `To=2026-08-13` check returned both boundary-day events and excluded unknown-date data; pagination had zero overlap between adjacent pages.

### EH132-UI-03: Review compatible laboratory points and preserved source evidence

**Precondition:** `EH132-COMPARE-01` and `EH132-COMPARE-02` are processed for the active profile, and the existing Biomarkers page is available.

1. Open **Biomarkers**.
2. Find the two rows from `EH132-COMPARE-01` and review their displayed values, units, reference ranges, laboratory/source names, and source-document links.
3. Open the **Trend chart** selector and select the concrete definition represented by the two compatible rows.
4. Review the plotted points and then inspect the `RDW-CV` and `RDW-SD` rows from `EH132-COMPARE-02`.
5. Select **SI** and then **US** in the **Units** controls.

**Expected result:** The compatible rows retain their original source documents and document-native reference bounds; the selected series contains only the same concrete definition's eligible numeric points; RDW-CV and RDW-SD are not combined; unresolved/ineligible rows do not enter a trend; and changing display units does not erase the lab-native value/unit evidence or source link.

**Result:** `Pass` — the compatible pair was reprocessed with row-level specimen provenance, accepted, rendered as two source-preserving Hemoglobin points, and remained separate from RDW-CV/RDW-SD.
**Notes / evidence link:** On 2026-08-22, `GET /api/documents/<id>/biomarkers` for each `EH132-COMPARE-01` source returned four active, accepted rows with `specimen=whole_blood`, `normalization.result=resolved`, and captured source text. `/app/biomarkers` rendered both dates and source links; SI displayed the B source as `142 g/L` with `Lab: 14.2 g/dL`, and US displayed the A source as `15 g/dL` with `Lab: 150 g/L`. The Hemoglobin trend showed `2026-08-13` and `2026-08-15`; API evidence retained distinct `hemoglobin_whole_blood`, `rdw_cv`, and `rdw_sd` definition keys.

### EH132-UI-04: Verify incomplete-data and recovery behavior

**Precondition:** Use a dedicated profile with no supported timeline events for the empty state; use the filter combination from `EH132-TIMELINE-01` for filtered-empty; use a safe processing/failure fixture only when the environment supports it.

1. Open **Health Timeline** for the empty profile.
2. Confirm the no-data message and select **Upload document**.
3. Return to the populated profile and apply a type/date combination that matches no event.
4. Select **Clear filters**.
5. If a safe processing or request-failure fixture is available, reload the page while it is pending or failed and select the offered retry action.

**Expected result:** The empty state offers upload; the filtered-empty state offers clear filters; loading is not reported as empty; and a failure offers an actionable retry without claiming a false successful projection. If the environment cannot safely produce a failure, record this case as Blocked or N/A with the missing fixture.

**Result:** `Pass` — the dedicated empty synthetic profile rendered the true empty state and its upload recovery, while the populated-profile filtered-empty, loading, and retry checks remain green.
**Notes / evidence link:** On 2026-08-22, a new `EH132 Empty QA` profile with no documents opened `/app/timeline` and displayed `No timeline events yet` plus `Upload a medical document to start building your chronological health record.` Its visible **Upload document** link navigated to `/app/upload`. The populated-profile evidence remains: a no-match filter showed **Clear filters**, delayed `/api/timeline` rendered loading skeletons without a false empty/error claim, and a synthetic `503` showed **Timeline unavailable** with **Try again**, whose retry restored the timeline.

### EH132-UI-05: Check responsiveness at the approved release volume

**Precondition:** `EH132-PERF-01` has been loaded into a dedicated synthetic profile in an approved environment, and the release owner has recorded the target response budget.

1. Open **Health Timeline** for the synthetic profile.
2. Record the time or approved performance evidence for initial rendering.
3. Apply a document-type filter and a date range.
4. Move to the next page and return to the first page.
5. Record any visible delay, error, blank state, repeated card, or browser unresponsiveness.

**Expected result:** The timeline remains usable at the agreed product volume, filters and pagination complete without stale or duplicated cards, and no P0 responsiveness defect is observed. Do not mark this check passed from the 2,000-event Node benchmark alone; attach the approved environment evidence.

**Result:** `Pass` for the controlled local browser volume check — the dedicated `EH132 Performance QA` profile rendered all 2,000 events.
**Notes / evidence link:** On 2026-08-22, initial navigation to `/app/timeline` reached `Showing 1–10 of 2000 events` in `1843.02 ms`. The `Lab results` type filter returned `1–10 of 334`; an inclusive `2025-12-01`–`2025-12-31` range returned `1–10 of 10`; and Next rendered `11–20 of 334` on page two. This is controlled local evidence, not an inferred production SLA or product-owner sign-off.

## Developer evidence required

- [x] Engineering provides `pnpm test:eh132` output showing the deterministic date, timeline, comparison, unit, panel, duplicate, wiring, and 2,000-event projection/page-collection checks passed. Latest run on 2026-08-22: `dates=8`, `timelineEvents=2`, `comparisonRows=7`, `panels=6`, `performanceEvents=2000`, `performancePageRequests=5`, `performanceMs=6.39`.
- [x] Engineering provides `pnpm test:eh132-db` output showing the transactional 27-test event/date uniqueness, idempotency, partial/instant validation, profile-isolation, and ownership fixture passed against the local disposable database. On 2026-08-22: `Files=1, Tests=27, Result: PASS`.
- [x] Engineering provides `pnpm check:ci-suite-coverage-contract` and `pnpm check:ci-suite-coverage` output showing both EH-132 suites are workflow-reachable with no orphaned or partial suites. On 2026-08-22: contract checks passed; `68 covered, 0 local-only, 0 orphaned, 0 partial, 0 invalid`.
- [x] Engineering provides dependency evidence: `pnpm test:panel-registry`, `pnpm test:eh126`, and `pnpm test:eh127` passed on 2026-08-22; panel registry reported `6 panels, 64 memberships`. `pnpm test:multilingual` and `pnpm exec tsx --env-file=.env scripts/verify-stated-axis-evidence.ts` also passed, including the positive captured-specimen and negative unstated-axis paths.
- [x] Registry documentation synchronization completed and was published: `pnpm generate:biomarker-docs`, `pnpm check:biomarker-docs`, `pnpm test:biomarker-docs`, and `pnpm render:biomarker-wiki` passed on 2026-08-22. The generated lifecycle page is published at [Biomarker Architecture](https://github.com/Hazyshades/EasyHealth/wiki/Biomarker-Architecture) in Wiki commit `347068a02c5a646954b7173261001702ba14bc4a`; tracking record [#168](https://github.com/Hazyshades/EasyHealth/issues/168) is closed.
- [x] `pnpm typecheck` and `openspec validate eh-132-timeline-panel-release-validation --type change --strict` passed on 2026-08-22.
- [x] Generated and validated the synthetic fixture pack with `pnpm test:eh132-fixtures`: 10 valid PDFs, six timeline event types, two compatible comparison sources, control rows, and `EH132-PERF-01.json` with 2,000 deterministic events. Files are under `QA/eh-132/fixtures/`; no real patient data is included.
- [x] Latest authenticated browser runs against dedicated synthetic profiles passed: six-type ordering and the unknown-date source link; reprocessed/accepted A/B comparison provenance, source links, native SI/US evidence, and two-date Hemoglobin trend; an empty-profile upload recovery; and 2,000-event initial rendering, type/date filters, and pagination.
- [x] Environment smoke passed without exposing secret values: the parent `.env base` was copied to the app `.env`, `.env worker` to `worker/.env`; Next reported `.env` loaded, and `worker/src/env.ts` loaded successfully with the worker overlay.
- [x] Product/QA release disposition: no P0 defect was observed in the controlled evidence; the user explicitly approved the P0-free disposition and product/QA sign-off on 2026-08-22.

## Release-gate disposition

**Automated contract evidence:** `Pass` — EH-132 runner, 27-test database fixture, dependency suites, CI coverage, typecheck, and strict OpenSpec validation passed on 2026-08-22.
**Manual interface evidence:** `Pass` for the currently delivered Health Timeline and Biomarkers surfaces — six-type order, unknown-date source navigation, compatible two-source trend, native unit evidence, empty/filtered-empty/loading/retry states, filters, pagination, and local volume behavior.
**Performance evidence at agreed product volume:** `Pass` in the controlled local browser — 2,000 events rendered in 1843.02 ms with working type/date filters and page two. This is not a production SLA.
**Open P0 defects:** `None observed in controlled evidence` — the user approved the P0-free release disposition on 2026-08-22.
**Product owner / QA sign-off:** `Approved` — explicit user authorization recorded on 2026-08-22.
**Health Timeline beta gate:** `Accepted` — technical, documentation-publication, and explicit product/QA sign-off evidence are complete.

### P0 defects and retests

No P0 defects were observed in the controlled EH-132 evidence. User approval on 2026-08-22 records the P0-free release disposition and product/QA sign-off; the linked browser, database, and automated evidence above remains the retest record.

## Out of scope or not manually testable yet

- EH-125 has no panel screen or patient-specific panel membership interface in this checkout. Panel membership, duplicate rejection, manifest sensitivity, and resolver/scoring independence require `pnpm test:panel-registry` and the EH-132 runner; do not mark a panel UI case as passed.
- The full EH-129 comparison scope (dedicated comparison surface, date selector, and any chart-level source/range interaction not present in the current Biomarkers page) is not invented by EH-132. Record those cases as **Blocked** until EH-129 exposes the interface and attach the missing dependency/evidence.
- Timezone, partial-date, duplicate, profile-isolation, and API authorization contracts are not manual UI assertions. Use the developer evidence commands and database fixture; do not require a tester to use SQL or browser developer tools.
- If no authenticated deployment, synthetic fixture loader, safe failure fixture, or product approver is available, record the affected case as **Blocked/Pending** with the exact prerequisite and required handoff. Do not report the Health Timeline beta as accepted from static inspection or isolated unit output.
