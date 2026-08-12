## Why

Registry 2.0 has 107 runtime measurement definitions, 77 analytes, and 625 multilingual aliases. The catalog needs a complete, human-readable reference that stays mechanically synchronized with the typed runtime source; a manually maintained GitHub issue would exceed the issue-body limit and would drift from resolution behavior.

## What Changes

- Add a deterministic documentation generator that renders Registry 2.0 source data, actual runtime persistence/consumer boundaries, and approval-independent technical candidate-corpus evidence into canonical files under `docs/`.
- Generate the module lifecycle guide, full catalog, alias-governance reference, corpus evidence reference, concise Registry v1 legacy disposition, and a deterministic GitHub Wiki mirror export.
- Render a concise GitHub issue body as stdout-only text; a separately authorized maintainer action may publish it as an index/tracking entry. It links to canonical `docs/` files and MUST NOT duplicate the catalog.
- Add generator contract tests, versioned count-and-manifest-baseline validation, Wiki-export derivation checks, and a stale-output check that run in the Measurement Registry CI workflow.
- Update only a marker-delimited managed section of `docs/README.md`, preserving all unrelated documentation byte-for-byte.

## Capabilities

### New Capabilities
- `generated-biomarker-documentation`: Deterministic generation, validation, CI drift detection, and canonical documentation for Registry 2.0 biomarker data.

### Modified Capabilities

- `health-profile`: Extract the existing laboratory-admission projection into one pure shared helper without changing its inputs, admission decisions, presentation/conversion behavior, or downstream scoring.

## Impact

- New generator, verifier, and Wiki-export scripts plus package commands for regeneration, stale-output checking, contract testing, side-effect-free Wiki rendering, and local Wiki staging.
- Generated files: `docs/03-modules/biomarkers.md`, `docs/05-data/biomarker-catalog.md`, `docs/05-data/biomarker-aliases.md`, and `docs/05-data/biomarker-corpus-evidence.md`.
- `docs/README.md` gains canonical links; Registry v1 remains authoritative at `registry/biomarker-registry/v1.0.0/AUDIT.md` and is summarized, not copied.
- The published GitHub Wiki becomes a generated mirror of the four canonical docs. Its seven owned pages are produced locally and published only through a separately authorized maintainer action.
- `.github/workflows/measurement-registry.yml` gains or confirms generator drift and contract checks.
- A maintainer may create or update one concise GitHub issue only after separately authorizing publication of the stdout-rendered body; it is an index, not a second source of truth.
- No behavioral change to runtime extraction, resolver, database schema, catalog identity, Health Profile/scoring, or release approval behavior. The sole runtime-code edit is a semantics-preserving extraction of the existing Health Profile laboratory-input projection so the route and documentation contract test share one executable boundary.
