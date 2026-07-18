## Context

**Current state:**
- `observations`: numeric `value` NOT NULL, unique `(profile_id, biomarker_key, observed_at)`.
- `document_extracted_biomarkers`: already has `value_numeric`, `value_text`, `source_page`, `source_text`, `bounding_box`, `confidence`, `raw_name` — but acceptance **drops** rows without numeric value (`biomarker-acceptance.ts`).
- Extraction prompts say “skip qualitative Negative/Positive”.
- `document_pages.ocr_json_storage_path` stores page OCR JSON without a single documented app-level schema contract for consumers.
- Catalog/units change (`biomarker-catalog-and-units`) introduces canonical keys and `scoreRole`; this change builds specialty + storage identity on top.

**Domains:** documents + health-profile.

## Goals / Non-Goals

**Goals:**
- Persist qualitative and semi-quantitative lab lines end-to-end (extract → review → accept → list).
- Catalog hormones, tumor markers, coag, acute cardiac, autoimmune as **display-only** specialty markers (aliases + system `general` or tags).
- Expand observation identity with `specimen` + `modifier` and migrate uniqueness.
- Define and enforce extraction provenance fields and OCR artifact contract; copy provenance onto accepted observations where useful.
- Guarantee body-map / wellness scores ignore qualitative and specialty display markers.

**Non-Goals:**
- Clinical interpretation of dipstick or PSA (no diagnosis).
- Body-map “wellness scoring” of hormones, tumor markers, troponin, D-dimer, ANA, etc.
- Full spatial OCR editor / human bbox correction UI (provenance display is enough v1).
- Replacing catalog/units work (depends on it for score roles when available).

## Decisions

### D1 — Observation value kinds

**Choice:** observations become multi-kind:

```sql
value_kind text not null default 'numeric'
  check (value_kind in ('numeric', 'qualitative', 'ordinal', 'text'));
value numeric null,           -- nullable when non-numeric
value_text text null,         -- raw printed result
ordinal int null,             -- optional rank for Trace/1+/2+/3+
unit text not null default '',
```

Rules:
- `numeric`: `value` required (current behavior).
- `qualitative` / `ordinal` / `text`: `value_text` required; `value` optional.
- CHECK: `(value_kind = 'numeric' AND value IS NOT NULL) OR (value_kind <> 'numeric' AND value_text IS NOT NULL)`.

**Ordinal map (urine dipstick default):**  
`negative=0, none=0, absent=0, trace=1, +/1+=2, ++/2+=3, +++/3+=4, ++++/4+=5, positive=2` (positive without grade → 2). Unknown strings stay `text` without ordinal.

**Why not only value_text:** trends and sorting for dipstick need ordinal; numeric labs stay first-class.

### D2 — Qualitative urine catalog keys

**Choice:** catalog (display/extended, never core score):

| key | notes |
|-----|--------|
| `urine_protein_dipstick` | qualitative |
| `urine_glucose_dipstick` | qualitative |
| `urine_ketones` | often qualitative |
| `urine_blood_dipstick` | qualitative |
| `urine_nitrite` | qualitative |
| `urine_leukocyte_esterase` | qualitative |
| `urine_bilirubin_dipstick` | qualitative |
| `urine_urobilinogen` | often semi-quant |
| `urine_ph` | numeric if present |
| `specific_gravity` | numeric if present |

Quantitative `uacr`, `urine_albumin`, `urine_creatinine` remain numeric (owned primarily by catalog/units change). Specimen always `urine` for these keys.

UI: Biomarkers table shows text result; optional simple timeline by ordinal; **excluded from health-systems state_score**.

### D3 — Specialty markers = display only (“scoring” = explicit non-score)

User asked for “hormones/tumor scoring”. Correct product meaning from research:

- **Do catalog and show** them.
- **Do not** put them on body-map wellness score.
- Optional: include in specialty report prompts factually when present.

Catalog groups (`scoreRole: display`, `system: general`, tags):

| Tag | Examples |
|-----|----------|
| `hormones` | total_testosterone, free_testosterone, shbg, estradiol, progesterone, lh, fsh, prolactin, dhea_s, cortisol, … |
| `tumor_markers` | psa, cea, afp, ca_125, ca_19_9, … |
| `coagulation` | pt, inr, aptt, fibrinogen, d_dimer |
| `cardiac_acute` | troponin_i, troponin_t, bnp, nt_pro_bnp, ck, ck_mb |
| `autoimmune` | ana, rf, anti_ccp, c3, c4, ige, igg, iga, igm |

Scoring filter (hard rule in `buildHealthProfile` / markerStateScore path):

```
if scoreRole === 'display' OR value_kind !== 'numeric' → skip state_score & coverage
```

Even if a specialty marker has numeric ref ranges, **do not** contribute to organ badges. Drawer/list may still show “outside lab reference range” factually if we later add a non-score badge on biomarkers page only — v1: show value + lab ref, no body-map impact.

### D4 — Observation identity: specimen + modifier

