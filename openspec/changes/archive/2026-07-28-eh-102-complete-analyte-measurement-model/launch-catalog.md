# EH-102 Launch Catalog Inventory

## Inputs

| Source | Current size | Launch use |
| --- | ---: | --- |
| Frozen Registry v1 | 113 canonical concepts | Migrate terminology, aliases, units, conversions, systems, and assessment policy; never load as runtime fallback |
| Current curated Registry 2.0 | 23 concrete definitions | Retain after review and remove legacy identity coupling |
| `lab_data/sample_newest.pdf` | 44 result rows | Mandatory exact-label, unit, value-kind, and resolution fixture |
| Official common-result/common-unit lists | External reference | Prioritize omissions and validate units; do not auto-approve clinical mappings |

The initial inventory therefore contains all 113 existing concepts plus at least 17 sample-specific measurement concepts or variants not represented by Registry v1. Concrete specimen, timing, and method splits will make the final number of `MeasurementDefinition` records larger than the source-concept count.

## Sample corpus groups

### Biochemistry and inflammation

- Total protein
- Glucose
- Total bilirubin
- Direct bilirubin
- ALT catalytic activity
- AST catalytic activity
- Quantitative C-reactive protein
- Antistreptolysin-O (ASO)

### Complete blood count and ESR

- RBC, hemoglobin, hematocrit, MCV, MCH, MCHC, RDW-CV
- Platelets, MPV, PDW, plateletcrit
- WBC
- Neutrophils, lymphocytes, monocytes, eosinophils, and basophils as both percentage and absolute count
- ESR by stated Westergren automated method
- Segmented and band neutrophil percentages
- Manual differential lymphocyte, monocyte, and eosinophil percentages

### Serology, parasitology, and allergy

- Giardia antibodies, total, positivity coefficient
- Ascaris IgG antibodies, qualitative/titer reporting
- Anti-Toxocara IgG, qualitative ELISA
- Anti-Opisthorchis felineus IgG, qualitative ELISA
- Anti-Echinococcus IgG, qualitative ELISA
- Anti-Trichinella species IgG, qualitative ELISA
- Total IgE
- Eosinophilic cationic protein

These specialty rows are launch display/review requirements, not assessment inputs by default.

## Exact fixture requirements

The launch corpus must cover the printed forms, including:

- parenthetical abbreviations such as `ALT (alanine aminotransferase)` and `Hemoglobin (HGB)`;
- differential abbreviations such as `NEU%`, `LYMF%`, `MON%`, `EOS%`, and `BAS%`;
- method/context suffixes such as `manual differential`, `Westergren automated`, and `qualitative ELISA`;
- unit spellings `g/L`, `mmol/L`, `umol/L`, `U/L`, `IU/mL`, `mg/L`, `x10^12/L`, `x10^9/L`, `%`, `fL`, `pg`, `mm/hour`, `ng/mL`, positivity coefficient, titer, and no unit;
- numeric, threshold, qualitative, and coefficient value kinds.

## Maturity and launch behavior

| Maturity | Recognition | Concrete resolution | Trends | Assessment |
| --- | --- | --- | --- | --- |
| Reviewed | Yes | When evidence selects one identity | Yes when identity is concrete | Only with reviewed binding |
| Provisional | Yes | No automatic concrete resolution | No definition-specific series | No |
| Retired | Historical only | No | Historical reads only | No |
| Unknown | Raw preservation only | No | No | No |

## Coverage gates

- 44/44 sample row types are recognized; none remains unexpectedly `unmapped`.
- Every raw label, value, unit, reference text, and source location remains recoverable.
- Missing specimen or method never becomes an inferred concrete identity.
- All 113 Registry v1 concepts receive an explicit migration disposition.
- Launch reports show analyte recognition, concrete resolution, ambiguity, partial recognition, unit compatibility, alias source, and assessment eligibility separately.
- Adding more PDFs extends fixtures and coverage reports; it does not require the product owner to edit registry code or manually define medical mappings.

## Assessment impact

Legacy Registry v1 score-role inventory:

| Role | Count |
| --- | ---: |
| core | 39 |
| extended | 35 |
| display | 39 |

Launch Registry 2.0 assessment state:

| State | Count | Definitions |
| --- | ---: | --- |
| reviewed bindings | 11 | `glucose_serum`, `glucose_plasma`, `fasting_glucose`, `alt_serum_catalytic_activity`, `alt_plasma_catalytic_activity`, `ast_serum_catalytic_activity`, `ast_plasma_catalytic_activity`, `alp_serum_catalytic_activity`, `alp_plasma_catalytic_activity`, `ggt_serum_catalytic_activity`, `ggt_plasma_catalytic_activity` |
| provisional bindings | 39 | migrated Registry v1 core concepts kept out of auto-score until review |

Impact summary:

- Reviewed glucose and liver-enzyme definitions can participate in score-aware consumers.
- Migrated Registry v1 concepts keep their score-role lineage but do not auto-score until a binding is reviewed.
- Display-only specialty rows remain visible for review and reports without changing health-system readiness.
