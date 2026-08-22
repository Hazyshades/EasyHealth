# EH-127: Health Timeline page

**Roadmap status:** Delivered
**Build / environment:** `________`
**Test run date:** `________`
**Tester:** `________`

## What this checklist covers

EH-127 adds a chronological Health Timeline for laboratory, instrumental, consultation, discharge, prescription, and referral documents. It covers active-profile context, document-type/date filters, event cards, source-document navigation, pagination, and visible loading, empty, filtered-empty, and error states. Medical dates are displayed only when the source record provides them; upload time is not presented as the event date.

## Before you start

- [ ] Use a dedicated EasyHealth test account with one active profile.
- [ ] Use only synthetic or de-identified documents; do not upload real patient records.
- [ ] Prepare one synthetic document for each supported type: lab result, imaging study, consultation, discharge summary, prescription, and referral.
- [ ] Give at least three documents different explicit medical dates and leave one synthetic document without a medical date.
- [ ] Confirm the normal-path documents have finished processing before testing their structured details.
- [ ] Keep one upload processing or deliberately failed if the environment supports that safe fixture; use it only for the incomplete-data check.

## Test data

| ID | Test document or setup | Purpose |
| --- | --- | --- |
| `EH127-TIMELINE-01` | Six synthetic documents covering all supported types, with explicit dates from different months and no real patient data. | Normal chronological projection and type coverage. |
| `EH127-TIMELINE-02` | One synthetic consultation or referral with no document/event date. | Unknown-date rendering and ordering. |
| `EH127-TIMELINE-03` | A synthetic document intentionally left processing or failed, with no accepted typed extraction. | Incomplete-data/status visibility without hiding the source card. |
| `EH127-TIMELINE-04` | A date range that contains no `EH127-TIMELINE-01` event, plus a type filter that excludes the available types. | Filtered-empty and clear-filters behavior. |

### EH127-UI-00: Complete local magic-link sign-in

**Precondition:** The local Supabase stack and the application are running at `http://localhost:3000`; use a synthetic test email address.

1. Open the EasyHealth landing page.
2. Enter the synthetic address in the email field and select **Email me a magic link**.
3. Open the local Mailpit inbox at `http://localhost:54324`.
4. Open the newest **Your sign-in link** message and select **Sign in** once.
5. Return to the application and review the resulting page.

**Expected result:** The link opens the configured `/auth/callback` route and the application reaches the authenticated app or its profile/onboarding gate. A second click on the same message is not required and must not be used as a success criterion.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

## Interface checks

### EH127-UI-01: Open the chronological timeline

**Precondition:** `EH127-TIMELINE-01` is processed for the active test profile.

1. Open **Health Timeline** from the authenticated application navigation.
2. Confirm the active profile label is visible.
3. Review the event cards from top to bottom.
4. Compare the card dates with the explicit medical dates in `EH127-TIMELINE-01`.

**Expected result:** The page identifies the active profile and shows the supported document events in newest-first medical-date order. Each card identifies its document type and does not substitute upload time for a missing medical date.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

### EH127-UI-02: Filter by document type

**Precondition:** The timeline contains at least two different supported document types from `EH127-TIMELINE-01`.

1. Go to **Health Timeline**.
2. Open the **Document type** control.
3. Select **Consultation**.
4. Review the result count and cards.
5. Select **All document types** again.

**Expected result:** Only consultation cards appear while the filter is active; the count and pagination describe the filtered set. Returning to all types restores the full set and resets the page to the first page.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

### EH127-UI-03: Filter by an inclusive medical date range

**Precondition:** `EH127-TIMELINE-01` contains known dates inside and outside a chosen range.

1. Enter the earliest target date in **From**.
2. Enter the latest target date in **To**.
3. Review the visible cards and their dates.
4. Clear the date fields.

**Expected result:** Cards on both boundary dates are included, cards outside the range are excluded, and a card with no medical date is excluded while a date range is active. Clearing the dates returns the unfiltered list.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

