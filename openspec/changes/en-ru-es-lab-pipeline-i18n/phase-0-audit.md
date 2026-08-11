# Phase 0 audit — EN/RU/ES lab pipeline

Date: 2026-08-09
Change: `en-ru-es-lab-pipeline-i18n`

## 1.1 Read paths

| Path | Role | Label source today |
|------|------|--------------------|
| `resolveMeasurementDefinition` / `findAliasAdmissions` | Identity | `input.rawLabel` via `snakeCaseToken` |
| `measurementInputFromExtracted` / `measurementInputFromWriterRow` | Build resolver input | `raw_name ?? biomarker_name` |
| `buildNormalizationReview` / `observation-review-workspace` | Review DTO | rawEvidence.displayName from raw_name |
| `GET /api/documents/[id]` biomarkers select | API | includes `raw_name` |
| `document-viewer.tsx` | UI | prefers name fields; raw_name optional |
| `GET /api/biomarkers` | List | observations.raw_name |
| Corpus runner `scripts/lib/registry-v2-candidate-corpus.ts` | Gates | fixture `rawLabel` |
| `registry-reprocessing/diff.ts` | Reprocess preview | writer row → resolver |
| Health profile / scores | Consumers | only resolved reviewed bindings |

## 1.2 Write paths

| Path | Writes |
|------|--------|
| `worker/src/pipeline.ts` lab branch | `document_extracted_biomarkers` (`raw_name` = model `name` today) |
| `writeExtractedBiomarkerNormalization` → RPC v2 | observations + normalization revisions |
| Accept / correct / confirm-observations APIs | same writer |
| EH-116 reprocess apply | writer with classification |
| Legacy `extract-biomarkers.ts` | parallel simpler extract (not worker primary) |

No path auto-inserts measurement definitions from uploads.

## 1.3 Alias sources

| Source | Locale today | Notes |
|--------|--------------|-------|
| Registry 2.0 `aliases()` / `REVIEWED_DEFINITIONS` | mostly unset | EN literals |
| `cbcAliases` `russianValues` | `locale: "ru"` + lab `northern-diagnostics` | often mixed `Name (CODE)` |
| Fixture / sample provisional aliases | unset | EN sample_newest |
| `BIOMARKER_DEFINITIONS` (legacy catalog) | n/a strings | ~130 Cyrillic; **not** Registry 2.0 admission path (`check:no-registry-v1-runtime`) |
| DB alias tables | none for runtime Registry 2.0 | |

## 1.4 Dry-run normalize (planned rules)

Using NFKC + lower + ё→е + punct→space (not `snakeCaseToken`):

- Pure Cyrillic (`Глюкоза`, `ТТГ`) → **non-empty** (fixes current `""`).
- `свободный Т4` → keeps letters + `4` (not digits-only `4`).
- `Гемоглобин (HGB)` → `гемоглобин hgb`.
- Existing EN `Hemoglobin (HGB)` → `hemoglobin hgb` (both sides recompute → match preserved).
- Shared analyte aliases (`glucose` on serum/plasma/…) remain same-analyte co-candidates (allowed).
- Legacy catalog Cyrillic strings are out of Registry 2.0 admission; migrate content into R2 packs rather than dual matchers.

## 1.5 Fixture authenticity

| Fixture | Declared | Actual labels | Verdict |
|---------|----------|---------------|---------|
| `cbc-ru-north.json` | ru | English CBC labels | **FAIL authenticity** |
| `specialty-ru-central.json` | ru | English serology labels | **FAIL authenticity** |
| `chemistry-en-west.json` | en | EN | OK |
| `specialty-en-central.json` | en | EN | OK |
| `glucose-en-review.json` | en | EN | OK |
| ES fixtures | — | **none** | gap |

## 1.6 Resolver precedence matrix (target)

| Case | Expected |
|------|----------|
| EN exact/normalized reviewed alias + axes | `resolved` when unique |
| Pure RU reviewed alias, wrong/missing LLM key | admit via raw label; may `resolved`/`partial` by axes |
| ES diacritic primary form | admit on primary; fold only if unique |
| Mixed `Гемоглобин (HGB)` | admit RU pack |
| Soft assist LLM key only | **not** `resolved` |
| Unknown label | `unmapped`, raw kept |
| Ambiguous multi-definition | `ambiguous`, no auto-accept |

## 1.7 CI / gate files to extend

- `registry/candidate-release/v1/policy.json`, `documents.json`, `corpus.json`
- `scripts/registry-v2-candidate-corpus.ts`, `scripts/lib/registry-v2-candidate-corpus.ts`
- `scripts/verify-measurement-registry-runner.ts`
- `scripts/verify-eh113-cbc-launch-catalog.ts`, CBC regression
- `package.json` scripts: `test:measurement-registry`, `test:eh106`, `verify:registry`, new multilingual verifier
- `registry/candidate-release/v1/reset-rollback.md`

## 1.8 Migration / backfill conclusions

1. **Catalog-only cutover** for alias `normalizedValue` + required `locale` + RU/ES packs.
2. **No silent rewrite** of patient `raw_name` / qualitative text.
3. New extractions follow verbatim contract; historical rows keep stored fields.
4. **Optional** EH-116 reprocess after pack release for incomplete rows; manual revisions protected.
5. Bump `MEASUREMENT_NORMALIZATION_VERSION` / manifest digest with alias changes.
6. Do not revive legacy `BIOMARKER_DEFINITIONS` as a second matcher; port needed RU/ES strings into Registry 2.0 packs.

## Audit status

Phase 0 complete enough to implement. Open implementer notes carried into code tasks.
