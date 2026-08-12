## Context

EasyHealth turns uploaded lab PDFs/images into reviewable Registry 2.0 observations. Identity today is:

```
document → worker extract (LLM) → document_extracted_biomarkers
        → resolveMeasurementDefinition (alias admission + axes)
        → review UI → write_observation_normalization_revision_v2
```

Current gaps for non-English labs:

1. **Identifier vs label conflation.** `snakeCaseToken` (`[^a-z0-9]+`) is used for alias `normalizedValue` and admission. Pure Cyrillic collapses to `""`; mixed forms like `свободный_т4` become `"4"`. Spanish diacritics are stripped rather than normalized deliberately.
2. **Dead RU catalog content.** Legacy `BIOMARKER_DEFINITIONS` and some Registry 2.0 seeds contain Cyrillic strings that cannot match under current normalization. CBC `russianValues` often only work when a Latin code remains after strip (`Гемоглобин (HGB)` → `hgb`).
3. **Fake language coverage.** Candidate-release docs declare `language: "ru"` while `rawLabel` is English. Gates can pass without Cyrillic/Spanish authenticity.
4. **Extraction authority leak.** Pipeline prompts ask for English snake_case keys and human-readable names. Worker stores `biomarker_name` / `raw_name` from that name. Resolver already says extraction keys are non-authoritative for `resolved`, but practice still leans on Englishized labels.
5. **Product stance.** UI remains English (`No localization` in EH-114 QA). That stays. Pipeline multilingualism is separate.

Stakeholders: Registry/catalog owners (alias review), documents pipeline, release-gate CI, clinical safety (no auto-catalog, no false resolve).

## Goals / Non-Goals

**Goals:**

- Reliable EN + RU + ES **data pipeline**: extract → normalize labels → alias match → resolve → review display of originals + English canonical.
- Dedicated `normalizeMeasurementLabel` contract, not an overload of `snakeCaseToken`.
- Every admitted alias has locale; first launch slice has genuine EN/RU/ES reviewed coverage.
- Genuine multilingual corpus + per-language release gates.
- Unknown rows stay raw `unmapped` / needs review; no auto catalog growth.
- Pre-implementation audit of read/write paths, migration/backfill, collisions, precedence, regressions.

**Non-Goals:**

- UI i18n, translated system messages, locale switcher, Spanish/Russian product chrome.
- Full-catalog alias translation in the first release (architecture must allow it; slice is limited).
- Cloud OCR vendors, new document types, automatic measurement-definition creation.
- Changing EH-104/106 acceptance primitives, score math, or clinical interpretation language beyond preserving originals.
- Making locale a hard filter that hides global EN aliases when document language is unknown (see Decisions).

## Decisions

### 1. Split identifier normalization from measurement-label normalization

**Decision:** Keep `snakeCaseToken` / `normalizeBiomarkerKeyToken` for **identifiers** (keys, internal tokens). Add `normalizeMeasurementLabel(raw, options?)` for **human measurement labels** used by alias admission and collision checks.

**Behavior (authoritative form):**

| Step | Rule |
|------|------|
| Unicode | NFKC |
| Case | locale-independent lowercase (Unicode) |
| RU | `ё`/`Ё` → `е` |
| ES | keep `áéíóúüñ` in the **primary** form |
| Whitespace | collapse internal whitespace to single space; trim |
| Punctuation | map common separators (`-`, `/`, `,`, `;`, `:`, `()`, `[]`, `·`) to space then collapse; preserve letters/digits from all scripts |
| Empty/weak | reject empty; reject tokens that are only digits or only 1–2 generic Latin letters unless the alias is explicitly `exact` with reviewed lab scope (default: reject weak normalized forms at catalog build) |

**Accent-folded ES fallback:** secondary form strips combining marks after NFKD for matching only when primary form misses. Fallback is **controlled**: catalog validation fails if two different measurement definitions would both admit the same folded form under active reviewed-resolution aliases. Fallback never applies to pure-digit or weak tokens.

**Why not expand `snakeCaseToken`:** It is already a key/token contract used widely; overloading it would either break key stability or continue erasing non-Latin scripts. Separate functions make migration and tests explicit.

