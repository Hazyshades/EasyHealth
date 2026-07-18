## Context

Today biomarker identity is a thin `normalizeBiomarkerKey` (snake_case only). Categorization lives in a hardcoded `BODY_SYSTEMS` map in `src/lib/health-systems.ts` (34 keys, 7 named systems + `general`). Observations store lab-native `value`/`unit`/`ref_*` but the app never converts units. Unmapped keys still store and show under General.

Research in `biomarkers/q1.md` and `biomarkers/q2-q13.md` (Labcorp SI tables, NGSP HbA1c, BUN/urea chemistry, EN+RU aliases) is the clinical input for this design. Domain: **health-profile** (+ settings in auth-shell, key normalize on documents write path).

**Constraints:**
- Educational product: score = in/out of **lab reference range**, not risk calculators or diagnoses.
- Do not mutate stored observation values when the unit toggle flips.
- Existing unique constraint `(profile_id, biomarker_key, observed_at)` remains for v1 (specimen-specific keys like `urine_creatinine` avoid most collisions).

## Goals / Non-Goals

**Goals:**
- Single canonical catalog drives systems, aliases, score/coverage roles, conversion rules, and docs.
- Fragmented keys resolve to canonical identity on write, read, and via backfill.
- Global `us` | `si` lab unit preference with safe analyte-specific conversion of value + refs.
- Layer-1 catalog expansion so ordinary CMP/CBC/inflammation/iron/UACR labs leave General.
- Body map stays organ-centric (≤9 including general) with tags for panels (electrolytes, iron, cmp).
- Score/coverage do not explode when extended markers appear.

**Non-Goals:**
- Qualitative/semi-quantitative urine storage model (`Negative`/`1+`).
- Scoring hormones, coagulation, troponin, tumor markers, autoimmune panels.
- ASCVD or clinical decision support calculators.
- Rewriting historical rows into SI in the database.
- Expanding uniqueness to specimen/modifier dimensions (defer unless production collisions).
- Full raw OCR bbox audit schema.

## Decisions

### D1 — Canonical catalog as code SoT

**Choice:** `src/lib/biomarkers/` modules (typed TS), not only JSON and not scattered maps.

```
src/lib/biomarkers/
  types.ts
  catalog/   # per-system modules, merged in index
  normalize.ts
  units.ts
  systems.ts   # derived BODY_SYSTEMS / MARKER_TO_SYSTEM
  index.ts
```

Each `BiomarkerDefinition`:
- `canonical_key`, `display_name`, `system`, `scoreRole`, `coversConfidence` (boolean)
- `aliases[]` (EN+RU, post-normalization forms)
- `specimen?`, `tags[]`, `equivalence_group?`, `derived?`
- `conversion` rule: `linear` | `equal` | `formula` | `none`

**Why:** Type-safe, importable by scoring/UI/tests; easier than dual JSON+codegen for this repo size.

**Alternatives:** JSON + codegen (more pipeline); keep maps in `health-systems.ts` (already fragmented).

### D2 — Alias resolution: write + read + backfill

**Choice:** Three layers.
1. **Write:** extraction/acceptance always stores canonical key after `resolveCanonicalKey`.
2. **Read:** group/score/chart resolve keys again (defense in depth).
3. **Backfill:** one-shot script/SQL maps known alias keys → canonical; on unique conflict same day, keep the more complete row (prefer refs/unit), delete/merge other; preserve old key in a log or optional metadata column if cheap.

**Why:** Write-only leaves legacy mess; read-only leaves duplicate keys under unique constraint.

### D3 — Score role vs coverage

**Choice:** Two dimensions:
- `scoreRole`: `core` | `extended` | `display` — whether present markers enter `state_score` (core only; extended optional later weight 0).
- `coversConfidence`: only markers with `true` count in system **coverage denominator**.

Example kidney:
- Coverage set: `creatinine`, `egfr`, nitrogen waste (`bun` **or** `urea` via equivalence), `uacr`
- Score-eligible core also includes Na/K/Cl/HCO3/Ca when present
- Extended: Mg, phosphate, urine_albumin, etc.
- Display: qualitative urine (future), ratios

**Why:** Research listed many kidney “core” markers; using all as coverage would tank confidence for partial labs.

**Scoring rule:** state score averages only `scoreRole=core` markers that have numeric lab refs; unknown-ref excluded from score (trend only). Missing extended never reduces confidence.