**Choice:** add columns and **replace** unique constraint:

```sql
specimen text not null default 'unspecified'
  -- serum | plasma | whole_blood | urine | other | unspecified
modifier text not null default 'none'
  -- none | fasting | random | free | total | direct | indirect |
  -- calculated | ionized | absolute | percent | ...
unique (profile_id, biomarker_key, observed_at, specimen, modifier)
```

Canonical keys already separate many cases (`free_t4` vs `t4`, `urine_creatinine` vs `creatinine`). Specimen/modifier still required when:
- same key appears on blood + urine same day without distinct keys;
- absolute vs percent differentials if keys collide;
- fasting vs random glucose if both stored under `glucose` (prefer distinct keys when known; modifier as backstop).

**Upsert onConflict** updates to new constraint columns.

**Migration:**
1. Add columns with defaults `unspecified` / `none`.
2. Backfill from key prefixes/suffixes (`urine_*` → specimen urine) and catalog specimen hints.
3. Drop old unique; create new unique.
4. Accept path sets specimen/modifier from extraction or catalog default.

**Alternative rejected:** include `document_id` in unique — would allow same test twice same day from two labs (sometimes desired) but breaks “latest by key” health profile without richer latest-by-identity logic. v1 stays document-agnostic uniqueness; latest-by `(key, specimen, modifier)` for profile.

### D5 — Raw OCR / provenance schema

**Choice:** two layers.

**A. Page OCR artifact (storage JSON at `ocr_json_storage_path`)** — documented contract:

```ts
type PageOcrArtifact = {
  schema_version: 1;
  engine: string;
  page_number: number;
  width?: number;
  height?: number;
  full_text: string;
  blocks?: Array<{
    text: string;
    confidence?: number;
    bbox?: { x: number; y: number; w: number; h: number }; // normalized 0–1 or px + coordinate_space
  }>;
  coordinate_space?: "normalized" | "pixel";
  created_at: string;
};
```

Worker writes this shape; readers tolerate missing `blocks`.

**B. Extracted biomarker provenance** (row-level, already partially present):

Required on write when available:
- `raw_name`, `value_numeric` | `value_text`, `unit`, `reference_range`
- `source_page`, `source_text`, `bounding_box`, `confidence`
- `specimen`, `modifier` (new on extract table too)
- `reported_alt_value`, `reported_alt_unit` (optional dual-unit line)
- `extraction_method`, `processing_version`, `extraction_model`

**C. Observations provenance (subset on accept):**

```sql
raw_name text,
value_text text,          -- also qualitative
value_kind text,
ordinal int,
specimen text,
modifier text,
source_page int,
source_text text,
bounding_box jsonb,
confidence numeric,
reported_alt_value numeric,
reported_alt_unit text,
source_extracted_biomarker_id uuid  -- already exists
```

Acceptance copies provenance from extract row; qualitative rows accepted without numeric.

### D6 — Extraction prompt changes

- Remove “skip qualitative”; instruct: quantitative → value number; qualitative → value_text + value_kind.
- Always attempt source_page / source_text / confidence.
- Specimen and modifier when printed (urine panel, free/total, fasting).

### D7 — UI surfaces

| Surface | Behavior |
|---------|----------|
| Extraction review | Show text results; accept enabled without number |
| Biomarkers table | Value column shows number or text; specimen/modifier chips when ≠ default |
| Trend chart | Numeric only; qualitative optional ordinal sparkline later (v1: hide chart or show ordinal if all ordinal) |
| Health profile | Exclude display + non-numeric from system scores; specialty stay out of organ cores |
| Document viewer | Existing extract list shows value_text |

### D8 — Ordering vs catalog/units change

Implement **after** or **with** `biomarker-catalog-and-units`. If catalog not merged, specialty keys still work as hard-coded display map temporary — prefer real catalog entries.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Unique migration fails on unexpected duplicates | Pre-migration query; merge/delete policy; defaults isolate old rows |
| Nullable `value` breaks clients | API always returns `value: number \| null` + `value_text` + `value_kind`; update TS types |
| Users panic over PSA out-of-range on body map | Hard exclude display role from scores; neutral copy only |
| Ordinal map wrong for lab-specific scales | Store raw text always; ordinal best-effort |
| Bbox coordinate space mismatch | `coordinate_space` field; viewer handles both |
| Acceptance previously skipped qualitative silently | Metrics/log count accepted qualitative |

## Migration Plan

1. Schema: add columns + CHECKs on `observations` and `document_extracted_biomarkers`; keep old unique temporarily.
2. Backfill specimen/modifier from keys/catalog.
3. Detect remaining duplicates; merge.
4. Swap unique constraint; update upsert `onConflict`.
5. Deploy code: acceptance, extraction, APIs, UI.
6. OCR writers emit `schema_version: 1` artifacts.
7. Rollback: keep new columns nullable-friendly; unique harder to roll back — test on staging first.

## Open Questions

- None blocking. Optional later: include `document_id` in uniqueness for multi-lab same-day; ordinal chart v2.
