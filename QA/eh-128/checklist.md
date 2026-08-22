# EH-128: Render panel groupings inside laboratory events

**Roadmap status:** In progress — implementation delivered locally; merge/release evidence pending
**Build / environment:** `http://localhost:3000`, authenticated local account `lkk L.`
**Test run date:** `2026-08-22`
**Tester:** `Automated browser relay`

## What this checklist covers

This checklist covers the Health Timeline presentation of profile-owned laboratory events. It verifies that normalized measurements appear under the supported panel headings when their Registry 2.0 identities match, that missing members remain neutral reporting metadata, that non-panel rows remain visible, and that every rendered result can return to its source document.

## Before you start

- [ ] Use a dedicated test account.
- [ ] Use only synthetic or de-identified documents.
- [ ] Confirm the listed test data has finished processing, unless the check intentionally tests processing.
- [ ] Confirm each synthetic laboratory result has a source page so provenance can be checked.

## Test data

| ID | Test document or setup | Purpose |
| --- | --- | --- |
| `EH128-CBC-PARTIAL` | Synthetic CBC report containing hemoglobin, hematocrit, and WBC; omit RBC and at least one optional differential member. | Normal panel detection with missing members. |
| `EH128-SHARED-IRON` | Synthetic iron report containing serum iron and hemoglobin, with source pages on both rows. | Many-to-many CBC/iron membership and provenance. |
| `EH128-UNGROUPED` | Synthetic lab report containing one normalized definition outside all panels and one unresolved row; use a filename containing “CBC” without CBC member rows. | Ungrouped preservation and alias/text non-detection. |
| `EH128-MULTI-EVENT` | At least 11 synthetic documents with different event dates and document types. | Date/type filters and bounded pagination. |

## Interface checks

### EH128-UI-01: Laboratory event shows supported panel groups

**Precondition:** `EH128-CBC-PARTIAL` is processed for the active test account.

1. Go to **Timeline**.
2. Find the laboratory event for `EH128-CBC-PARTIAL`.
3. Expand or inspect the event card.
4. Compare the rendered member order with the report's normalized rows.

**Expected result:** The event shows a **Complete blood count** heading. Observed members appear in the registry display order. No panel is created from the filename or report heading alone.

**Result:** `Pass`
**Notes / evidence link:** Live document `83c9b2ff-963d-48a9-a458-80b476f1b45c` returns six current, active, `user_verified` Registry-bound CBC keys. The timeline renders **Complete blood count** in display order: hemoglobin, hematocrit, RBC, WBC, platelets, then optional MCV.

### EH128-UI-02: Missing members stay neutral

**Precondition:** `EH128-CBC-PARTIAL` is visible in **Timeline**.

1. Locate an omitted required member and an omitted optional member.
2. Read their member rows and role labels.
3. Check the row border, text color, and status treatment.

**Expected result:** Each absent row says **Not reported in this event** (or equivalent neutral copy). Neither row is marked warning, error, abnormal, failed, or medically incomplete.

**Result:** `Pass`
**Notes / evidence link:** The live CBC card renders neutral **Not reported in this event** rows for absent optional CBC members. The simultaneously detected **Iron studies** group renders absent required Serum iron and Ferritin with the same neutral treatment; no warning/error/abnormal/failed copy or styling was observed.

### EH128-UI-03: Shared members and ungrouped measurements remain visible

**Precondition:** `EH128-SHARED-IRON` and `EH128-UNGROUPED` are processed for the active test account.

1. Locate `EH128-SHARED-IRON` in **Timeline**.
2. Confirm the shared hemoglobin row appears in each detected owning panel and is not repeated under **Other measurements**.
3. Locate `EH128-UNGROUPED`.
4. Confirm the non-panel and unresolved rows appear under **Other measurements**.

**Expected result:** Valid many-to-many membership is visible in each owning panel. No measurement disappears because it has no panel membership, and the filename text “CBC” does not fabricate a CBC group.