### EH127-UI-04: Review event details and open the source document

**Precondition:** The timeline contains processed lab, instrumental, consultation, discharge, prescription, and referral fixtures.

1. Open a laboratory event card and review its displayed measurements.
2. Review one typed event card and confirm its available provider/finding/medication/referral details.
3. Activate **Open source** on the card using the keyboard or pointer.
4. In the document viewer, confirm the opened filename matches the event card.
5. Return to **Health Timeline** and repeat the source-link check for a second event type.

**Expected result:** Available structured details are shown without fabricated placeholders. Every source action opens the corresponding original document in the existing document viewer, not another profile's document or an unrelated file.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

### EH127-UI-05: Move through paginated results

**Precondition:** The active profile has more timeline events than one page, or use a safe local fixture that provides more than one page.

1. Open **Health Timeline**.
2. Select **Next**.
3. Confirm the page indicator and cards change.
4. Select **Previous**.

**Expected result:** Next and Previous are enabled only when a page exists. The result count remains consistent, cards do not repeat across adjacent pages, and changing a filter returns to page one.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

### EH127-UI-06: Empty, filtered-empty, loading, and error states

**Precondition:** Use a dedicated profile with no supported timeline documents for the empty check; use `EH127-TIMELINE-04` for filtered-empty. Use a safe offline/API failure setup only when the test environment provides one.

1. Open **Health Timeline** with no supported events.
2. Confirm the empty message and select **Upload document**.
3. Return to the timeline and apply a range/type combination from `EH127-TIMELINE-04`.
4. Confirm the filtered-empty message and select **Clear filters**.
5. Reload the page while the timeline request is pending.
6. If a safe request-failure fixture is available, load the page and select **Try again**.

**Expected result:** The no-data state offers upload; the filtered-empty state offers clear filters; loading shows a skeleton instead of claiming no data; and a request failure shows an actionable error with retry. Do not mark the error step as tested if the environment cannot safely produce it.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

## Developer evidence required

- [x] Engineering provides `pnpm typecheck` output proving the new route, projection, page, navigation, and verification imports compile. Result: passed on 2026-08-16.
- [x] Engineering provides `pnpm build` output proving Next registers `/api/timeline` and `/app/timeline`; result: production build completed successfully on 2026-08-16 with placeholder compile env.
- [x] Engineering provides `pnpm test:eh127` output proving date precedence, unknown-date handling, current measurement filtering, deterministic order, inclusive filters, pagination, endpoint ownership seams, source links, and page states. Result: `verify-eh127-health-timeline: all checks passed`.
- [x] Engineering confirms the API scopes documents, observations, and accepted typed extraction rows by the authenticated `profile_id`; review `src/app/api/timeline/route.ts` and the focused endpoint-seam assertions.
- [x] Engineering confirms no upload timestamp is used as `eventDate` and unknown dates remain `null`; review `src/lib/timeline.ts` and the focused verification output.
- [x] Engineering provides `pnpm test:eh127-db` output for the synthetic transactional database contract covering source columns, profile separation, RLS, and service-role read access. Result: `Files=1, Tests=13, Result: PASS` against the local disposable database.
- [x] Engineering confirms local Auth uses `http://localhost:3000` as `site_url`, permits both local callback hosts, and a fresh Mailpit magic link reached `/onboarding/profile` in the same browser on 2026-08-21.

## Out of scope or not manually testable yet

- The normalized `medical_events` model, timezone/partial-date policy, and any EH-126 database projection are not delivered by EH-127; verify those requirements against the EH-126 change when implemented.
- DICOM events are excluded because the current app has no timeline-ready DICOM event projection or source-review flow.
- Do not mark API authorization, profile isolation, or query validation as UI-passed; supply the developer evidence above or automated verification instead.
- Do not mark the request-failure path as passed when the environment cannot safely reproduce an API failure; record `Blocked` or `N/A` with the limitation.
