# EH-112: Incomplete laboratory outcomes end to end

**Roadmap status:** In progress
**Build / environment:** Local `Hazyshades/implement-issue-12` worktree on current `origin/master` baseline
**Test run date:** 2026-07-28
**Tester:** Automated developer evidence recorded; manual tester unassigned

## What this checklist covers

EH-112 keeps recognized-but-incomplete, ambiguous, and unknown laboratory results visible without guessing a Registry 2.0 identity. It also keeps those raw results reprocessable while excluding them from definition-specific trends and Health Profile assessment.

## Before you start

- [ ] Use a dedicated test account.
- [ ] Use only the synthetic documents below; do not use real patient data.
- [ ] Confirm each document has finished processing before inspecting its results, except during the reprocess check.
- [ ] Record the current Biomarkers trend selector and Health Profile state before uploading the incomplete fixtures.

## Test data

| ID | Test document or setup | Purpose |
| --- | --- | --- |
| `EH112-RESOLVED-01` | Synthetic reviewed serum ALT result with numeric value, accepted unit, and serum specimen. | Resolved regression path. |
| `EH112-PARTIAL-01` | Synthetic recognized serum glucose label with numeric value but missing required unit. | Missing-context partial state. |
| `EH112-AMBIGUOUS-01` | Synthetic label that matches two reviewed launch definitions with otherwise admissible evidence. | Ambiguous state without candidate selection. |
| `EH112-UNMAPPED-01` | Synthetic laboratory row named `EH112 unknown marker`, with raw value `7 widgets`. | Unmapped raw-evidence path. |
| `EH112-ASSESSMENT-BASELINE` | Test account with a recorded Health Profile state before incomplete fixtures are added. | Assessment exclusion comparison. |

## Interface checks

### EH112-UI-01: Resolved result remains a normal matched measurement

**Precondition:** `EH112-RESOLVED-01` has processed successfully.

1. Go to **Documents**.
2. Open `EH112-RESOLVED-01` and inspect **Extracted biomarkers**.
3. Expand **Technical details** for the ALT row.
4. Go to **Biomarkers** and select ALT in **Trend chart**.

**Expected result:** The document shows `Matched measurement`, preserves the raw value and source, and explains that mapping confidence is classification evidence rather than medical certainty. ALT is available in the trend selector and chart.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

### EH112-UI-02: Partial result preserves raw evidence and missing context

**Precondition:** `EH112-PARTIAL-01` has processed successfully.

1. Open the document in **Documents**.
2. Locate the glucose row in **Extracted biomarkers**.
3. Compare the visible label, value, missing unit, reference text, specimen, page, and source excerpt with the synthetic document.
4. Expand **Technical details**.

**Expected result:** The row shows `More details needed`. The raw result remains visible, **Technical details** names the missing unit/context and candidate count, and no candidate key is presented as the confirmed measurement.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

### EH112-UI-03: Ambiguous result does not choose one candidate

**Precondition:** `EH112-AMBIGUOUS-01` has processed successfully.

1. Open the document in **Documents**.
2. Locate the ambiguous row.
3. Expand **Technical details**.

**Expected result:** The row shows `Multiple possible matches`, explains that no measurement was selected, preserves the source result, and shows only safe reason/candidate-count details rather than one active measurement identity.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

### EH112-UI-04: Unmapped result remains visible

**Precondition:** `EH112-UNMAPPED-01` has processed successfully.

1. Open the document in **Documents**.
2. Locate `EH112 unknown marker`.
3. Compare its raw value, unit, reference text, page, and source excerpt with the fixture.
4. Expand **Technical details**.

**Expected result:** The row shows `Measurement not recognized`. The original result remains visible, no analyte or measurement definition is claimed, and no conversion is applied.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

### EH112-UI-05: Incomplete document can be reprocessed

**Precondition:** Any of `EH112-PARTIAL-01`, `EH112-AMBIGUOUS-01`, or `EH112-UNMAPPED-01` is open.

1. Select **Reprocess document** from the incomplete-result panel.
2. Confirm the document enters processing.
3. Wait for the new run to finish.
4. Reopen the current extracted results.

**Expected result:** Reprocessing queues the whole document without asking for or forcing a candidate mapping. The current result refreshes after processing; the product does not claim that prior raw evidence or normalization history was deleted.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

### EH112-UI-06: Incomplete rows stay visible but do not enter trends

**Precondition:** The partial, ambiguous, and unmapped fixtures have processed.

1. Go to **Biomarkers**.
2. Select the **Needs mapping** filter.
3. Confirm the three incomplete rows are visible with distinct mapping labels.
4. Open **Trend chart** and inspect its selector.

**Expected result:** Incomplete rows remain visible in the table. None appears as a definition-specific trend option or chart series, even when an ambiguous row has high mapping confidence.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

### EH112-UI-07: Incomplete rows do not alter Health Profile assessment

**Precondition:** Record `EH112-ASSESSMENT-BASELINE`, then process only the three incomplete fixtures without adding a new resolved assessment-compatible measurement.

1. Go to **Health Profile** before upload and record visible readiness, confidence, highlighted findings, and system scores.
2. Process and accept the incomplete fixtures as raw results.
3. Return to **Health Profile**.

**Expected result:** The incomplete rows do not add score-ready biomarkers, change readiness/confidence, create highlighted findings, or alter system scores. Existing document provenance may remain visible through normal document interfaces.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

## Developer evidence required

- [x] `pnpm test:eh112` proves four-outcome authoritative serialization, null incomplete identity, candidate-key sanitization, raw-field preservation, consumer exclusion, reprocess request parsing, and metric allowlisting.
- [x] `pnpm typecheck` proves the shared outcome contract is applied consistently across routes and components.
- [x] `pnpm test:document-review` proves the EH-112 English wording and document review control policy.
- [x] `SKIP_ENV_VALIDATION=1 pnpm test:eh106-consumer` proves active-revision and reviewed-binding safety remains intact for trends, reports, structured context, conversion, and assessment.
- [x] `pnpm test:eh111` proves unit, value-kind, specimen, concrete-resolution, and conversion-denial compatibility remains intact.
- [x] `pnpm test:biomarkers` proves existing Biomarkers presentation and Health Profile calculations remain compatible with reviewed resolved bindings.
- [ ] Code review confirms `resolution_outcome` metrics contain no patient/document/observation/revision identifiers, filenames, raw labels/values/units/reference/source text, or candidate keys.
- [ ] Database/reprocess evidence confirms the existing append-only extraction and normalization history contract remains unchanged; EH-112 adds no destructive migration.

## Out of scope or not manually testable yet

- EH-115 owns separately authorized, redacted durable support-trace access. EH-112 shows only the safe user technical-details summary.
- EH-116 owns targeted, bulk, or revision-selective reprocessing. EH-112 uses the existing full-document **Reprocess document** action only.
- Aggregate production metric delivery depends on the deployment log sink and is not manually testable in the product UI; automated payload allowlisting and deployment observability evidence are required.
- Manual checks remain unexecuted until a tester records results; no unchecked interface item is claimed as passed.
