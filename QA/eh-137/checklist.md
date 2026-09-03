# EH-137: Add related-measurement graph

**Roadmap status:** In progress
**Build / environment:** Local Next dev server on `http://localhost:3003`; seeded synthetic EH147 Supabase fixture with Mailpit magic-link authentication
**Test run date:** 2026-09-01
**Tester:** Engineering smoke run

## What this checklist covers

This checklist covers the read-only educational relationship section on the
**Biomarkers** surface. It verifies that a selected reviewed measurement can
show curated panel and related-measurement links with visible relationship
labels, while the user's observations, trends, and assessment-related UI stay
unchanged.

The graph is catalog education only. It is not a diagnosis, treatment,
reference-range, or scoring feature.

## Before you start

- [ ] Use a dedicated test account.
- [ ] Use only synthetic or de-identified documents.
- [ ] Confirm the listed test data has finished processing, unless the check
      intentionally tests processing.
- [ ] Confirm the account has at least one current resolved reviewed
      measurement with a curated relationship, such as synthetic ALT serum or
      hemoglobin whole-blood data.

If the last precondition is unavailable, do not invent a result. Mark the UI
checks `Blocked` and attach the developer evidence listed below.

## Test data

| ID         | Test document or setup                                                                    | Purpose                                                  |
| ---------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `EH137-01` | Synthetic laboratory document containing a reviewed `alt_serum_catalytic_activity` result | Normal path: related specimen variant                    |
| `EH137-02` | Synthetic laboratory document containing a reviewed `hemoglobin_whole_blood` result       | Many-to-many path: CBC and iron-studies panel membership |
| `EH137-03` | Synthetic account state with no selected reviewed measurement or no curated edges         | Neutral empty/unavailable path                           |

## Interface checks

### EH137-UI-01: Show labeled curated relationships

**Precondition:** `EH137-01` or `EH137-02` is processed and its result is
visible on the account's **Biomarkers** screen.

1. Go to **Biomarkers**.
2. Select or open the measurement from **test data ID** so it is the selected
   measurement series.
3. Scroll to **Related measurements**.
4. Read each relationship row without using developer tools.

**Expected result:** The section identifies the selected measurement, shows a
visible `Panel member` or `Related measurement` label for each row, gives a
neutral catalog description, and shows the catalog version. The section does
not show diagnosis, treatment, universal range, or disease language.

**Result:** `Pass`
**Notes / evidence link:** The seeded EH147 account showed ALT serum with catalog version `2026-09-01.0`, a required Liver panel edge, and an ALT plasma specimen-variant edge. Hemoglobin showed CBC and Iron studies panel-member edges. All relationship copy remained educational and explicitly non-scoring.

### EH137-UI-02: Follow a measurement relationship

**Precondition:** `EH137-UI-01` passes and the graph contains a measurement
neighbor.

1. Click the linked neighboring measurement in **Related measurements**.
2. Observe the selected measurement and the comparison section.
3. Use the browser Back control.

**Expected result:** The Biomarkers page opens the linked measurement context,
without exposing another account's data. The biomarker table and repeated
measurement comparison remain usable. Back returns to the prior context.

**Result:** `Pass`
**Notes / evidence link:** Clicking ALT plasma updated the URL measurement context and rendered the linked graph with 21 biomarker rows and the repeated-measurement comparison. Browser Back restored the ALT serum context with 21 rows.

### EH137-UI-03: Preserve the primary Biomarkers task

**Precondition:** A relationship graph is visible for `EH137-01` or
`EH137-02`.

1. Search for a different visible measurement.
2. Toggle the **SI** and **US** unit controls, if both are available.
3. Apply and clear a status filter.
4. Reopen the relationship section for the selected reviewed measurement.

**Expected result:** The primary biomarker table and comparison controls keep
their existing behavior. A relationship loading/error/empty state does not
remove observations, change units, or change score/readiness indicators.

**Result:** `Pass`
**Notes / evidence link:** Search for `ALT` reduced the table to one row; clearing it restored 21 rows. The Attention filter showed the existing no-match state while the graph remained visible, and All restored 21 rows. SI and US each retained 21 rows and the graph; SI showed `mmol`, US showed `mg/dL`, and SI was restored.

### EH137-UI-04: Neutral empty or unavailable state

**Precondition:** Use `EH137-03`, or use a test environment with the static
relationship endpoint intentionally unavailable through an approved fault
fixture.

1. Go to **Biomarkers** with no graph-capable selected measurement, or load the
   page during the approved endpoint-failure fixture.
2. Observe the relationship area.

**Expected result:** The page shows no fabricated relationship, or shows a
bounded neutral loading/error/empty message. Existing biomarker results remain
usable. An unavailable endpoint is not reported as a successful feature test.

**Result:** `Pass`
**Notes / evidence link:** CRP rendered the bounded empty message `No curated relationships are available for this measurement yet.` with 21 biomarker rows. An unknown measurement rendered the bounded error `Educational relationships are temporarily unavailable. Your biomarker results are unchanged.` while retaining 21 rows and the Biomarkers page.

## Developer evidence required

- [x] `pnpm test:eh137` passes. This proves curated panel and same-analyte
      edges, versioning, deterministic serialization/digest, invalid-key
      rejection, API-safe JSON, and resolver/assessment independence.
- [x] `pnpm exec tsc --noEmit` passes. This proves the graph route, component,
      and Biomarkers integration compile together.
- [x] The route review confirms it reads only static catalog modules and does
      not query Supabase, profile rows, observations, or documents.
- [x] Engineering review confirms graph lookup is not imported by resolver,
      assessment, score-readiness, or Health Profile projection code.
- [x] Registry documentation commands ran; generated docs are current, the
      generated Wiki staging matches remote Wiki commit
      `66b60b9441a3d2b652b008d2cca4f7588a2d9d52`, and tracker issue #221 records
      the synchronization status.

## Out of scope or not manually testable yet

- EH-133 Knowledge Base content schema and publication metadata.
- EH-134 biomarker article routes, EH-135 panel article pages, and EH-138
  Knowledge Base index/search/cross-links.
- Admin curation screens, database-backed relationship editing, automatic
  relationship discovery, and disease inference.
- The static API contract and assessment-independence assertions are not
  manually testable through product controls; use the developer evidence above.
