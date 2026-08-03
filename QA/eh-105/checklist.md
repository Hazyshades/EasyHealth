# EH-105: Registry 2.0 observation identity cut-over

**Roadmap status:** In progress — PR2 atomic publication corrective work (Sprint 1 remediation); production/Sprint 1 closure remains pending mandatory gates  
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

### EH105-UI-06: Unchanged reprocess stays coherent

**Precondition:** `INST-NORMAL` has finished processing and shows findings plus summary.

1. Note the visible **Study findings** text and the document summary text.
2. Note the provider/facility label shown on the document (lab/provider line).
3. Select **Reprocess** without changing the source file.
4. Wait for processing to finish, refresh, and reopen the document.

**Expected result:** Findings, summary, and facility/provider label remain present and still belong together. The document does not complete with a new summary while old findings are missing, or with old findings while the summary is blank.

**Result:** `Pass | Fail | Blocked | N/A`  
**Notes / evidence link:** `________`

### EH105-UI-07: Changed reprocess switches one coherent version

**Precondition:** Controlled environment can feed a changed extraction for the same document (or upload a revised synthetic report and reprocess).

1. Record the current findings text and summary for `INST-NORMAL` or `INST-REPEAT`.
2. Trigger processing that produces different findings/summary for that document.
3. Wait for completion, refresh, and reopen **Study findings**.

**Expected result:** The newly visible findings and summary match each other. The interface must not mix the previous findings with the new summary (or the reverse).

**Result:** `Pass | Fail | Blocked | N/A`  
**Notes / evidence link:** `________`

### EH105-UI-08: Failure before publish keeps the prior coherent version

**Precondition:** Controlled environment for `INST-FAILURE` where processing fails after a prior successful version exists.

1. Confirm `INST-NORMAL` (or an earlier successful run) shows findings and summary.
2. Force a processing failure before the new version is published.
3. Refresh the document page.

**Expected result:** The document is not shown as successfully completed with the new version missing. Previously visible findings/summary remain coherent, or a recoverable failure/needs-review state is visible for retry.

**Result:** `Pass | Fail | Blocked | N/A`  
**Notes / evidence link:** `________`

## Developer evidence required

- [ ] Supply the clean-database migration/reset and pgTAP results proving lab
  and instrumental lineage rules, including one source record per instrumental
  observation.
- [ ] Supply PR2 pgTAP evidence (`pnpm test:eh105-db`, `pnpm test:pr2-db`) for
  claim/attempt transitions, prepare/finalize same-hash matrix including
  `A → B → A`, write_generation increment vs idempotent replay, grants, and
  the security_invoker findings view.
- [ ] Supply an integration scenario for `INST-REPEAT` that proves distinct
  occurrences stay distinct and repeated processing is idempotent.
- [ ] Supply an integration scenario for `INST-FAILURE` proving a prepare or
  finalize failure blocks completion and preserves the prior current
  publication.
- [ ] Supply disposable-reset guard evidence: `pnpm reset:eh105-pr2` refuses
  without `EH105_PR2_DISPOSABLE` + `EH105_PR2_ALLOW_RESET`, and retained
  preflight aborts ambiguous rows.
- [ ] Supply the static scan/CI result showing active writers no longer use
  `observations.biomarker_key`, including maintenance scripts.
- [ ] Supply API/read-boundary evidence that Health Profile reads laboratory
  observations only.
- [ ] Local workstation note: if Docker/WSL is unavailable, database suites are
  **Blocked** here and CI `database` remains the authority. Do not mark them
  Pass locally without evidence.

## Out of scope or not manually testable yet

- PR3 durable deletion leases/tombstones and PR4 strict observation
  provenance are out of scope for this PR2 checklist.
- The current UI does not show individual instrumental numeric source-measures;
  their stable identity is proven by the integration evidence above.
- Full instrumental representation in Biomarkers trends, reports, structured
  context, and UI is owned by EH-106 or later roadmap work.
- EH-104 Phase B enforcement and acceptance/correction CAS cut-over are not
  part of EH-105.

## Closeout evidence

- Original EH-105 cut-over landed earlier; this checklist now also covers PR2
  (`make-instrumental-publication-atomic`) coherent publication behavior.
- Production / Sprint 1 closure stays pending until PR2 mandatory gates pass:
  migrations 036/037, worker cutover, pgTAP suites, and smoke evidence.
- Local `supabase db reset` / `supabase test db` may be unavailable without
  Docker/WSL; CI database jobs remain the authority in that case.
- Static local gate: `pnpm test:eh105` (and related typechecks) can still run
  without Docker.
- Manual UI checks above remain unmarked until a tester executes them.