### D4 — Body systems taxonomy

**Choice (9 ids):**
`cardiovascular`, `metabolic`, `thyroid`, `liver`, `kidney`, `blood`, `nutrients`, `inflammation`, `general`

Migrations from current:
- `vitamins` → `nutrients` (id rename; backward-compat map `vitamins` → `nutrients` if any client caches old id)
- New: `inflammation` (`crp`, `hs_crp`, `esr`)
- Move `ferritin`, `iron` → `blood`
- Electrolytes + quantitative urine/UACR → `kidney` with tags `electrolytes`, `urine`
- Albumin / total_protein / globulin → `liver` (albumin core; proteins extended)
- ApoB stays cataloged but `scoreRole=extended` (was equal weight with lipids)
- Thyroid core: `tsh`, `free_t4` only; rest extended

**Why:** Organ-centric body map; panels as tags not extra silhouette badges. Research §10 agrees.

### D5 — Unit preference: display-only

**Choice:**
- Column `profiles.lab_unit_system text not null default 'si' check (in ('us','si'))`
- UI: Settings primary control + quick toggle on `/app/biomarkers`
- `presentObservation(obs, system)` converts value + ref_low + ref_high when rule safe and source unit family detected; else native + `unit_unrecognized`
- Badge when converted: “Converted for display · Original: …”
- Never write converted values back to `observations`

**Special cases:**
| Case | Behavior |
|------|----------|
| BUN/urea | Separate keys + `equivalence_group: urea_nitrogen`; UI remaps label/unit by preference with badge |
| HbA1c | NGSP↔IFCC formulas (not ×10) |
| Lp(a) | do not convert mg/dL↔nmol/L |
| eGFR, enzymes, %, equal cell counts | none or label-only |
| Dual-unit PDF line | one observation + optional alternate metadata later; no two rows |

**Default:** `si` (international); user can switch to `us`.

**Factors source of truth:** freeze Labcorp-aligned table from research in `units.ts` with unit tests; do not mix divergent third-party factors ad hoc.

### D6 — Layer-1 key expansion (in catalog)

**P0:** electrolytes (Na K Cl HCO3 Ca), albumin/total_protein/globulin, inflammation (crp hs_crp esr), CBC indices (mcv mch mchc rdw), neutrophils/lymphocytes/monocytes/eosinophils/basophils **abs** (extended), uacr + urine_albumin + urine_creatinine, iron move + tibc + transferrin_saturation (transferrin/uibc if straightforward).

**P1 (same change if capacity):** magnesium, phosphate, uric_acid, direct_bilirubin, lpa, vldl, thyroid abs, full iron panel remainder.

**P2 (catalog display-only stubs optional):** hormones, coag, troponin, tumor — recognize aliases, system general, display only.

### D7 — Where conversion applies

Apply `presentObservation` on:
- GET biomarkers API or client after load (prefer **server** if profile preference known, else client with preference endpoint)
- Health profile API markers
- Reports context (display units for LLM optional; at minimum pass native + note preferred system)

**Recommendation:** convert in a shared presenter used by APIs so UI stays dumb.

### D8 — Docs

`biomarkers.md` regenerated or rewritten from catalog summary (manual script acceptable: `node scripts/render-biomarker-docs.mjs` optional). Code remains SoT.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Wrong conversion factor → false out-of-range | Analyte-specific registry + convert refs with value + unit tests + badge |
| Double-convert already-SI values | Detect unit family before applying factor; no-op if already target |
| Alias backfill unique conflicts | Merge policy: keep fuller row; log counts |
| Kidney coverage too strict | Split coverage vs score (D3) |
| Body map rename breaks clients | Compat map vitamins→nutrients; versioned system ids only |
| Lp(a)/insulin pmol wrong convert | Explicit do_not_convert / avoid_default |
| Large catalog PR noise | Tasks phased A foundation → B units → C expansion UI |
| Equal-weight mild CBC noise | Differentials mostly extended/display; MCV/RDW core ok |

## Migration Plan

1. Ship catalog + normalize without requiring preference column (defaults).
2. Migration: add `lab_unit_system`; default `si`.
3. Deploy backfill job/script (idempotent); run once against prod after aliases live.
4. UI toggles; no observation value rewrites.
5. Rollback: preference column ignore; fall back to native units; catalog can remain (safe superset).

## Open Questions

- None blocking. Deferred: qualitative urine model; uniqueness expansion; locale-based default unit system.
