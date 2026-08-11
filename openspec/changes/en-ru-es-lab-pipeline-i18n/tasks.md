## 1. Phase 0 — Pre-implementation audit (blocking)

- [x] 1.1 Inventory all runtime **read** paths that consume labels, aliases, resolution, or review DTOs (resolver, review workspace/API, biomarkers UI, corpus runner, reprocess diff, health-profile consumers)
- [x] 1.2 Inventory all runtime **write** paths (worker `document_extracted_biomarkers` insert, accept/correct normalization writer RPC, reprocess apply, any legacy extract path still live)
- [x] 1.3 Inventory every alias source (Registry 2.0 seeds, CBC `russianValues`, old `BIOMARKER_DEFINITIONS`, DB tables if any) and note locale/laboratory metadata presence
- [x] 1.4 Dry-run current catalog literals through the planned `normalizeMeasurementLabel` rules; report empty normals, weak tokens, and cross-definition collisions by locale
- [x] 1.5 Audit candidate-release fixtures claiming `ru`/`es` for English-only label authenticity failures
- [x] 1.6 Document resolver precedence matrix cases (EN exact, pure RU, ES diacritic, mixed code forms, soft-assist-only, unknown, ambiguous) and expected outcomes
- [x] 1.7 List CI/gate scripts and release policy files that must gain language segments and authenticity checks
- [x] 1.8 Record migration/backfill conclusions (catalog-only vs patient data; reprocess optional) in the change notes or design addendum before coding cutover

Audit output: `openspec/changes/en-ru-es-lab-pipeline-i18n/phase-0-audit.md`.

## 2. Measurement-label normalization

- [x] 2.1 Add `normalizeMeasurementLabel` (and optional structured result: primary form, weak/empty flag, optional ES folded form) without changing `snakeCaseToken` behavior
- [x] 2.2 Implement RU `ё→е`, Unicode NFKC/lowercase, punctuation/whitespace rules, and empty/weak-token detection
- [x] 2.3 Implement ES primary diacritic-preserving form + collision-gated accent-fold helper
- [x] 2.4 Unit tests: pure Cyrillic non-empty; `свободный Т4` not `4`; ES accents; EN regression parity vs current successful EN fixtures; empty/weak rejection
- [x] 2.5 Wire catalog alias `normalizedValue` computation to `normalizeMeasurementLabel` (build-time)

## 3. Alias authority and catalog validation

- [x] 3.1 Require `locale: en|ru|es` on every resolver-admitted `AliasDefinition`; fail catalog validation when missing
- [x] 3.2 Fail validation on empty/weak normalized aliases and on primary-form reviewed-resolution collisions across definitions
- [x] 3.3 Fail or disable ES fold-fallback when folded forms collide across definitions
- [x] 3.4 Switch alias admission comparison off identifier `snakeCaseToken` equality onto measurement-label normalization (+ declared match policies)
- [x] 3.5 Preserve laboratory scope rules; stop using laboratory scope as a substitute for locale packs on common names
- [x] 3.6 Update registry manifest serialization/digest inputs for locale + new normalized forms; classify alias changes per existing review-required/breaking rules
- [x] 3.7 Migrate or remove dead Cyrillic strings that only “worked” via Latin residue or empty normalize; eliminate dual legacy matchers for RU labels

## 4. Multilingual launch-slice alias packs

- [x] 4.1 Freeze the explicit measurement-definition key list for the first slice (CBC, basic metabolic/biochem, lipids, thyroid, common liver/kidney, glucose/HbA1c, launch qualitative)
- [x] 4.2 Author reviewed EN alias completeness check for the slice (fill gaps only where needed)
- [x] 4.3 Author reviewed RU packs: full names, abbreviations, mixed `(CODE)` forms, real lab wording, safe OCR variants — pure Cyrillic where required
- [x] 4.4 Author reviewed ES packs with diacritics and controlled regional variants; avoid overly broad aliases
- [x] 4.5 Add slice coverage gate: each slice definition has ≥1 reviewed active alias per locale `en`/`ru`/`es`
- [x] 4.6 Ensure unknown-marker policy remains “no auto catalog growth” with regression proof

## 5. Extraction contract and worker persistence

- [x] 5.1 Update pipeline extraction schema/prompt: require verbatim printed label field; English key/name optional hints only; forbid inventing catalog entries
- [x] 5.2 Preserve qualitative verbatim value text; derive normalized kind/ordinal separately (extend RU/ES patterns)
- [x] 5.3 Worker insert path: persist verbatim into `raw_name`; keep hints in `biomarker_key` / `biomarker_name` without overwriting raw
- [x] 5.4 Resolver input mapping: `rawLabel` prefers `raw_name` over Englishized name
- [x] 5.5 Extraction fixture/tests proving RU/ES raw preservation and empty extract for non-lab documents

