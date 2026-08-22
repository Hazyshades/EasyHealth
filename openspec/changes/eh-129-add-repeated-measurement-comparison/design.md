## Context

The authenticated Biomarkers page already reads `/api/biomarkers`, which filters out superseded laboratory rows and projects active Registry 2.0 outcomes. The API already calls `projectActiveRegistryV2LaboratoryBinding` and `presentObservation`, so reviewed conversion metadata is the only server-authorized source for a display-normalized value. The current page groups eligible rows by exact `measurement_definition_key`, but the chart only receives `{observed_at, value}` and therefore drops each document's native range and source context.

EH-129 is a presentation/read-model change on top of EH-111, EH-126, and EH-127. It must not create a second resolver, convert raw units in the browser, infer identity from `analyte_key` or display names, or add a persistence model. The comparison must remain profile-scoped because the existing endpoint is session-scoped.

## Goals / Non-Goals

**Goals:**

- Build a typed, deterministic comparison model from the existing `/api/biomarkers` response.
- Treat the exact active resolved `measurement_definition_key` as the only identity that permits a normalized series.
- Keep unit variants together only when the endpoint has already applied a reviewed conversion and exposed one common display unit; keep different units in separate series otherwise.
- Preserve native value, native unit, native reference range, observed date, laboratory/document identity, and a `/app/documents/<id>` link for every plotted point.
- Provide an inclusive date-range selector and a unit-aware series selector in the existing Biomarkers trend card.
- Keep unresolved, non-current, qualitative, and otherwise ineligible observations factual in the table but absent from numeric comparison lines.

**Non-Goals:**

- Do not alter Registry definitions, aliases, unit policies, resolver outcomes, conversion formulas, or consumer-eligibility semantics.
- Do not convert values or reference ranges in client code; the browser consumes server-presented values and native fields only.
- Do not mix different measurement definitions merely because their analyte or display label matches.
- Do not add a database migration, RPC, charting dependency, write path, or new profile-sharing behavior.
- Do not change the existing Biomarkers table filters or the Health Profile assessment projection.

## Decisions

### 1. Reuse the existing guarded endpoint

Keep `/api/biomarkers` as the read boundary. Extend its document relation selection to include `lab_name` so a point can identify the reporting laboratory, while retaining `original_value`, `original_unit`, `original_ref_low`, and `original_ref_high` in the response. The route continues to derive `trend_eligible`, `conversion_eligible`, and the presented value through `projectLaboratoryOutcome` and `projectActiveRegistryV2LaboratoryBinding`; the comparison module never calls a conversion function.

**Alternative rejected:** create a comparison RPC or query raw observations from the browser. That would duplicate profile authorization, current-source filtering, active-revision checks, and conversion policy at a second boundary.

### 2. Define a pure comparison projection

Add `src/lib/biomarker-comparison.ts` with serializable input/output types and pure helpers:

- discard rows without an exact `measurement_definition_key`, `trend_eligible = true`, a numeric value, and a valid observed day;
- group first by exact definition key;
- within each definition, group by a normalized display-unit token (trimmed, case-folded, whitespace/µ normalized); the displayed unit is the axis unit;
- sort points ascending by observed day, then stable observation id;
- expose both displayed values/ranges and native values/ranges for each point;
- mark a series `normalized` only when its points have reviewed conversion eligibility and at least one point was converted; a same-unit native series remains explicitly native;
- apply inclusive `from`/`to` filtering after identity and unit grouping.

Grouping by display unit is deliberate: if a definition accepts multiple units but no reviewed conversion is available, different unit buckets cannot share one numeric axis. If the server returns one common unit after a reviewed conversion, points from different laboratories can share that series while their native fields remain attached.

**Alternative rejected:** group by `analyte_key` or by a friendly name. Those keys intentionally do not encode property, specimen, method, timing, or unit identity and would reintroduce the false combinations EH-111 prevents.

### 3. Keep provenance visible in the chart component

Extend `BiomarkerChart` with point metadata and render an accessible point ledger beneath the line. Each row shows the observed date, displayed value/unit, document-native value/unit and native reference range, laboratory when available, and an `Open source` link targeting the existing document viewer. The line itself uses only the server-presented numeric value and the series display unit; it does not make native ranges into a single global band.

**Alternative rejected:** put source links only in the table. A selected trend point would still be impossible to trace without visually matching it to a second list.

### 4. Keep date filtering local to the selected comparison

Add `From` and `To` date inputs to the trend card. The page resets the active series selection when the available series changes, applies an inclusive range through the pure helper, and leaves the factual table unchanged. Empty filtered results receive an explicit message; clearing both dates restores all eligible points.

**Alternative rejected:** reuse the timeline endpoint's document-date filters. Repeated measurement dates are observation dates and the Biomarkers endpoint already returns the authoritative observation rows.

### 5. Verify at the pure contract and seam levels

Add `scripts/verify-eh129-repeated-measurement-comparison.ts` and expose it as `pnpm test:eh129`. The verifier covers exact-definition separation, reviewed conversion grouping, unsafe unit separation, native range/source retention, inclusive date boundaries, exclusion of unresolved/qualitative rows, and static seams proving the existing API guard and page/chart controls are wired. Typecheck/build remain the integration proof; no DB test is needed because the change has no migration or write contract.

## Risks / Trade-offs

- **A definition with no reviewed conversion can yield multiple unit series:** this is intentionally safer than showing incomparable numbers on one axis; the UI labels the separate unit series.
- **The comparison uses the server's presented unit:** a future API change that omits or mislabels conversion eligibility could make a series native rather than normalized, but the client will not silently recalculate it. Seam assertions and the existing binding tests protect this boundary.
- **Native ranges may be absent in legacy rows:** the point ledger shows an explicit unavailable range rather than fabricating or borrowing another point's range.
- **Large histories still arrive through the existing bounded-by-endpoint profile read:** this change does not claim a new pagination strategy; EH-126 remains the future database-backed timeline seam.
- **Chart accessibility is limited by the existing Recharts line:** the point ledger and source links provide a keyboard-operable equivalent for every plotted point.
