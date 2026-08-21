## Context

The authenticated Next.js app already has separate `/app/documents` and `/app/biomarkers` screens. A document row is profile-owned and carries the document type, optional `observed_at`, upload timestamp, and source identity. Typed extraction tables carry event-specific dates and details for instrumental findings, consultation/discharge notes, prescriptions, and referrals. Laboratory measurements are stored in `observations` and linked to extracted biomarker rows; existing read boundaries define which laboratory rows are current.

EH-126 is an open dependency for a normalized medical-event model, but no `medical_events` table or read model exists in this checkout. EH-127 therefore needs a read-only projection over current stores, with a seam that can be replaced by the normalized model later. The page must remain profile-scoped, avoid exposing another profile's source rows, and must not turn an upload timestamp into a medical event date.

## Goals / Non-Goals

**Goals:**

- Provide one chronological `/app/timeline` view for the six roadmap event types: laboratory, instrumental, consultation, discharge, prescription, and referral.
- Expose current laboratory measurements and accepted typed extraction details when available, while retaining a source-document link for every event.
- Support document-type filtering, inclusive event-date range filtering, deterministic newest-first ordering, and bounded pagination after filtering.
- Show the active profile, and provide explicit loading, error/retry, no-data, and no-matching-results states.
- Preserve unknown dates as unknown and keep the API contract easy to migrate to EH-126.

**Non-Goals:**

- Do not add or mutate a normalized medical-event database model; that belongs to EH-126.
- Do not change document processing, extraction, observation acceptance, biomarker resolution, scoring, or Health Profile behavior.
- Do not include DICOM as a timeline event until it has an event projection and source experience.
- Do not infer dates from filenames, upload time, current time, or unstructured text.
- Do not add editing, deletion, document upload, export, or cross-profile timeline sharing.

## Decisions

### 1. Use a profile-scoped projection endpoint over existing stores

Add `GET /api/timeline` and keep event assembly in a pure `src/lib/timeline.ts` module. The route authenticates with `getSessionProfileId()`, loads only rows belonging to that profile, and joins documents to current laboratory observations plus accepted typed extraction rows. The module owns normalization, date precedence, filtering, ordering, and pagination so the UI and focused verification exercise one contract.

**Alternatives considered:**

- Querying each existing endpoint from the browser would duplicate joining and date rules in the client and could produce inconsistent pagination.
- Adding a new database view/table before EH-126 would create a competing event model and migration dependency for a frontend roadmap item.

### 2. Model one timeline event per source document

A source document is the stable card and navigation boundary. A laboratory card includes a bounded list of current measurements and a count; other cards include the accepted structured details available for their type. Every card carries `documentId` and `/app/documents/<id>` as its source link.

**Alternatives considered:**

- One card per observation would flood the timeline for a single lab report and lose the document-level source context.
- One card per extraction row would omit documents that have no accepted extraction yet and would make processing/error states harder to represent.

### 3. Use explicit date precedence and unknown-date ordering

The projection exposes `eventDate: string | null` and `datePrecision: "day" | "unknown"`. Date precedence is type-specific: laboratory and instrumental events use the document date, consultation uses `visit_date`, discharge uses `discharge_date`, then `admission_date`, prescription uses `prescribed_at`, and referral uses `referral_date`; each type may fall back to the document's explicit `observed_at` when the type-specific date is absent. A missing value remains `null` and is displayed as `Date not available`. Sorting is event date descending, dated events before undated events, then `created_at` descending and stable document id ascending.

**Alternatives considered:**

- Falling back to `created_at` would make upload order look like medical chronology and violate EH-126's no-invented-precision policy.
- Locale-formatted strings cannot be sorted reliably; the API keeps ISO day strings and the client formats them for display.

### 4. Filter and paginate the normalized projection

The route validates `type`, `from`, `to`, `page`, and `pageSize`, builds the complete profile-scoped projection, applies the type/date filters to normalized events, sorts, then slices the requested page. It returns `total`, `page`, `pageSize`, and `hasNext`. The page resets to page one whenever a filter changes and disables pagination controls while loading.

**Alternatives considered:**

- Filtering only `documents.observed_at` would exclude valid typed event dates and make the date filter misleading.
- Client-only pagination would transfer unbounded private data and make future replacement by EH-126 harder.

### 5. Keep the page in existing app-shell conventions

Add a `Health Timeline` nav item and page metadata using the existing animated icon and `PageHeader`, `SurfaceCard`, `Select`, `Button`, `Skeleton`, and `StatusChip` components. The active profile label comes from the same authenticated profile row used by the shell. Cards use ordinary Next `Link` navigation to the document viewer, with keyboard-visible focus and descriptive accessible labels.

**Alternatives considered:**

- A new shell or custom design system would duplicate established layout and accessibility behavior.
- Opening signed storage URLs directly would bypass the document viewer's ownership and source-review controls.

## Risks / Trade-offs

- The projection currently reads all profile-owned documents before filtering, so very large histories will need indexed normalized events or a database-backed EH-126 read model. The API keeps page slicing bounded but does not claim an unbounded-scale solution.
- Typed extraction rows can be absent while a document is processing or extraction failed. The card remains visible with a concise status/summary rather than disappearing.
- Existing documents may have only a document-level date or no date. The UI explicitly labels that limitation; it never presents upload time as event time.
- Supabase relation payloads can be object-or-array shaped. The projection normalizes relation values defensively and filters laboratory rows through the existing current-source boundary.
- The change adds no migration or write path, but it does project and authorize reads from existing database tables. A transactional `QA-Db_tests/eh127_health_timeline.sql` fixture verifies the existing source columns, profile separation, RLS, and service-role read privilege; it does not replace route-level verification.
