# EH-105: Registry 2.0 observation identity cut-over

**Roadmap status:** Delivered — issue closeout 2026-07-22 (local db waived; CI is database authority)  
**Build / environment:** `________`  
**Test run date:** `________`  
**Tester:** `________`

## What this checklist covers

EH-105 makes instrumental observations safe to reprocess and separates them
from laboratory observations. Through the interface, test the document journey,
retry behavior, and the Health Profile boundary. Internal source identity and
database idempotency require separate automated evidence because the current
interface does not display individual instrumental numeric source-measures.

## Before you start

- [ ] Use a dedicated test account with a known laboratory baseline in
  **Biomarkers** and **Health Profile**.
- [ ] Use only synthetic or de-identified instrumental reports.
- [ ] Record the Health Profile systems/scores and laboratory trends before
  uploading an instrumental-only report.
- [ ] Obtain a controlled test environment for the forced-processing-failure
  check; do not simulate a worker failure in production.

## Test data

| ID | Test document or setup | Purpose |
| --- | --- | --- |
| `INST-NORMAL` | Synthetic imaging or instrumental report with several findings | Normal document journey |
| `INST-REPEAT` | Synthetic report with two distinct but similarly named findings, such as left/right or separate occurrences | Reprocess and non-merging safety |
| `INST-FAILURE` | Controlled environment that fails one instrumental write during processing | Error and retry safety |
| `LAB-BASELINE` | Existing synthetic laboratory report with known Biomarkers/Health Profile output | Boundary regression |

## Interface checks

### EH105-UI-01: Instrumental report displays its source findings

1. Go to **Upload imaging** (or upload an instrumental report from
   **Documents**) and upload `INST-NORMAL`.
2. Wait for processing to finish and open the document in **Documents**.
3. Open **Study findings**.
4. Select each listed finding and compare its text and source page with the
   original report.

**Expected result:** Each visible finding belongs to the uploaded report and
opens the correct source area when available. The document is not shown as a
laboratory biomarker review screen.

**Result:** `Pass | Fail | Blocked | N/A`  
**Notes / evidence link:** `________`

### EH105-UI-02: Normal reprocessing preserves visible findings

1. In `INST-NORMAL`, note the number and text of the visible **Study findings**.
2. Select **Reprocess** and wait for processing to finish.
3. Refresh the browser and reopen the document.

**Expected result:** The document remains available and the expected findings
remain present once each. Reprocessing must not leave the document completed
with all previously visible findings missing.

**Result:** `Pass | Fail | Blocked | N/A`  
**Notes / evidence link:** `________`

### EH105-UI-03: Similar source findings are not visibly collapsed

1. Upload `INST-REPEAT` and open **Study findings** after processing.
2. Confirm that both distinct source findings are listed and that each points
   to its own text/page or side/occurrence in the report.
3. Select **Reprocess**, then refresh and repeat the comparison.

**Expected result:** Both source findings remain distinguishable. The interface
does not collapse them into one card or duplicate them after reprocessing.

**Result:** `Pass | Fail | Blocked | N/A`  
**Notes / evidence link:** `________`

### EH105-UI-04: Instrumental-only data does not become laboratory assessment

1. Record the laboratory trend points and Health Profile systems/scores from
   `LAB-BASELINE`.
2. Upload and process `INST-NORMAL` without uploading any new laboratory data.
3. Open **Biomarkers** and **Health Profile**.

**Expected result:** The instrumental report does not add a laboratory
biomarker, laboratory trend point, or laboratory-derived score by itself. The
application may list the report as a general record; that alone is not a
failure.

**Result:** `Pass | Fail | Blocked | N/A`  
**Notes / evidence link:** `________`

### EH105-UI-05: Failed write is visible and recoverable

1. In the approved controlled environment, process `INST-FAILURE` so that one
   instrumental write fails.
2. Refresh the document page after the processing attempt.
3. Observe the document status and use **Reprocess** after the fault is removed.

**Expected result:** The app does not present a successful completed document
when the new instrumental result was not saved. A failure/needs-review state is
visible or the user can retry. Existing visible findings are not silently
erased, and a successful retry restores a consistent document.

**Result:** `Pass | Fail | Blocked | N/A`  
**Notes / evidence link:** `________`

## Developer evidence required

- [ ] Supply the clean-database migration/reset and pgTAP results proving lab
  and instrumental lineage rules, including one source record per instrumental
  observation.
- [ ] Supply an integration scenario for `INST-REPEAT` that proves distinct
  occurrences stay distinct and repeated processing is idempotent.
- [ ] Supply an integration scenario for `INST-FAILURE` proving a Supabase
  write error blocks completion and preserves prior valid data.
- [ ] Supply the static scan/CI result showing active writers no longer use
  `observations.biomarker_key`, including maintenance scripts.
- [ ] Supply API/read-boundary evidence that Health Profile reads laboratory
  observations only.

## Out of scope or not manually testable yet

- The current UI does not show individual instrumental numeric source-measures;
  their stable identity is proven by the integration evidence above.
- Full instrumental representation in Biomarkers trends, reports, structured
  context, and UI is owned by EH-106 or later roadmap work.
- EH-104 Phase B enforcement and acceptance/correction CAS cut-over are not
  part of EH-105.

## Closeout evidence (2026-07-22)

- OpenSpec change `eh-105-cut-over-observations-to-registry-2-identity` implementation tasks are complete except local disposable db smoke.
- Tasks 4.6 / 5.2 local `supabase db reset` + pgTAP/smoke are **waived on developer workstations without Docker**.
- Database authority: CI `database` job runs `pnpm test:eh105-db` (and related EH-104/EH-106 db contracts on the Phase B PR).
- Static checks such as `pnpm test:eh105` / `check:no-observations-biomarker-key` remain the local no-Docker gate when needed.
- Manual UI checks above remain unmarked until a tester executes them.
