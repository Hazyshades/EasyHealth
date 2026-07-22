## Why

The Health Profile currently explains biomarker coverage, but the target user experience needs a Lissa-style body map where clicking a system or organ opens a factual side drawer with the reason it was highlighted and the source document behind the signal. To keep the MVP aligned with the pay-per-insight model, the drawer should show deterministic facts for free and gate narrative LLM insights behind the existing paid report flow.

## What Changes

- Replace the profile body-map score semantics from "data coverage percentage" to a 0-100 current state assessment computed deterministically from available biomarker observations.
- Add a side drawer for selected systems/organs that shows the current state score, data confidence, contributing observations, source document links, and neutral "why highlighted" facts.
- Show a paid CTA such as "Generate report to see insights" for LLM-generated narrative sections instead of generating a free compact profile summary.
- Preserve educational safety constraints: factual marker values, dates, source documents, and neutral reference-range language; no diagnosis, treatment plan, or disease-risk conclusion in the free drawer.
- Keep profile data fresh from the latest completed documents and observations without an LLM call.

## Capabilities

### New Capabilities

### Modified Capabilities
- `health-profile`: Change the profile UI from coverage-only body map details to a factual current-state body map with a side drawer and paid insights CTA.
- `health-profile-api`: Change the deterministic aggregation response to include current-state scores, data confidence, source document metadata, and drawer-ready factual details.

## Impact

- Affects `src/lib/health-systems.ts` scoring and aggregation types.
- Affects `GET /api/health-profile` response shape and source document joins.
- Affects `/app/profile` and body-map components, including replacing the inline details panel with a side drawer.
- Uses existing reports payment flow for LLM insights; no new unpaid LLM call is introduced.
- Requires copy changes in English UI strings and updated OpenSpec requirements for changed score semantics.