## 6. Resolver soft-assist and unknown handling

- [x] 6.1 Confirm/adjust soft-assist path so LLM key/name never alone yields `resolved`
- [x] 6.2 Regression: pure RU/ES alias match works with missing/wrong LLM key
- [x] 6.3 Regression: unknown label → `unmapped`, raw preserved, no definition write
- [x] 6.4 Regression: ambiguous fixtures stay non-resolved; no auto-accept
- [x] 6.5 Decision-trace fields record alias locale and match mode (including fold-fallback when used)

Closed by option B: the persisted trace is now versioned. Schema 1 is frozen and
every already-stored patient trace keeps validating with no backfill; schema 2
adds `aliasKey`, `aliasMatchType`, `aliasLocale`, `aliasLaboratory` and
`aliasFoldFallback` per candidate, and is what new decisions write. The trace is
the source of truth for those facts, and both the TypeScript writer and
`eh122_trace_matches_resolver_evidence` refuse a payload whose
`resolver_evidence` disagrees with it. Covered by
`scripts/verify-resolver-trace-v2.ts` (16 checks) and
`supabase/tests/resolver_trace_v2_alias_evidence.sql` (26 assertions).

## 7. Review surface (English shell)

- [x] 7.1 Review DTO/API exposes original label, canonical English measurement when resolved, original value/unit/reference range
- [x] 7.2 Document viewer / biomarker review UI renders raw-first evidence + English canonical secondary; outcome copy stays English
- [x] 7.3 Ensure unmapped/partial copy does not claim “label missing” when verbatim non-English label exists
- [x] 7.4 No i18n framework, locale switcher, or translated chrome in this change

## 8. Corpus fixtures and language authenticity

- [x] 8.1 Replace or fix fake RU fixtures that use English-only labels
- [x] 8.2 Add genuine pure-Cyrillic RU fixtures for the launch slice panels
- [x] 8.3 Add genuine ES fixtures with diacritics and at least one regional wording variant where packs need it
- [x] 8.4 Add mixed local+CODE, OCR noise, unknown, and ambiguous fixtures per language
- [x] 8.5 Implement fixture authenticity validator (`language` vs operative label script/content)

## 9. Release gates and CI

- [x] 9.1 Segment corpus metrics/thresholds by `en`/`ru`/`es`; fail launch if any required segment fails
- [x] 9.2 Add hard gates: pure-Cyrillic non-empty normalize; ES diacritic primary match; raw label preservation; unknown unmapped; ambiguous not resolved; EN non-regression
- [x] 9.3 Wire gates into candidate-release policy/CI entrypoints and update reset/rollback notes if release artifacts change
- [x] 9.4 Lock English corpus baselines and prove no EN recognition/resolution regression

## 10. Migration, reprocess, and verification wrap-up

- [x] 10.1 Catalog migration script/path: recompute normalized aliases, fail on residual empties/collisions, no silent patient raw rewrites
- [x] 10.2 Document optional EH-116 / reprocess batch procedure for incomplete historical rows after alias packs ship (manual revisions protected)
- [x] 10.3 Run full targeted verifiers (alias authority, resolver, extraction, incomplete outcomes, corpus gates) and record evidence
- [x] 10.4 Create/update `QA/en-ru-es-lab-pipeline-i18n/checklist.md` (or roadmap QA path) with manual EN/RU/ES document review paths and developer-evidence section
- [ ] 10.5 Final apply readiness: all slice gates and affected CI/DB contracts are green, candidate inputs are stable, and audit findings are closed or explicitly deferred with owner

Blocked on 10.5: the current candidate policy requires **15 hash-bound
approvals** before `check:registry-v2-candidate-corpus` can be launchable:
two release-wide approvals (`false_concrete_review` and `release_gate`) plus
13 `score_affecting_binding` approvals. The seven records currently present in
`registry/candidate-release/v1/approvals.json` are only the existing stale
production records from the prior candidate; they are not the complete current
policy set and are bound to the previous candidate input hash. The 15 entries
in `approvals.proposed.json` remain unsigned proposals and MUST NOT be copied
into production until candidate inputs and CI are stable. After that stability
point, all 15 approvals must be re-issued by their named owners. The technical
gate `check:registry-v2-candidate-corpus-technical` is independent and may pass
before approvals are applied.