**Alternatives considered:** (a) transliteration-first RU→Latin — rejected as primary (lossy, collisions); may be a future OCR assist only. (b) ICU full locale lowercasing per language — deferred; NFKC + Unicode lower is enough for lab labels.

### 2. Alias model: locale required, laboratory optional

**Decision:** Every `AliasDefinition` used for admission MUST set `locale` to `en` | `ru` | `es`. `laboratory` remains optional and only when wording is lab-specific. Locale is **provenance + catalog coverage dimension**, not a hard match filter in v1 of this change (matches current alias-authority text that locale must not expand scope until selection exists). Document-level detected language MAY later prefer same-locale aliases for ranking, but MUST NOT drop a unique cross-locale exact/normalized match that is clinically unique.

**Coverage classes per measurement in the first slice (each locale):**

1. Full localized name(s)
2. Common abbreviations
3. Localized name + international code in parentheses
4. Real-world laboratory wording from fixtures
5. Safe OCR variants (`ocr_variant` / bounded fuzzy only when reviewed)

**Authenticity rule:** A fixture or alias bundle marked `ru`/`es` fails validation if its operative labels are English-only (Latin clinical words without that language’s script/diacritic markers or approved bilingual forms). Mixed `Гемоглобин (HGB)` / `Hemoglobina (HGB)` is valid multilingual wording, not a substitute for pure-Cyrillic / pure-Spanish coverage where the slice requires it.

**First launch slice (must have genuine EN+RU+ES):**

- CBC family already in launch catalog
- Basic metabolic / biochemistry panel markers in launch catalog
- Lipid profile
- Thyroid panel
- Common liver and kidney markers in launch catalog
- Glucose family + HbA1c
- Common qualitative tests already in launch catalog

Architecture: alias tables and validators are catalog-wide; non-slice definitions MAY ship EN-only until a later pack, but release gates for “multilingual slice complete” only score the slice set.

### 3. Resolver precedence (authoritative vs soft assist)

```
                    rawLabel (verbatim from document)
                              │
                              ▼
                 normalizeMeasurementLabel
                              │
                              ▼
              findAliasAdmissions (reviewed aliases)
                              │
              ┌───────────────┼────────────────┐
              ▼               ▼                ▼
         unique strong    multiple OK      no alias hit
         reviewed match   candidates
              │               │                │
              ▼               ▼                ▼
         continue axes    ambiguous/       try soft assist:
         scoring…         partial path     LLM key/name hint
                                              │
                                   may add recognition-only
                                   evidence; MUST NOT alone
                                   yield `resolved`
```

**Rules:**

1. Authoritative label evidence = active alias admission on **original** `rawLabel` (and declared match policy).
2. LLM `biomarker_key` / English `name` MAY be stored and MAY contribute non-authoritative hint evidence (existing extraction-proposal path).
3. Soft assist MUST NOT convert `unmapped`/`ambiguous` into `resolved` without registry alias (or definition-key) authority already required by context-aware resolution.
4. Laboratory-scoped aliases still require matching laboratory when scope is set.
5. Unknown label → `unmapped`; preserve raw row; never insert a new measurement definition.

### 4. Extraction contract

**Decision:** Pipeline extraction schema gains / enforces:

| Field | Role |
|-------|------|
| `raw_name` / verbatim label | **Authoritative** source label as printed (required when a row is emitted) |
| `source_text` | Verbatim snippet for provenance (existing) |
| `biomarker_name` | Display hint; SHOULD equal raw when non-English; MUST NOT replace raw |
| `biomarker_key` | LLM canonical hint only |
| `value` / `value_text` | For qualitative: **verbatim** lab wording in `value_text` / raw value fields |
| normalized qualitative | Separate derived field/path (e.g. mapped ordinal/kind), not a destructive overwrite |

Prompt changes:

- Explicitly require copying the printed test name into the verbatim field without translation.
- Allow English key as optional parallel hint.
- If document is not a lab report → empty array (existing).
- Do not invent catalog entries.

