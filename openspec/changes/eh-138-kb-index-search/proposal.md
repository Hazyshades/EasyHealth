## Why

EasyHealth already has a reviewed Registry 2.0 catalog and profile-owned biomarker results, but users have no safe way to browse the educational material that explains those measurements or panels. EH-138 adds that navigation layer now so a user can move from a recognized result to relevant general education without mixing private observations into public content.

## What Changes

- Add a versioned, review-gated Knowledge Base content model for published measurement articles and panel pages.
- Add a public `/knowledge` index grouped by educational category, with normalized search over canonical measurement names and approved aliases.
- Add panel filtering and panel detail pages backed by the existing static panel registry, preserving required/optional membership and the fact that laboratory panel composition varies.
- Add article detail pages with accessible breadcrumbs, safe educational sections, sources, a medical disclaimer, and links to related published measurements and panels.
- Add deep links from profile-owned Biomarker rows to the matching published article when the concrete Registry definition has a published article; article calls back into `/app/biomarkers` only through the existing profile-scoped route and never embeds observation data.
- Add deterministic EH-138 verification and a tester-facing QA checklist for search, filters, breadcrumbs, deep links, and the public/private data boundary.
- Do not change resolver outcomes, Registry definitions or aliases, assessment scoring, observations, database schema, or private API authorization.

## Capabilities

### New Capabilities

- `knowledge-base-navigation`: Public index, category and alias search, panel filters, article/panel breadcrumbs, published educational content, and safe links back to the authenticated user's own results.

### Modified Capabilities

- No existing capability requirements change. The existing `health-profile-reported-results` contract remains profile-scoped and unchanged; its Biomarker table receives an outbound link only when a published article exists.

## Impact

- **Target domains:** `health-profile` for Biomarker-row entry points and `auth-shell` for navigation back into the authenticated app; the new capability is the `knowledge-base` product surface.
- **Frontend:** new public Knowledge Base layout, index, article and panel routes; reusable content/index helpers; Biomarker table links; landing/app entry points as appropriate.
- **Runtime/data:** read-only static content and existing reviewed Registry/panel metadata only. No Supabase reads, writes, migrations, RPCs, or new API endpoints.
- **Verification:** a focused `test:eh138` contract script, `typecheck`, and browser smoke coverage for public search/filter/detail pages and profile deep-link return behavior.
- **Privacy boundary:** public routes contain only reviewed catalog/content data. User observations remain behind the existing `/api/biomarkers` profile-scoped read and are reached only by links to `/app/biomarkers`.
