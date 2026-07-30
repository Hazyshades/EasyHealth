## Context

EH-109/EH-111 provide the shared Registry 2.0 resolver, unit normalization, evidence model, missing-axis policy, and concrete-resolution gate. The current CBC corpus and definitions still contain broad aliases and sample fixtures that do not distinguish all clinically meaningful CBC measurement identities. In particular, the same family label may describe a percentage, an absolute cell concentration, a distribution-width variant, or a method-specific differential result.

EH-113 is a registry-and-fixture change spanning the biomarker library, extraction normalization, launch-corpus runner, and reviewed read/conversion boundaries. It must remain compatible with the EH-112 incomplete-outcome serialization contract and must not persist a candidate identity as if it were the active resolved definition.

## Goals / Non-Goals

**Goals:**

- Model CBC semantic axes explicitly enough to distinguish percentage, absolute count, distribution width, platelet index, reticulocyte, differential population, specimen, and method variants.
- Keep aliases typed and provenance-aware; exact reviewed aliases may resolve only through compatible unit/value-kind/specimen/method evidence.
- Cover the EH-113 issue checklist with deterministic exact, multilingual, sample-specific, and OCR-negative fixtures.
- Preserve `resolved|partial|ambiguous|unmapped`, `missingAxes`, candidate evidence, and active reviewed-definition eligibility from EH-111/EH-112.
- Prove that incomplete or conflicting CBC outcomes cannot reach conversion, assessment, or other reviewed consumers.

**Non-Goals:**

- Do not build a second matcher or introduce a CBC-only resolver architecture.
- Do not infer a concrete definition from a shared analyte family, a candidate key, a missing unit, or missing method/specimen context.
- Do not implement glucose (EH-114), durable support trace access (EH-115), UI/API incomplete-state presentation owned by EH-112, or final synthesis (EH-116).
- Do not migrate frozen Registry v1 runtime semantics or create a database migration unless the settled EH-112 contract proves one is required.

## Decisions

### 1. Extend Registry 2.0 definitions, not legacy keys

Add or revise CBC entries in the existing reviewed-definition collection. Each entry uses a unique identity tuple covering analyte, property/scale, specimen, timing, method, and value kind. Definitions that lack enough clinical review remain explicitly provisional display-only fixtures and are never conversion or assessment eligible.

**Alternative considered:** keep one broad CBC key and branch later in consumers. Rejected because it reintroduces the v1 identity collision between percent/count, RDW-CV/RDW-SD, and differential variants.

### 2. Use unit dimensions and semantic labels as independent evidence axes

Percentage definitions accept ratio units; absolute differential definitions accept reviewed cell-concentration units; RDW-SD/MPV/PDW accept volume units; plateletcrit accepts the reviewed ratio policy. A missing unit follows the definition's `missingUnitPolicy`: reject is non-selectable, ambiguous is recognized but incomplete, and display-only has no numeric-unit requirement. Unknown tokens and incompatible families are conflicts, never compatible evidence.

Aliases such as `NEU`, `LYM`, `MON`, `EOS`, `BAS`, `RDW`, and `RETIC` are only accepted when the unit and any method/modifier evidence disambiguates their target. Percent-bearing aliases may be reviewed exact aliases; bare shared aliases remain ambiguous unless the existing policy can prove one target.

**Alternative considered:** score a missing unit as weak evidence and allow concrete selection. Rejected because it turns absent clinical context into an active identity and can trigger unsafe conversion.

### 3. Represent method and differential population explicitly

Use existing definition fields for method and required modifiers. Encode automated/manual differential and segmented/band populations as distinct reviewed identities where the catalog has sufficient evidence. If the extraction does not provide the required method or population modifier, add the corresponding missing axis and return partial/ambiguous rather than selecting a sibling definition.

`parseLabValueCell` output remains the input representation; ordinal/qualitative mismatches are handled by the shared value-kind compatibility policy rather than a CBC-specific coercion.

### 4. Make one specimen policy authoritative

`allowedSpecimens` is the source of truth for candidate compatibility. The singular `specimen` field is retained only as the canonical specimen in the definition identity and must equal the sole allowed specimen for single-specimen definitions; validation rejects contradictory values. Multi-specimen definitions must enumerate all allowed values and avoid a misleading singular restriction.

### 5. Add a CBC fixture matrix and segmented corpus report

Create fixture rows for normal exact cases, Russian and other supported-language aliases, parenthetical abbreviations, OCR substitutions/negative controls, missing unit/specimen/value kind/method, and cross-family conflicts. Each row declares expected result, expected definition/analyte when concrete, missing axes, and conflict evidence. The corpus runner reports CBC coverage by outcome and evidence dimension without mutating observations or revisions.

### 6. Guard conversion and consumer boundaries by active reviewed identity

Conversion and assessment tests call the same read-boundary helpers used at runtime. They must reject null/partial/ambiguous/unmapped outcomes, candidate keys found only in decision evidence, provisional definitions, and inactive revisions. Only an active revision with `resolved`, a reviewed Registry 2.0 definition, and synchronized projection may reach conversion or reviewed assessment binding.

## Risks / Trade-offs

- **Fixture breadth:** Multilingual and OCR coverage can grow faster than reviewed clinical definitions. Keep unsupported spellings as explicit negative/partial fixtures rather than promoting them automatically.
- **Bare-label behavior:** More precise aliases will increase partial/ambiguous outcomes for rows that previously resolved accidentally. This is intentional; launch reporting must make the added uncertainty visible.
- **Method availability:** Existing extraction may not reliably emit method or differential population. The design favors safe incomplete outcomes until EH-112 supplies the final UI/API path for completing them.
- **Catalog identity changes:** Renaming or splitting existing CBC keys may affect downstream fixtures and persisted references. Migrate every active caller in the implementation task and retain no runtime v1 fallback.
- **No database change expected:** If implementation finds that EH-112's persisted outcome contract is absent from this checkout, stop at the established read/write boundary and record the prerequisite rather than inventing a parallel schema.