Worker write path MUST persist verbatim into `raw_name` (and keep `biomarker_name` coherent). Resolver input `rawLabel` MUST prefer `raw_name` over Englishized name.

### 5. Qualitative values

**Decision:** Preserve original text (`Отрицательно`, `Negativo`, `Negative`). Derive `value_kind` / optional ordinal via locale-aware patterns (extend existing RU fragments; add ES). Store normalized English token only as derived metadata for cross-locale comparison if needed—never as the only retained text.

### 6. Review UI (English shell)

**Decision:** No i18n framework. Review row rendering MUST show:

1. Original label (verbatim `raw_name`)
2. Canonical English measurement `displayName` when resolved; outcome labels stay English (`Matched measurement`, etc.)
3. Original value, unit, reference range (existing raw-evidence-first rule)

If unresolved: still show original label/value; English guidance from incomplete-outcomes.

### 7. Corpus and release gates

**Decision:** Extend candidate-release corpus:

- Replace fake RU docs with pure-Cyrillic and mixed RU fixtures.
- Add ES fixtures with diacritics and at least one regional wording variant where clinically distinct aliases exist.
- Include OCR noise, unknown biomarkers, and ambiguous same-label-different-measurement cases per language.
- Segment metrics by `language ∈ {en,ru,es}` for recognition, resolution, false concrete resolution, alias empty-normalize failures.
- Aggregate pass MUST NOT override a failed language segment.
- Hard checks: pure-Cyrillic alias normalize ≠ empty; ES diacritic aliases match primary form; raw label preserved in extraction fixtures; unknown stays unmapped; ambiguous not auto-accepted; EN corpus non-regression; fixture language authenticity.

### 8. Collision policy

At catalog build / `validateMeasurementRegistry`:

| Check | Severity |
|-------|----------|
| Alias normalizes to empty | **Error** |
| Alias normalized form weak (digits-only / too short generic) without explicit allowlisted exact+scoped exception | **Error** |
| Same locale + same primary normalized form → two different measurement definition keys (active reviewed-resolution) | **Error** unless definitions are intentionally distinguished only by axes and aliases are axis-qualified (prefer separate alias strings) |
| Accent-folded ES collision across definitions | **Error** for enabling fold fallback on those aliases; primary-form-only aliases may remain |
| EN regression fixture fails | **Error** |
| Slice measurement missing locale pack | **Error** for multilingual slice gate |

Resolver runtime: on unexpected double admission, existing ambiguous/tie rules apply—never pick by lexical key alone.

### 9. Migration and backfill

**Decision:**

1. **Catalog-time migration (required):** Recompute all alias `normalizedValue` via `normalizeMeasurementLabel`. Fail build on empty/collisions. Repair or remove dead Cyrillic strings; add proper RU/ES packs for the slice.
2. **No silent patient observation rewrite** of raw labels/values.
3. **Extracted rows:** New extractions follow new contract. Historical rows keep stored fields; reprocess MAY refresh extraction under existing supersession rules when operators choose.
4. **Normalization revisions:** Existing traces remain readable. New resolutions use new admission path. Optional registry reprocess batches (EH-116) can remap incomplete rows after alias packs land—manual verified revisions stay protected.
5. **Legacy `BIOMARKER_DEFINITIONS` Cyrillic aliases:** Either migrate into Registry 2.0 alias authority with locale or stop advertising them as matching; do not leave dual matchers.

### 10. Pre-implementation audit (blocking task phase 0)

Before coding cutover, produce a written audit checklist covering:

- Read paths: review DTO, biomarkers API, health profile consumers, corpus runner, reprocess diff.
- Write paths: worker insert, accept/correct writer RPC, reprocess apply.
- Alias sources: Registry 2.0 seeds, CBC russianValues, old catalog definitions, DB alias tables if any.
- Collision inventory on current catalog after dry-run normalize.
- Resolver precedence tests matrix (EN exact, RU pure, ES accent, soft assist, unknown, ambiguous).
- Gate scripts and CI entrypoints to extend.

### 11. Release approvals: roles, not distinct people (temporary, this candidate)

