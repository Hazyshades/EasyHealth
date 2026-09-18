# Proposal: eh-149-biomarker-dynamics-report

Domain: **health-profile / reports**

## Why

The Biomarkers page already has safe identity grouping, unit conversion guards, reference ranges, and source links, but it does not expose a deterministic report view with period statistics, direction, and explicit incompatibility handling. Users and later export code need one read model rather than chart-only presentation logic.

## What Changes

- Add a report-ready biomarker dynamics read model over the existing comparison series.
- Support an explicit inclusive period selector with minimum, maximum, latest, point count, and lab-native/display-unit metadata per compatible series.
- Derive only numeric direction labels from approved deterministic rules; do not label a change as improvement or deterioration without a domain rule.
- Split incompatible definitions or units into separate series and show a visible warning instead of merging them.
- Retain source document, observation, and reference-range provenance for every plotted or tabulated point.
- Render the dynamics view in the Biomarkers experience and expose the same DTO for EH-153 export without persisting a second copy of observations.

## Capabilities

### New Capabilities

- `biomarker-dynamics-report`: Deterministic, source-preserving biomarker dynamics projection.

### Modified Capabilities

- `biomarkers-overview`: Add period controls, report statistics, direction wording, incompatibility warnings, and the report-ready view while preserving safe conversion behavior.

## Impact

The change is limited to the biomarker comparison/read-model boundary, the Biomarkers page/API projection, and the export-facing adapter. It does not alter stored observations, Registry definitions, reference ranges, or clinical interpretation rules.
