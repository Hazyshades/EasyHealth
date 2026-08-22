## Why

The static panel registry and normalized laboratory observations now exist, but the application has no event-level presentation that shows which measurements belong to a supported panel. Users therefore see a flat document/biomarker list and cannot distinguish a partially reported panel from unrelated measurements; a missing panel member must remain a neutral absence, not a clinical warning. This change delivers the EH-128 panel experience in the current checkout, including the missing timeline host needed to exercise the dependent EH-127 flow.

## What Changes

- Add a reusable, deterministic laboratory-observation grouping projection driven only by reviewed `measurement_definition_key` membership from the existing EH-125 panel registry; panel alternate names and document headings are never treated as detection evidence.
- Add a Health Timeline page and navigation entry that uses the authenticated timeline-event and normalized-biomarker read APIs, orders events by the medical event date with upload-date fallback, supports document-type/date-range filtering, bounded pagination, and loading/error/empty states.
- Render laboratory events with stable panel headings, ordered member rows, neutral `Not reported in this event` placeholders for absent required or optional members, and an `Other measurements` section for observations that do not belong to any panel (including unresolved rows).
- Preserve many-to-many membership in the projection: a concrete observation may appear in each owning panel, while it is excluded from the ungrouped section once it has a panel membership.
- Add document and page provenance links for every rendered laboratory event/measurement, retaining the existing source-page deep link contract.
- Add focused deterministic fixtures and a verification runner covering panel detection, ordering, optional/missing members, ungrouped measurements, shared memberships, alias non-detection, and provenance links.
- Add `QA/eh-128/checklist.md` with tester-executable synthetic-data checks and separate developer evidence for the pure grouping contract.
- No database migration, observation rewrite, resolver change, assessment change, panel-registry roster change, or medical interpretation is included.

## Capabilities

### New Capabilities

- `laboratory-event-panels`: Event-level grouping and presentation of normalized laboratory observations using the versioned panel registry, with neutral missing-member handling and provenance-preserving links.

### Modified Capabilities

- None.

## Impact

- Target domains: `documents` (timeline events and source navigation) and `health-profile` (laboratory observation presentation).
- Affected code: `src/lib/timeline/`, the timeline route/page and navigation metadata, focused verification scripts, and QA artifacts.
- Existing authenticated `/api/documents` and `/api/biomarkers` contracts remain the data source; no new persistence or public write API is introduced.
- Existing generated biomarker documentation and Wiki output are intentionally unchanged because the EH-125 registry data is consumed, not modified; the registry documentation-sync checks and tracking status must still be recorded before completion.