**Finding.** `policy.json` binds approval scopes to *role strings*
(`registry-safety-reviewer`, `release-manager`, `assessment-owner`), and
`validateApprovals` matches scope + role + candidate-input hash, plus
`bindingKey` for score-affecting scopes. `approvedBy` is free text and is only
checked for non-emptiness. Neither the code nor
`registry-release-corpus-governance` / `release-gate-integrity` requires the
three roles to be held by different people, and all seven pre-existing approvals
were signed by a single `Project Owner`.

**Decision (owner, this candidate only).** One Project Owner may act in all
three roles for this release. This is accepted under the current policy and the
existing precedent, and is recorded here so it reads as a deliberate choice
rather than an oversight.

**Explicitly out of scope.** No `requireDistinctApprovers` flag and no
separation-of-duties check is added in this change. Tracked as a separate
governance improvement: when an independent safety reviewer exists, the policy
should gain the flag and `validateApprovals` the corresponding assertion.

**Related cleanup done here.** `scoreAffectingBindingOwners` previously named
`crp_serum`, which no corpus row can reach: its assessment binding has
`scoreRole: "display"`, and the corpus runner filters display bindings out of
`assessmentImpact`, so no approval is ever demanded for it. The entry was
removed so the policy describes the current release surface rather than a
hypothetical future score-affecting binding. This moved the candidate input hash
before any approval was signed, which is the cheapest possible moment for it.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Accent-fold false friends in ES (e.g. distinct analytes) | Fold only as fallback; collision gate disables fold for conflicting pairs |
| RU abbreviations collide (e.g. short forms) | Weak-token ban; require longer forms or exact+lab scope |
| LLM still translates labels | Schema + prompt + worker assert non-empty raw; fixtures fail if raw equals forced English when source is RU/ES |
| Alias pack workload large | Incremental slice; architecture catalog-wide; gates only enforce slice first |
| Performance of Unicode normalize on large catalogs | One-time normalize at catalog build; runtime compares precomputed `normalizedValue` |
| Dual catalog (v1 definitions vs Registry 2.0) confusion | Single admission path remains Registry 2.0; migrate or drop dead v1 RU strings |
| Fake green CI from English-labeled “RU” fixtures | Authenticity validators on fixture language |
| Review UI clutter showing both names | Clear visual hierarchy: raw first, canonical English secondary (design in tasks; English chrome only) |

## Migration Plan

1. **Phase 0 – Audit** (read-only): path inventory, dry-run normalize collisions, fixture authenticity report.
2. **Phase 1 – Label normalizer + catalog validation** without flipping runtime admission (feature flag or parallel compute + tests).
3. **Phase 2 – Alias admission cutover** to `normalizeMeasurementLabel`; repair EN/RU/ES slice aliases; fail build on empty/collision.
4. **Phase 3 – Extraction contract** + worker persistence + resolver `rawLabel` preference + qualitative verbatim.
5. **Phase 4 – Review DTO/UI field wiring** (display only).
6. **Phase 5 – Corpus + segmented gates** + EN regression lock.
7. **Phase 6 – Optional reprocess** of incomplete historical docs after pack release (ops, not forced).

Rollback: keep prior normalizer behind flag only through Phase 2; after cutover, rollback = previous registry release manifest + prior worker version (standard registry rollback notes).

## Open Questions

Resolved by product input in this change request — recorded here for implementers:

- UI i18n → **out of scope**
- Catalog breadth → **full architecture, slice-first coverage**
- Soft assist → **allowed, non-authoritative**
- Auto catalog from uploads → **forbidden**
- `snakeCaseToken` expansion → **forbidden for this purpose**

Remaining implementation details (non-blocking for proposal):

1. Exact JSON field name in LLM schema (`raw_name` vs nested) — prefer align with existing DB `raw_name`.
2. Whether document-level `detected_language` is persisted this change or deferred (prefer persist when cheap from classification; not required for alias admission v1).
3. Minimal ES regional variant set for the first slice (Spain vs LATAM lipid/thyroid wording) — choose from real de-identified fixtures during pack authoring.
