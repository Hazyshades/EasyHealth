## Context

The Health Profile currently derives a numeric `state_score` for every returned system. When a system has no usable `core` markers, aggregation falls back to numeric supporting, extended, display, or unmapped observations. This prevents a catastrophic `0`, but can present a high assessment score for a system with insufficient evidence.

The approved S3 experience makes readiness explicit: after at least one biomarker observation exists, the map presents all eight named systems. A system is scored only when it satisfies a catalog-defined technical minimum for a UI score; otherwise it remains factual, selectable, and visibly unscored.

## Goals / Non-Goals

**Goals:**

- Prevent a numeric system or overall assessment when the minimum usable lab evidence is incomplete.
- Preserve every observation in the drawer and explain whether it is missing, present without a usable reference, or supporting only.
- Support realistic laboratory alternatives through `scoreRequiredGroups`, such as `BUN OR urea`.
- Keep data confidence, score readiness, and score contribution as separate concepts.
- Provide a clear S3 map and a profile-only dismissible no-score overall state without changing the no-data onboarding experience.

**Non-Goals:**

- Define clinical recommendations, diagnoses, risk predictions, or external optimal ranges.
- Package clinical tests into purchasable panels or use an LLM to infer missing markers.
- Synchronize the insufficient-data dismissal across devices in v1.
- Change stored observations, document extraction, or lab-unit conversion rules.

## Decisions

### 1. Keep marker roles, coverage, and score readiness separate

`scoreRole` remains marker-level and means whether a marker can contribute to a score. Only usable `core` markers contribute to the numeric average; `extended` and `display` markers never contribute to score readiness or score calculation.

`coversConfidence` remains marker-level and continues to define the data-confidence denominator. It is not renamed because confidence coverage and UI-score readiness differ: ferritin and UACR may remain useful coverage evidence while not blocking a v1 score.

`scoreRequiredGroups` is a named-system configuration. Each group contains alternative canonical keys; all groups must be satisfied, and one usable marker satisfies a group. A usable marker has a numeric value and a document-provided usable reference range. The initial product-policy configuration is:

```ts
cardiovascular: [["ldl", "non_hdl_cholesterol"], ["hdl"], ["triglycerides"]]
metabolic: [["fasting_glucose", "hba1c"]]
thyroid: [["tsh"], ["free_t4"]]
liver: [["alt"], ["ast"], ["alp"], ["bilirubin"], ["albumin"]]
kidney: [["egfr", "creatinine"], ["uacr"]]
blood: [["hemoglobin", "hematocrit"], ["wbc"], ["platelets"], ["mcv"]]
nutrients: [["vitamin_d"], ["b12"], ["folate"]]
```

`inflammation` is explicitly non-scoreable in MVP; an empty array must never be interpreted as satisfied readiness. The catalog registry retains optional core markers outside the groups: `total_cholesterol`, `glucose`, `ggt`, kidney chemistry markers, `rbc`, and `rdw`. `ferritin` becomes extended supporting data rather than a Blood score driver.

`scoreRequiredGroups` determine availability, not weight. A second deterministic per-system `scoreContributionGroups` registry prevents correlated or derived values from receiving multiple equal-weight votes. Each contribution group chooses at most one usable marker by catalog-defined precedence. At minimum this applies to the atherogenic lipid axis (`ldl` or `non_hdl_cholesterol`), kidney filtration (`egfr` or `creatinine`), kidney nitrogen waste (`bun` or `urea`), and blood red-cell mass (`hemoglobin`, `hematocrit`, or `rbc`).

### 2. Make score readiness a first-class aggregation result

For a named system, aggregation resolves each required group into one of:

- satisfied by a usable marker;
- present without usable lab reference; or
- missing.

The system is scoreable only when every group is satisfied and the system is not explicitly non-scoreable. Its `state_score` is then the average of usable `core` contribution-group scores, with at most one marker selected from each contribution group. Otherwise `state_score` is `null`; no soft fallback, unknown-reference default score, or `0` represents missing readiness.

For this change, usability remains limited to data already stored and normalized by the product: finite numeric value, matching catalog key/specimen policy, and at least one document-provided numeric reference bound. One-sided document references are usable. Context that is not represented in the observation model (for example fasting confirmation, HbA1c assay interference, pregnancy, or patient age) is not silently inferred and remains a documented limitation rather than a new readiness gate.

The API exposes nullable system and overall scores plus drawer-ready readiness details: missing groups, required markers present without usable reference ranges, and supporting observations. This avoids duplicating clinical/normalization logic in the client.

### 3. Use explicit profile display states

The API exposes a biomarker-observation count or equivalent deterministic state so the client can distinguish:

```text
no uploaded/accepted data                 -> onboarding empty state
uploaded data, zero recognized biomarkers -> uploaded / no recognized lab data state
one or more biomarker observations        -> S3 body map
```

S3 always returns the eight named systems after the first biomarker observation. `General` is appended only when the observation set contains unmapped, specialty, or otherwise General-routed markers; it is always unscored.

### 4. Render null as an assessment unavailable state

All score consumers render `null` as `—`, not `0/100`. The drawer uses:

- `No data` for a named system without observations;
- `Not scored · incomplete core` when requirements are missing or lack usable references; and
- `Not scored · supporting / specialty data` for General.

The drawer lists missing groups, present-but-unusable required markers, and supporting observations independently, then provides the existing document-upload CTA. Copy remains factual: it explains what is needed to calculate the app's current-state assessment, never tells the user to order tests.

### 5. Compute and present the overall state only from scoreable systems

The overall score is `null` until `MIN_SCOREABLE_SYSTEMS_FOR_OVERALL = 3` named systems are scoreable; otherwise it is the average of numeric named-system scores only. The API returns `scoreable_named_system_count` and `scoreable_named_system_total: 8`, and the UI displays the denominator (for example, `Based on 3 of 8 systems`). This minimum is an explicit product-policy guard against presenting one lab domain as a whole-profile assessment. In the null state, the Health Profile page has a dismissible `Insufficient data for overall assessment` card using a stable user-scoped `localStorage` key. The Dashboard always renders its explanatory insufficient-data card and provides no dismiss control, so a persisted profile dismissal cannot create a blank dashboard widget. Rendering ignores or clears the profile dismissal whenever the overall score becomes available, so a numeric overall assessment is never hidden by an old dismissal.

## Risks / Trade-offs

- [A strict usable-reference rule leaves more systems unscored, especially eGFR reports without ordinary numeric ranges.] → Show the observed marker in the drawer and add fixtures for common eGFR forms; do not synthesize a reference range.
- [A group registry can encode an unintended medical minimum.] → Treat it as product configuration, document each group in tests, and keep the language limited to a technical UI score.
- [Eight empty system badges can appear dense.] → Use a muted unscored visual treatment and retain the dedicated onboarding state before any observation exists.
- [Local dismissal is browser-local.] → Scope the key to the authenticated user and treat cross-device persistence as future work.
- [Nullable scores widen the client contract.] → Update API types and every score renderer together, with regression coverage for all three profile display states.

## Migration Plan

1. Add the group registry and nullable readiness fields behind the deterministic health-profile aggregation path.
2. Update API consumers to render unscored results before enabling S3 placeholders.
3. Replace soft-fallback tests with strict readiness, missing-reference, General, and overall-state fixtures.
4. Deploy as an additive response-shape change for the first-party client; no database migration or backfill is required.
5. Roll back by restoring the former aggregation and renderer behavior if a client incompatibility is detected.
