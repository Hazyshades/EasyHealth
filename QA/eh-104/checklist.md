# EH-104: Resolver outcomes separated from verification status

**Roadmap status:** In progress - Phase A delivered; Phase B deferred  
**Build / environment:** `________`  
**Test run date:** `________`  
**Tester:** `________`

## What this checklist covers

EH-104 Phase A establishes safe resolver and verification foundations. The
current product does not yet expose a complete verification-status workflow to
ordinary users. This checklist therefore tests the visible safety boundary and
asks for automated evidence for internal lifecycle rules.

## Before you start

- [ ] Use a dedicated test account and synthetic documents only.
- [ ] Ask the QA lead for one clearly recognized laboratory fixture and one
  partial or ambiguous fixture.
- [ ] Record the baseline Biomarkers and Health Profile state before uploading
  the partial/ambiguous fixture.

## Test data

| ID | Test document or setup | Purpose |
| --- | --- | --- |
| `LAB-RESOLVED` | Synthetic report with one reviewed, unambiguous result | Normal visible flow |
| `LAB-NOT-RESOLVED` | Synthetic partial or ambiguous result | Safety boundary |

## Interface checks

### EH104-UI-01: Recognized result remains consistent after a normal review

1. Upload `LAB-RESOLVED` and open it in **Documents** after processing.
2. Check the result in **Extracted biomarkers** and perform the normal review
   action when it is offered.
3. Refresh the document, then open **Biomarkers**.

**Expected result:** The visible source evidence, document result, and
biomarker row do not contradict one another. Refreshing does not create a
duplicate or a different visible measurement.

**Result:** `Pass | Fail | Blocked | N/A`  
**Notes / evidence link:** `________`

### EH104-UI-02: A non-resolved source does not become a trusted trend

1. Upload `LAB-NOT-RESOLVED` and open the processed document.
2. Compare the source text/value with the original fixture.
3. Open **Biomarkers** and **Health Profile**.

**Expected result:** The document can retain the raw source for review, but it
does not create a new trusted biomarker trend or assessment input solely from
partial or ambiguous evidence.

**Result:** `Pass | Fail | Blocked | N/A`  
**Notes / evidence link:** `________`

### EH104-UI-03: Reprocess does not create contradictory visible state

1. On either test document, choose **Reprocess**.
2. Wait for processing to finish, refresh the browser, and reopen the document.
3. Repeat the relevant check above.

**Expected result:** The document remains usable and its visible source/result
state is internally consistent. If processing needs review, the interface asks
the user to reprocess or review rather than presenting a silently corrupted
accepted result.

**Result:** `Pass | Fail | Blocked | N/A`  
**Notes / evidence link:** `________`

## Developer evidence required

- [ ] Supply the pgTAP/automated contract results for separate resolver outcome
  and verification status, allowed transitions, source/profile ownership, and
  compare-and-swap promotion.
- [ ] Supply a concurrency or service test showing that stale writes cannot
  overwrite a newer review decision and projections remain synchronized.
- [ ] Supply the preflight/read-only verification result for the deployed
  schema.

## Out of scope or not manually testable yet

- Phase B database guards, legacy RPC removal, and enforcement are deferred.
- A full user-facing verification workflow, including correcting incomplete
  acceptance states, is owned by EH-106 and later workflow work.
- Do not require the UI to display internal resolver/verification field names
  in this Phase A checklist.
