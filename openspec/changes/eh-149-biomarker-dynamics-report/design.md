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

Add `src/lib/biomarker-dynamics.ts` with a narrow interface.

The public projection signature is `buildBiomarkerDynamicsReport(input: AuthorizedBiomarkerComparison, period) -> BiomarkerDynamicsReport`; it is pure and never resolves authorization itself.

`AuthorizedBiomarkerComparison` is an EH-149-owned server snapshot with `scope_kind` (`profile_current` or `report_immutable`) and `scope_document_ids`. The profile-page adapter populates `profile_current` with all currently authorized eligible documents for the authenticated profile; the report adapter populates `report_immutable` with the exact EH-148 materialized document UUIDs. The snapshot contains only retained numeric/qualitative candidates from that scope, projected series, `excluded[]` entries with deterministic reasons (`undated`, `non_numeric`, `ineligible`, `unsupported_unit`), and `incompatibilities[]` entries with grouping reasons. Each candidate retains exact measurement identity, display/native units, specimen, modifier, method, scale, observed date, and source IDs. The dynamics projection never queries raw tables, never reconstructs discarded evidence, and never emits a point whose source document is outside `scope_document_ids`.

The output contains the selected period, `series[]`, `incompatibilities[]`, explicit exclusion limitations, and a deterministic disclaimer. Each series contains exact measurement identity, display/native units, min/max/latest over numeric points, point count, direction, the applied `directionTolerance` or its absence, and the complete point ledger. Each point retains observation ID, document ID, observed date, native value/unit/range, display value/unit, and conversion metadata.

This is a deep module: callers do not reimplement statistics, direction thresholds, or incompatibility wording. The page and export adapter consume the DTO.

`src/lib/biomarker-dynamics-server.ts` is the EH-149-owned authorization adapter. `getAuthorizedBiomarkerDynamics({ profileId, period, scope })` resolves the profile and builds the server-side comparison snapshot before calling the pure projection. `GET /api/biomarkers/dynamics` exposes only the `profile_current` scope to the authenticated Biomarkers page; EH-148 calls the same adapter internally with `report_immutable` and exact report scope. Neither entry point accepts client observations, source rows, or a client DTO.

### 2. Define direction from versioned per-definition tolerances

Add `src/lib/biomarker-dynamics-policy.ts` with a versioned policy keyed by exact `measurementDefinitionKey` and the series display unit. Each reviewed entry supplies `{ absolute, relative }`, where `absolute` is in the display unit and `relative` is dimensionless. EH-149 attaches the matching policy entry to the series; the values are numeric movement thresholds only, not clinical interpretation.

Order the selected numeric points by `observedAt`; direction compares the first and latest points. Let `delta = latest - first` and `threshold = max(absolute, relative * abs(first))`. If `abs(delta) <= threshold`, direction is `stable` (the boundary is inclusive); if `delta > threshold`, it is `increasing`; if `delta < -threshold`, it is `decreasing`. If no reviewed policy entry exists, direction is `not_available` with a limitation; there is no arbitrary zero/default tolerance. The DTO never emits `improving` or `worsening`; those labels require a future domain rule with Registry ownership.

### 3. Treat incompatible data as separate evidence

The existing exact-definition and unit-group keys remain authoritative. The comparison adapter preserves candidate identity fields for specimen, modifier, method, and scale; a display-name collision with a different field or incompatible unit creates separate series and an `incompatibilities[]` warning containing the grouping reason and affected labels. The UI must not join them for min/max/latest or direction.

### 4. Keep period filtering inclusive and server-authorized

The `/api/biomarkers/dynamics` route resolves the authenticated profile and `profile_current` scope before returning the DTO. The EH-148 report handoff invokes the same adapter with immutable `report_scope_document_ids`. The projection applies an inclusive UTC date range to observed dates, with undated rows shown outside the dynamics series and counted in a limitation. A client may choose a period preset through `biomarker_dynamics_period` but cannot inject arbitrary observations, widen report scope, or perform its own conversion.

### 5. Reuse the existing source ledger

No new source storage is introduced. `src/app/app/biomarkers/biomarkers-page-client.tsx` renders the DTO returned by `/api/biomarkers/dynamics` and its point/source ledger; it does not import comparison helpers, query raw observations for dynamics, re-convert values, compute statistics, or merge series. EH-153 serializes the same persisted report DTO; it does not read raw observation rows independently.

### 6. Bind frozen dynamics to the persisted report

When EH-148 receives an optional server-authorized `biomarker_dynamics_period` with inclusive UTC `start` and `end` dates, it passes that period and immutable `report_scope_document_ids` to EH-149. EH-149 returns the authorized, scope-constrained `BiomarkerDynamicsReport` plus the DTO schema version, direction-policy version, selected period, and generation metadata through the server-side handoff. EH-148 stores that extension in the validated report payload; no client-supplied DTO or raw observation query is accepted at creation or export time. EH-153 reads the persisted extension through EH-148's report-read resolver, which rejects any extension point outside report scope, so an export reproduces the period and policy that were selected at report creation. If the period is omitted, no dynamics extension is created.

## Risks / Trade-offs

- A deterministic direction can be misread as clinical improvement. Labels and disclaimer explicitly describe numeric movement only.
- A long point ledger can make the page dense. Keep the summary compact and make source details expandable without dropping provenance.
- Existing non-numeric observations cannot produce numeric statistics. They remain visible as an explicit limitation rather than being coerced to zero.
- Unit conversion rules may evolve with the Registry. The DTO records conversion metadata and native values so an export remains auditable.
