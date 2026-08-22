## Context

EH-127 already provides `/app/timeline` and a profile-scoped source-document viewer. The Health Profile drawer exposes assessed systems and current markers, while `/app/biomarkers` exposes the observation table and a historical chart. These surfaces use independent local state: profile marker names are not links, the chart has no source-point context, and the document viewer always returns to the unfiltered Documents list. The existing APIs already scope profile reads by the authenticated profile and the document detail route enforces ownership through `assertDocumentOwner`.

EH-131 is a frontend navigation seam, not a new data model. It must preserve the selected system, measurement series, exact observation, and originating list context across ordinary Next links without changing Registry identity, assessment calculations, persistence, or the normalized medical-event model.

## Goals / Non-Goals

**Goals:**

- Define one reusable internal URL builder/parser for `measurement`, `observation`, `system`, and `returnTo` context.
- Make Health Profile system selection URL-addressable and link contributing markers to their Biomarkers series and exact source documents.
- Make Biomarkers initialize and retain the selected measurement/observation from the URL, visibly distinguish the selected row, and expose source links for historical points.
- Make Timeline source links return to the same filter and page state.
- Add accessible breadcrumbs and context-aware back links to Biomarkers and Document Review.
- Keep return targets same-origin and profile data access behind existing authenticated/profile-owned APIs.
- Add deterministic contract checks and a tester-facing EH-131 checklist.

**Non-Goals:**

- No new database tables, migrations, RPCs, API endpoints, or write paths.
- No changes to Registry definitions, aliases, resolver outcomes, units, assessment scoring, or Health Profile projection semantics.
- No replacement of the EH-127 timeline projection with the EH-126 normalized timeline API.
- No browser-history-only navigation contract; links must work when opened directly or in a new tab.
- No cross-profile sharing, external return URLs, or arbitrary redirect behavior.

## Decisions

### 1. Use a small shared internal navigation contract

Add a pure `src/lib/health-navigation.ts` helper that builds relative paths with `URLSearchParams`, reads the four context keys, and validates `returnTo` against a fixed same-origin base. Invalid or external return targets resolve to a safe local fallback. The helper is shared by client components and verification scripts so encoding and open-redirect behavior are tested once.

**Alternative rejected:** concatenating query strings in each component. That would double-encode nested profile/timeline paths inconsistently and make external return handling easy to miss.

### 2. Encode selection in the URL, not only React state

Use `system` on `/app/profile`, `measurement` and optional `observation` on `/app/biomarkers`, and carry those values plus a `returnTo` path into `/app/documents/<id>`. Profile system selection and Biomarker series selection update the URL with shallow replacement so reload, direct links, and browser back preserve the same context.

**Alternative rejected:** a global client context store. It would not survive reload/new-tab navigation and would add state coupling across the app shell.

### 3. Keep source navigation document-centric while retaining measurement context

A Health Profile marker links to the Biomarkers series when a concrete `measurement_definition_key` exists and links directly to its profile-owned source document when one is available. Biomarker table rows and historical chart points link to the owning document with `measurement`, `observation`, and a return path back to the selected series. Timeline cards link to the source document with a return path containing the active type/date/page filters.

**Alternative rejected:** a new observation detail route. The existing document viewer already owns source review, page previews, and observation review; a new route would duplicate authorization and review behavior.

### 4. Add a shared breadcrumb renderer and route-derived back labels

Create a small accessible `ContextBreadcrumbs` component. Biomarkers and Document Review render a link to the validated origin followed by the current page; the document viewer's fallback is Documents. The link target is explicit rather than `router.back()`, so direct deep links, refreshes, and new tabs have deterministic behavior.

**Alternative rejected:** only relying on the browser Back button. It loses the intended filtered/selected state when the page was opened from a copied deep link or a new tab.

### 5. Preserve existing permission boundaries

No query parameter is trusted for data access. Biomarkers and Health Profile continue to fetch profile-scoped payloads through their existing authenticated APIs. Document Review continues to load through `/api/documents/[id]`, whose `assertDocumentOwner(profileId, id)` check remains the source-document authorization boundary. Verification asserts both the URL contract and these existing ownership seams.

**Alternative rejected:** adding a client-side profile/document existence check. Client checks are advisory and would not prevent direct unauthorized document requests.

## Risks / Trade-offs

- **[Risk]** A very large `returnTo` query can make URLs unwieldy. → **Mitigation:** only include the small set of filter/page/selection keys, reject invalid paths, and avoid embedding response data.
- **[Risk]** Historical chart points can include observations without a source document. → **Mitigation:** render the point and date/value, but provide a source link only when the API supplies an owned document id; do not fabricate a target.
- **[Risk]** Existing persisted Health Profile snapshots may lack newer optional marker fields. → **Mitigation:** treat `measurement_definition_key`, `document_id`, and `source` as nullable and retain the current non-link display for incomplete markers.
- **[Risk]** The document viewer's extracted-review row ids can differ from observation ids. → **Mitigation:** preserve the observation context in the URL and use it for return/label state; do not claim row selection when the loaded review projection cannot identify that row.

## Migration Plan

1. Deploy the shared URL helper, breadcrumbs, and context-aware links together with the client changes.
2. Existing links without context continue to fall back to `/app/documents`, `/app`, or the normal page defaults.
3. Rollback is a code-only revert; no database or persisted URL migration is required.

## Open Questions

- EH-129 may later replace the current chart with a richer comparison surface. This change keeps the `measurement`/`observation` query names stable so that surface can consume the same context contract.
- The normalized EH-126 timeline API remains a separate backend contract; EH-131 intentionally keeps the already delivered EH-127 page projection until that UI migration is separately specified.
