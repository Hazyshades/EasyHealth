# EH-104: Resolver outcomes separated from verification status

**Roadmap status:** Phase B implemented; operator gate and manual QA pending  
**Build / environment:** `________`  
**Test run date:** `________`  
**Tester:** `________`

## What this checklist covers

EH-104 separates resolver outcome from verification trust and, in Phase B,
enforces that contract in the database. Most Phase B rules are not visible as
field names in the UI. Testers check the safe product boundaries; developers
supply preflight, purge, MATCH FULL, and legacy-RPC evidence.

## Before you start

- [ ] Use a dedicated test account and synthetic documents only.
- [ ] Ask the QA lead for one clearly recognized laboratory fixture and one
  partial or ambiguous fixture.
- [ ] Record the baseline Biomarkers and Health Profile state before uploading
  the partial/ambiguous fixture.
- [ ] Confirm the build under test includes EH-106 writers and EH-104 Phase B
  migration `034_eh104_phase_b_enforcement.sql`.

## Test data

| ID | Test document or setup | Purpose |
| --- | --- | --- |
| `LAB-RESOLVED` | Synthetic report with one reviewed, unambiguous result | Normal visible flow |
| `LAB-NOT-RESOLVED` | Synthetic partial or ambiguous result | Safety boundary |
| `LAB-DELETE` | Synthetic accepted laboratory document the tester may delete | Purge/delete path |
| `INST-NORMAL` | Synthetic instrumental report | Laboratory vs instrumental boundary |

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

### EH104-UI-04: Delete an accepted laboratory document safely

1. Accept at least one result on `LAB-DELETE`.
2. Note the document in **Documents** and any biomarker rows it contributed.
3. Delete the document from **Documents**.
4. Refresh **Documents** and **Biomarkers**.

**Expected result:** The document is gone. The product does not leave a broken
review screen for that document. Biomarker presentation remains internally
consistent for remaining data.

**Result:** `Pass | Fail | Blocked | N/A`  
**Notes / evidence link:** `________`

### EH104-UI-05: Instrumental report stays outside laboratory review semantics

1. Upload `INST-NORMAL` and open it after processing.
2. Inspect **Study findings** when available.
3. Open **Biomarkers** and **Health Profile**.

**Expected result:** The instrumental report does not appear as a laboratory
extracted-biomarker acceptance row and does not by itself create laboratory
trend/score inputs.

**Result:** `Pass | Fail | Blocked | N/A`  
**Notes / evidence link:** `________`

## Developer evidence required

- [ ] **Preflight gate:** `pnpm preflight:eh104` exits 0 on the target clean DB
  and exits non-zero with finding codes when dirty. Persistent environments
  abort without mutation.
- [ ] **Disposable reset contract:** reset refuses without
  `EH104_PHASE_B_DISPOSABLE=1` and `EH104_PHASE_B_ALLOW_RESET=1`; with both set,
  `pnpm reset:eh104-phase-b` clears document-derived laboratory lineage only.
- [ ] **Static legacy RPC ban:** `pnpm check:no-legacy-promotion-rpc` passes.
- [ ] **Phase B boundary:** `pnpm test:eh104` passes (guard attachment, MATCH
  FULL deferred pair, purge wiring, writer v2-only, delete path).
- [ ] **Database fixtures:** `pnpm test:eh104-db` after local/CI
  `supabase db reset` covers attached guards, half-link rejection, purge full
  null pair, direct revision-delete denial, legacy RPC absence, and EH-106
  writer success.
- [ ] **Document delete:** owner delete calls
  `purge_document_derived_laboratory_lineage` before `documents.delete`;
  unauthorized delete remains denied.
- [ ] **Worker lab reprocess:** laboratory clear supersedes extracted rows and
  does not delete-then-orphan revision lineage; instrumental path unchanged.
- [ ] **Reviewed maturity:** acceptance/correction still reject non-reviewed
  concrete definitions before persistence.
- [ ] Typecheck / focused EH-105 and EH-106 regressions recorded when run.

## Local / CI verification record

- [x] Static: `pnpm test:eh104` / `check:no-legacy-promotion-rpc` (run during
  implementation).
- [ ] `pnpm test:eh104-db` on Docker-enabled host or CI `database` job.
- [ ] `pnpm preflight:eh104` against a clean disposable database.
- [ ] Operator smoke after enforcement: delete, accept resolved, accept partial,
  instrumental upload.

## Out of scope or not manually testable yet

- Internal field names (`verification_actor_type`, MATCH FULL, deferred
  constraints) are not required in the UI.
- Incomplete-outcome presentation polish remains EH-112.
- Record rejection workflow, batch idempotency, and auto-verify activation
  remain EH-120.
- Scoring eligibility is intentionally unchanged by EH-104.
- Do not mark manual checks passed until a tester records a result.
