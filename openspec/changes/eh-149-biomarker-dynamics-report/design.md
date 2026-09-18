# Design: eh-149-biomarker-dynamics-report

## Context

`src/lib/biomarker-comparison.ts` already groups observations by exact measurement definition, separates incompatible units, performs guarded conversions, preserves native values/ranges, and returns source document links. The Biomarkers page consumes that helper but does not expose a stable report projection with period statistics, direction, or an incompatibility explanation.

## Goals / Non-Goals

**Goals:**

- Produce one deterministic `BiomarkerDynamicsReport` DTO for the page and EH-153.
- Keep exact-definition grouping, safe conversion, native values, native ranges, observation IDs, and source document IDs intact.
- Add inclusive period filtering, min/max/latest statistics, point count, and numeric direction.
- Make incompatible definitions and units visible instead of merging them.

**Non-Goals:**

- Rewriting observations, Registry definitions, aliases, reference ranges, or unit preferences.
- Calling a numeric direction an improvement, deterioration, or treatment response.
- Persisting a second observation table or generating LLM prose.

## Decisions

### 1. Add a pure report projection over the existing comparison model

Add `src/lib/biomarker-dynamics.ts` with a narrow interface:

`buildBiomarkerDynamicsReport(series, period) -> BiomarkerDynamicsReport`

The input is the existing comparison result after profile authorization. The output contains the selected period, `series[]`, `incompatibilities[]`, and a deterministic disclaimer. Each series contains exact measurement identity, display/native units, min/max/latest over numeric points, point count, direction, the applied `directionTolerance` or its absence, and the complete point ledger. Each point retains observation ID, document ID, observed date, native value/unit/range, display value/unit, and conversion metadata.

This is a deep module: callers do not reimplement statistics, direction thresholds, or incompatibility wording. The page and export adapter consume the DTO.

### 2. Define direction from versioned per-definition tolerances

Add `src/lib/biomarker-dynamics-policy.ts` with a versioned policy keyed by exact `measurementDefinitionKey` and the series display unit. Each reviewed entry supplies `{ absolute, relative }`, where `absolute` is in the display unit and `relative` is dimensionless. EH-149 attaches the matching policy entry to the series; the values are numeric movement thresholds only, not clinical interpretation.

Order the selected numeric points by `observedAt`; direction compares the first and latest points. Let `delta = latest - first` and `threshold = max(absolute, relative * abs(first))`. If `abs(delta) <= threshold`, direction is `stable` (the boundary is inclusive); if `delta > threshold`, it is `increasing`; if `delta < -threshold`, it is `decreasing`. If no reviewed policy entry exists, direction is `not_available` with a limitation; there is no arbitrary zero/default tolerance. The DTO never emits `improving` or `worsening`; those labels require a future domain rule with Registry ownership.

### 3. Treat incompatible data as separate evidence

The existing exact-definition and unit-group keys remain authoritative. A display-name collision with different specimen, modifier, method, scale, or incompatible unit creates separate series and an `incompatibilities[]` warning containing the grouping reason and affected labels. The UI must not join them for min/max/latest or direction.

### 4. Keep period filtering inclusive and server-authorized

The API resolves the authenticated profile and returns authorized observations. The projection applies an inclusive UTC date range to observed dates, with undated rows shown outside the dynamics series and counted in a limitation. The client may choose a period preset but cannot inject arbitrary observations or perform its own conversion.

### 5. Reuse the existing source ledger

No new source storage is introduced. `src/app/app/biomarkers/biomarkers-page-client.tsx` renders the DTO and its point/source ledger. EH-153 serializes the same DTO; it does not read raw observation rows independently.

## Risks / Trade-offs

- A deterministic direction can be misread as clinical improvement. Labels and disclaimer explicitly describe numeric movement only.
- A long point ledger can make the page dense. Keep the summary compact and make source details expandable without dropping provenance.
- Existing non-numeric observations cannot produce numeric statistics. They remain visible as an explicit limitation rather than being coerced to zero.
- Unit conversion rules may evolve with the Registry. The DTO records conversion metadata and native values so an export remains auditable.
