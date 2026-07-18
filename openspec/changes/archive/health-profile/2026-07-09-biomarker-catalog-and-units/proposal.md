## Why

EasyHealth only catalogs 34 biomarker keys with dumb `snake_case` normalization, so common lab panels (CMP electrolytes, CBC indices, CRP/ESR, iron studies, UACR) land in **General**, fragment under aliases (`Na` vs `sodium`, `Lp(a)` vs `lpa`), and cannot be displayed in a consistent US vs SI unit system. Users need a canonical catalog, reliable key identity, organ-centric body map coverage, and a global lab-unit toggle without mutating stored lab-native values.

## What Changes

- Introduce a **canonical biomarker catalog** (TypeScript modules) as the single source of truth for keys, EN/RU aliases, body system, score role, specimen, panels/tags, and unit conversion rules.
- Add **alias resolution** on write and read paths, plus a **one-shot backfill** for existing fragmented keys.
- Add **score roles** (`core` | `extended` | `display`) and separate **coverage** markers so expanding CBC/electrolytes does not dilute data confidence or over-weight noise.
- Expand catalog Layer-1: electrolytes, proteins, inflammation, CBC indices/diff abs, iron panel, UACR, advanced lipids (extended), thyroid antibodies (extended).
- Body systems: rename display `vitamins` → `nutrients`, add **`inflammation`**, move ferritin/iron → `blood`, electrolytes/UACR → `kidney`, proteins/albumin → `liver`.
- Add global **lab unit system** preference (`us` | `si`) with display-only conversion of value + refs; special cases for BUN↔urea equivalence, HbA1c NGSP↔IFCC, and do-not-convert markers (Lp(a), eGFR, enzymes, …).
- Settings + Biomarkers UI toggle; health profile and biomarker surfaces present preferred units with optional “converted for display” badge.
- Update `biomarkers.md` docs to match catalog.
- **Out of scope for this change:** qualitative urine data model, hormone/tumor/coag scoring, ASCVD calculators, rewriting historical observation values to SI, expanding uniqueness beyond current `(profile_id, biomarker_key, observed_at)` unless collisions force it.

## Capabilities

### New Capabilities

- `biomarker-catalog`: Canonical biomarker definitions, alias normalization, score/coverage roles, Layer-1 key expansion, system mapping used by health scoring and UI grouping.
- `lab-unit-preference`: Per-profile US conventional vs SI display preference, conversion registry, BUN/urea equivalence presentation, conversion badges.

### Modified Capabilities

- `health-profile`: Body map systems include `inflammation` and `nutrients` (replacing vitamins label); scoring uses core-only state and coverage rules; markers shown with preferred display units.
- `biomarkers-overview`: Unit system toggle and preferred-unit table/chart presentation; optional panel/system filters when catalog tags exist.
- `account-settings`: Lab unit system preference control.
- `health-profile-api`: Profile payload reflects new systems/roles and display-ready units when preference is applied server-side (or documents client conversion contract).

## Impact

- **Domain:** `health-profile` (primary), `auth-shell` (settings preference), documents write path (normalize keys on accept/extract).
- **Code:** new `src/lib/biomarkers/*`; `src/lib/health-systems.ts` consumes catalog; `src/lib/schemas/biomarkers.ts` alias resolve; extraction/acceptance upsert paths; `/app/settings`, `/app/biomarkers`, `/app/profile`; profile migration for `lab_unit_system`.
- **Data:** optional backfill script/migration for alias keys; no mutation of observation values/units on toggle.
- **Docs:** `biomarkers.md`, research notes under `biomarkers/` remain reference only (catalog is code SoT).
- **Research inputs:** `biomarkers/q1.md`, `biomarkers/q2-q13.md` (conversion factors, aliases, score roles, pitfalls).
