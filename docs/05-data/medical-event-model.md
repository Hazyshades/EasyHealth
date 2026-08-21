# Normalized medical-event model

EH-126 gives each source document one profile-scoped medical event and stores source date precision without inventing a calendar day. The model is an API/database contract; this release does not add a timeline screen.

## Context

A document upload has an operational `created_at`, while typed extraction can provide a medical date with year, month, day, or timestamp precision. The worker and older write paths previously used the current day when a source date was missing. The event model separates source facts from upload metadata and keeps complete day projections only for compatibility.

## Problem

Documents, extracted measurements, and observations did not share a stable event identity. Upload order could be mistaken for medical chronology, and partial or missing dates could be silently converted into a fabricated day.

## Root Cause

The existing `documents.observed_at` and observation date fields are nullable day-level projections, not a representation of date precision. Typed pipelines stored dates in type-specific payloads without a common date-role contract.

## Fix

### Database contract

- `public.medical_events` has one row per source document, with `profile_id`, `source_document_id`, controlled `event_type`, and a unique source-document constraint.
- `public.medical_event_dates` stores one row per event/date role: `occurred`, `occurred_end`, `collected`, and `authored`.
- Date `precision` is one of `instant`, `day`, `month`, `year`, or `unknown`. `value_text` is canonical source-shaped text; `raw_text` retains the extracted wording; `timezone` is populated only for explicit timestamp offsets or `Z`.
- Database triggers validate calendar values, derive private ordering bounds, enforce profile/document ownership, and keep unknown dates null-valued.
- `observations.medical_event_id` links document-derived observations to the owning event. `observations.observed_at` is nullable for partial or unknown source dates.
- `public.medical_event_timeline` exposes event and source-document metadata plus occurred-date ordering fields for service-side reads. The internal `occurred_sort_*` fields are ordering implementation details, not clinical dates.

### Worker contract

Typed processing synchronizes the source roles as follows:

| Source type | `occurred` | Additional role |
| --- | --- | --- |
| Laboratory result | extracted `observed_at` | consistent `collected_at` and `reported_at` values |
| Instrumental report | extracted `study_date` | none |
| Consultation note | extracted `visit_date` | none |
| Discharge summary | `admission_date` | `discharge_date` as `occurred_end` |
| Prescription | `prescribed_at` | none |
| Referral | `referral_date` | none |

Only a complete `YYYY-MM-DD` projects to legacy `documents.observed_at`, instrumental snapshots, or normalization writer day inputs. Missing and partial values remain null in those compatibility projections while the event date retains its precision.

### Timeline API

`GET /api/timeline` requires an authenticated profile session. Supported query parameters:

- `direction=asc|desc` (default `asc`); known occurred dates remain before unknown dates in either direction.
- `limit` (default `100`, maximum `200`).
- `offset` (default `0`) for bounded page reads.

The response is `Cache-Control: no-store` and returns `timeline`, `direction`, `limit`, `offset`, and `has_more`. Each timeline item contains event/source-document metadata, public occurred-date fields, all date roles in `dates`, and linked observations in `observations`. Profile scoping is applied before source rows, date rows, and observations are returned. Internal sort bounds are not included in the response.

Known events use lower/upper calendar bounds and explicit instant ordering, followed by fixed `event_type`, source document ID, and event ID tie-breakers. Unknown events use the same fixed non-date keys.

## Verification

- `pnpm test:eh126` — parser, precision boundaries, explicit timezone handling, unknown-date preservation, calendar-day projection, event mapping, and deterministic comparator.
- `pnpm test:eh126-db` — event creation, backfill-compatible ownership, date roles and validation, sync RPC, nullable projections, observation linkage, profile scoping, and deterministic database ordering.
- `pnpm typecheck` — nullable source-date integration across worker, API, review, batch, and reprocessing paths.
- `QA/eh-126/checklist.md` — manual upload checks and the unavailable timeline-UI limitation.

## Deferred behavior

- No dedicated timeline UI is included in EH-126.
- One source document remains one event; splitting multiple encounters inside one document is deferred.
- Legacy observations without a source document remain unlinked and do not receive a synthetic event or date.