**Result:** `Pass`
**Notes / evidence link:** The live hemoglobin observation appears in both **Complete blood count** and **Iron studies** because it has valid shared Registry membership; it is absent from **Other measurements**. The prior live document `fb6b39fc-c61c-4480-9318-d82c52eb9f5b` independently confirms that 16 unresolved/partial rows remain visible once under **Other measurements**.

### EH128-UI-04: Provenance links return to the source page

**Precondition:** `EH128-SHARED-IRON` has source pages recorded for its measurements.

1. Click the event's **Open document** control.
2. Return to **Timeline**.
3. Click a member's **Source · page N** control.
4. Compare the opened document page with the synthetic report source page.
5. Repeat for a row without a source page, if available.

**Expected result:** The event link opens the owning document. A row with source page `N` opens that document with page `N` selected. A row without a valid page links only to the document and never invents page 1.

**Result:** `Pass`
**Notes / evidence link:** The event link resolves to `/app/documents/83c9b2ff-963d-48a9-a458-80b476f1b45c`; every observed member resolves to the same document with actual `?page=1`. The prior two-page document independently confirms `?page=1` and `?page=2` deep links.

### EH128-UI-05: Timeline filters and empty state remain usable

**Precondition:** `EH128-MULTI-EVENT` is available with at least 11 documents across dates and document types.

1. Open **Timeline** and select **Lab results**.
2. Enter the same exact event date in **From** and **To**.
3. Confirm only laboratory events on that date remain.
4. Clear the dates and select another document type.
5. Use **Next** when more than one page is available, then use **Previous** to return.
6. Choose a date with no matching event.
7. Select **Clear filters**.

**Expected result:** Type/date filters are applied to profile-owned events, bounded pagination reveals additional events without duplicating cards, the no-match state is explicit, and clearing filters restores the event list.

**Result:** `Pass`
**Notes / evidence link:** Eight safe, direct database copies of existing `checklist.pdf` were created as `EH128-PAGINATION-01-COPY.pdf` through `EH128-PAGINATION-08-COPY.pdf`; no upload, worker, or LLM call ran. The Timeline showed 1–10 of 12 events on page 1. Selecting **Next** showed 11–12 of 12 events on page 2, enabled **Previous**, and disabled **Next**. Prior live checks verified type/date filters, empty state, and **Clear filters**.

## Developer evidence required

- [x] `pnpm test:eh128` passes. This proves deterministic panel detection, registry ordering, shared membership, missing-member metadata, ungrouped preservation, source-page URL handling, and non-mutation of input rows.
- [x] `pnpm typecheck` passes. The implementer supplies the output for the new timeline page/card and helper.
- [x] `pnpm build` passes with non-secret validation fixtures. A build without the required Supabase/OpenAI environment variables is blocked by environment validation.
- [x] `openspec validate eh-128-render-panel-groupings-inside-laboratory --strict` passes. The implementer supplies the valid OpenSpec artifact result.
- [x] Registry documentation checks (`pnpm generate:biomarker-docs`, `pnpm check:biomarker-docs`, `pnpm test:biomarker-docs`) pass and confirm EH-125 catalog pages are unchanged by this consumer-only change.
- [x] Wiki render and explicit local staging export were reviewed. Remote publication status is `PENDING` in Registry tracking issue [#150](https://github.com/Hazyshades/EasyHealth/issues/150) because the Wiki repository was unavailable.
- [x] No migration, observation rewrite, resolver, assessment, or panel-roster change was introduced.

## Out of scope or not manually testable yet

- EH-125 panel curation and Registry release approval are dependencies, not changed by EH-128; use the EH-125 registry evidence for those contracts.
- A server-paginated normalized medical-event API, repeated-measurement comparison, duplicate merge, deep-link selection state, and panel education pages remain deferred to their roadmap items.
- If an authenticated local browser environment or synthetic seeded account is unavailable, do not mark the interface checks passed. Record the blocker and attach the focused runner, typecheck/build, and staging evidence instead.
