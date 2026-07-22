## 1. Catalog foundation

- [x] 1.1 Create `src/lib/biomarkers/types.ts` (`BiomarkerDefinition`, `BodySystemId`, `ScoreRole`, `ConversionRule`, unit system types)
- [x] 1.2 Create catalog modules under `src/lib/biomarkers/catalog/` for current 34 keys + Layer-1 P0 keys (systems, scoreRole, coversConfidence, aliases EN+RU, conversion stubs)
- [x] 1.3 Export merged catalog, `ALIAS_MAP`, `getBiomarkerDefinition`, `listKeysForSystem` from `src/lib/biomarkers/index.ts`
- [x] 1.4 Implement `resolveCanonicalKey` / enhanced `normalizeBiomarkerKey` in `src/lib/biomarkers/normalize.ts` (snake_case + alias map + collision guards for Na vs N/A)
- [x] 1.5 Derive system maps from catalog; refactor `src/lib/health-systems.ts` to consume catalog (`nutrients`, `inflammation`, body map anchors, system order)
- [x] 1.6 Wire write paths to resolve canonical keys: pipeline extraction, biomarker acceptance, any active extract path in `schemas/biomarkers.ts`
- [x] 1.7 Apply read-path resolution before health profile grouping and biomarkers aggregation APIs
- [x] 1.8 Implement scoring: state score from core+refs only; data confidence from `coversConfidence` set; extended/display excluded from score/coverage denominator
- [x] 1.9 Move ferritin/iron to blood; albumin core under liver; electrolytes/UACR under kidney; ApoB extended; thyroid core tsh+free_t4
- [x] 1.10 Unit tests for alias resolution, system mapping, and score/coverage math on fixtures

## 2. Alias backfill

- [x] 2.1 Add idempotent backfill script or migration helper mapping known alias keys → canonical
- [x] 2.2 Implement conflict merge for `(profile_id, canonical_key, observed_at)` preferring row with refs/unit
- [x] 2.3 Document how to run backfill (dev/prod) in change notes or `docs/`

## 3. Lab unit preference + conversion

- [x] 3.1 Supabase migration: `profiles.lab_unit_system` (`us` | `si`, default `si`)
- [x] 3.2 Profile types/API: read and update `lab_unit_system` (extend account/settings or dedicated PATCH)
- [x] 3.3 Implement `src/lib/biomarkers/units.ts`: linear/equal/formula/none registry from research (Labcorp-aligned factors); HbA1c NGSP↔IFCC; BUN/urea equivalence group presentation
- [x] 3.4 Implement `presentObservation` converting value + ref_low + ref_high with rounding rules; no-op + flag when unsafe/unknown
- [x] 3.5 Unit tests: glucose/lipids/TG factor split, creatinine, vitamin D, HbA1c both ways, Lp(a) no convert, eGFR no convert, double-convert guard
- [x] 3.6 Apply presenter on biomarkers API and health-profile API (display fields and/or converted payload)
- [x] 3.7 Settings UI: lab units control on `/app/settings`
- [x] 3.8 Biomarkers page: quick US/SI toggle, persist preference, update table/chart, conversion badge/original visibility
- [x] 3.9 Health profile drawer: show preferred units + conversion transparency

## 4. Layer-1 expansion polish + docs

- [x] 4.1 Complete P1 catalog entries if not in 1.2: magnesium, phosphate, uric_acid, direct_bilirubin, full iron panel, lpa, vldl, thyroid antibodies (roles per design)
- [x] 4.2 Optional display-only stubs for high-frequency general markers (psa, d_dimer, etc.) aliases only
- [x] 4.3 Update extraction prompts with canonical key examples (not full catalog dump)
- [x] 4.4 Rewrite `biomarkers.md` to match catalog (systems, roles, unit preference note)
- [x] 4.5 Body map anchors/layout smoke-check for 9 systems (inflammation + nutrients)
- [x] 4.6 Manual QA: sample CMP/CBC-style fixture → systems, aliases, unit toggle, scores

## 5. Verification

- [x] 5.1 Run unit/integration tests for biomarkers catalog and units
- [x] 5.2 Typecheck / build passes
- [x] 5.3 Confirm no observation value rewrite on preference toggle (storage unchanged)
