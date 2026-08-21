# EH-126: Normalized medical-event timeline

**Roadmap status:** Delivered (implementation evidence recorded; manual UI checks blocked)
**Build / environment:** Local workspace; required Supabase/OpenAI env vars unavailable for Next smoke
**Test run date:** 2026-08-21 release verification; prior clean-database pgTAP evidence recorded 2026-08-16
**Tester:** Automated repository verification; manual tester pending

## What this checklist covers

This checklist covers date-aware document processing for the normalized medical-event model. A source date is shown as a lab/event date only when the extraction provides a complete calendar day; a missing or partial date must not become the upload date.

The current release has no dedicated timeline screen. Timeline ordering, date precision, event ownership, and observation linkage require the developer evidence listed below.

## Before you start

- [ ] Use a dedicated test account and profile.
- [ ] Use only synthetic or de-identified documents.
- [ ] Confirm the listed test data has finished processing, unless the check intentionally tests processing.
- [ ] Record the upload timestamp for comparison only; it must never be used as the medical event date.

## Test data

| ID | Test document or setup | Purpose |
| --- | --- | --- |
| `EH126-DAY-01` | Synthetic lab report with `Collection date: 2026-08-16` and at least one numeric result | Complete day-level date |
| `EH126-PARTIAL-01` | Synthetic report whose only event date is `2026-08` or `2026` | Partial date without invented day precision |
| `EH126-UNKNOWN-01` | Synthetic consultation note with no visit date | Unknown date without upload-date fallback |

## Interface checks

### EH126-UI-01: Complete source day remains the medical date

**Precondition:** The test account is signed in; `EH126-DAY-01` is available locally and contains no real patient data.

1. Go to **Documents**.
2. Upload `EH126-DAY-01` as a laboratory report.
3. Wait until processing finishes.
4. Open the processed document.

**Expected result:** The document displays `Lab date 2026-08-16`. The displayed date matches the synthetic report and not the upload date.

**Result:** `Blocked`
**Notes / evidence link:** Manual upload check is blocked because no real Supabase/OpenAI environment or test session is available; unauthenticated route smoke was run separately and passed.

### EH126-UI-02: Missing or partial source dates do not become upload dates

**Precondition:** The test account is signed in; `EH126-PARTIAL-01` and `EH126-UNKNOWN-01` are available locally and contain no real patient data.

1. Go to **Documents**.
2. Upload `EH126-PARTIAL-01` and wait for processing to finish.
3. Open the processed document and note the `Uploaded` date.
4. Upload `EH126-UNKNOWN-01` and wait for processing to finish.
5. Open the processed consultation note.

**Expected result:** Neither document displays a fabricated `Lab date` equal to its upload date. The upload date may remain visible as upload metadata; it must not be presented as the medical event date. Partial precision must be verified through the developer evidence because this UI displays only complete day-level `observed_at` values.

**Result:** `Blocked`
**Notes / evidence link:** Same environment blocker as EH126-UI-01; no claim of manual upload coverage.

## Developer evidence required

- [x] `pnpm test:eh126` passed: parser, precision boundaries, explicit timezone handling, unknown-date preservation, calendar-day projection, event mapping, and deterministic comparator.
- [x] `pnpm test:eh126-db` passed: event creation, backfill-compatible ownership, date roles and validation, sync RPC, nullable projections, observation linkage, profile scoping, and deterministic database ordering.
- [x] `pnpm typecheck` passed: nullable source-date integration across worker, API, review, batch, and reprocessing paths.
- [x] `/api/timeline` unauthenticated HTTP smoke passed (`GET /api/timeline?limit=1` returned `401 Unauthorized` on the local Next server with placeholder env). Authenticated response shape and no-store header remain environment-dependent until a real session/Supabase configuration is available; static implementation review confirms source-document metadata, public date precision/value fields, all date roles, linked observations, profile scoping, and omission of internal `occurred_sort_*`/`occurred_unknown_rank` fields.
- [ ] Current local `pnpm test:eh126-db` rerun: **Blocked** because the shared local database has a different migration `066_service_role_access_gaps`; resetting it would destroy local test data. The clean-database contract remains required in CI.

## Out of scope or not manually testable yet

- The dedicated timeline UI is not part of this change and must not be marked as manually tested. API and database evidence are required until that interface exists.
- Splitting one source document into multiple encounter events is deferred; this release keeps one event per source document.
- Existing legacy observation rows without a source document remain outside the document-event timeline and do not receive a synthetic event or date.
