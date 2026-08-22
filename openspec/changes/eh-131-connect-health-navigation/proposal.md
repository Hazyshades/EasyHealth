## Why

EH-127 provides a chronological timeline and source-document viewer, while the Health Profile and Biomarkers surfaces still stop at display-only markers or lose the user's origin when a source is opened. EH-131 closes that navigation gap now so a user can follow an assessed system to its contributing measurement and historical series, inspect the owning source document, and return to the same filtered/selected context without exposing another profile's data.

## What Changes

- Add a shared internal URL/context model for selected measurement, observation, body system, and a validated return path.
- Link Health Profile system markers and primary sources to the matching Biomarkers series or profile-owned source document.
- Make Biomarkers honor a deep-linked selected measurement/observation, preserve that state in the URL, highlight the selected row, and expose source-document links for historical points.
- Carry timeline filters/page and measurement context into source-document links so document review can return to the originating view.
- Add accessible breadcrumbs and explicit context-aware back links on Biomarkers and Document Review surfaces.
- Keep selection and return context within same-origin internal paths; reject external return targets.
- Rely on existing profile-scoped APIs and document ownership authorization; add focused verification for URL round trips, selection state, source wiring, and authorization seams.
- Do not change Registry definitions, aliases, resolver outcomes, assessment scoring, database schema, or document persistence.

## Capabilities

### New Capabilities

- `health-navigation`: Context-preserving navigation between Health Profile assessments, Biomarker measurements and series, the chronological Timeline, and profile-owned source-document review.

### Modified Capabilities

<!-- No existing main capability requirement changes; this is a new cross-surface navigation contract. -->

## Impact

- **Target domains:** `health-profile`, `documents`, and `auth-shell` navigation.
- **Frontend:** Health Profile drawer, Biomarkers table/chart, Timeline source links, Document Review header, breadcrumbs, and app navigation context helpers.
- **Verification:** New deterministic EH-131 navigation contract checks and `QA/eh-131/checklist.md`.
- **Security boundary:** No new data access path; deep links continue through the existing authenticated profile-scoped APIs and `assertDocumentOwner` document boundary.
