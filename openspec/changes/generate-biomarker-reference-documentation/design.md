## Context

Registry 2.0 is a typed runtime catalog exported from `src/lib/biomarkers`: 107 measurement definitions across 77 analytes, with 625 EN/RU/ES aliases. A definition is identified by the analyte plus specimen, property, scale, timing, method, and value kind; it is not interchangeable with an analyte. The candidate-release corpus supplies 72-row resolution evidence.

The requested reference is larger than the GitHub issue-body limit when every definition and alias is rendered. `docs/` is therefore canonical. The issue is an index and tracking record, not a second catalog. Existing Registry v1 is a frozen compatibility baseline with its authoritative human audit in `registry/biomarker-registry/v1.0.0/AUDIT.md`; copying all 113 concepts would create a competing source.

Current local worktree evidence contains uncommitted candidate files: `scripts/generate-biomarker-docs.ts`, `scripts/verify-biomarker-docs.ts`, `scripts/export-biomarker-wiki.ts`, the four requested docs, `docs/05-data/biomarker-catalog-issue.md`, package commands, and CI steps. They are not accepted implementation. The candidate generator currently treats an issue Markdown file as a generated output and calls the approval-bound `runRegistryV2CandidateCorpus`; its Wiki exporter hard-codes stale inventory/approval claims and treats the Wiki as an unmanaged surface. All candidate files require reconciliation during apply.

The published GitHub Wiki currently exposes `Home`, `Biomarker-Architecture`, `Biomarker-Catalog`, `Biomarker-Aliases`, `Biomarker-Corpus-Evidence`, `Registry-v1-Legacy`, and `_Sidebar`. This change selects a generated-mirror boundary: `docs/` is canonical; those seven Wiki pages are a deterministic local export from canonical docs and may be published only through a separately authorized maintainer action.

The implementation is documentation tooling plus one semantics-preserving extraction of the existing Health Profile laboratory-input projection into a shared pure module. It reads current typed registry, current persistence/consumer boundaries, and technical corpus data; it writes deterministic Markdown and local Wiki-export staging. It changes neither extraction, resolver, worker, database, Health Profile eligibility/scoring behavior, release approvals, the GitHub API, nor a remote Wiki.

## Goals / Non-Goals

**Goals:**

- Generate the four specified canonical Markdown files from runtime catalog data and approval-independent technical corpus evidence.
- Render all 107 definitions exactly once, separated into reviewed and provisional sections.
- Preserve EN/RU/ES aliases verbatim while rendering engineering narrative in English.
- Make identity axes, eligibility, aliases, units, conversions, provenance, lifecycle, and Health Profile/scoring effects inspectable without reading TypeScript.
- Make stale generated output and invalid input fail locally and in Registry CI.
- Render a concise deterministic GitHub issue body without creating or updating any issue.
- Make the real unknown/incomplete persistence path and Health Profile consumer-eligibility boundary inspectable without overstating deferred functionality.
- Make the published GitHub Wiki a deterministic, non-authoritative mirror rather than a competing documentation surface.

**Non-Goals:**

- No behavioral changes to extraction, resolution, persistence, observations, Health Profile eligibility/scoring, release approvals, registry identity, or database schema. A pure shared helper may replace the route’s inline projection only if contract tests prove deep-equal Health Profile inputs and unchanged resulting profiles.
- No reproduction of all 113 Registry v1 concepts.
- No claim that planned review-queue or catalog-governance provenance capabilities are available when their runtime/UI capability is absent.
- No automatic catalog expansion from uploaded unknown biomarkers or automatic/unbounded historical reprocessing; the existing operator-controlled batch reprocessing path is documented as implemented.
- No change to `registry/candidate-release/v1/approvals.json`.

## Decisions

### 1. Typed runtime and consumer projections are the sole Registry 2.0 source

The generator SHALL import its catalog and scoring facts from `src/lib/biomarkers/index.ts`: `MEASUREMENT_DEFINITIONS`, `ANALYTES`, `getMeasurementIdentity`, `getMeasurementConversionPolicy`, `getReviewedAssessmentBinding`, `getReviewedScoreReadinessGroups`, `getReviewedScoreContributionGroups`, `getRegistryV2ScoreRole`, `getRegistryV2ScoreReadinessGroups`, `getRegistryV2ScoreContributionGroups`, `MEASUREMENT_CATALOG_MANIFEST_VERSION`, `MEASUREMENT_CATALOG_MANIFEST_DIGEST`, `MEASUREMENT_RESOLVER_VERSION`, and `MEASUREMENT_NORMALIZATION_VERSION`. Apply SHALL re-export the three `getRegistryV2…` scoring functions from `src/lib/biomarkers/index.ts`; they currently live in `src/lib/biomarkers/registry-v2-runtime.ts` and are not yet part of that public surface.

Apply SHALL extract the current Health Profile route’s inline laboratory-admission `flatMap` into `src/lib/health-profile-input.ts` as pure `projectHealthProfileLaboratoryInput({ observation, relation, labUnitSystem })`. It SHALL return either one exact `buildHealthProfile` observation input or `null`; it SHALL retain the route’s existing `projectLaboratoryOutcome` assessment-eligibility gate, `projectActiveRegistryV2LaboratoryBinding` lookup, reviewed-compatible binding selection, value-kind branch, `presentObservation` conversion, raw unit/reference handling, and input shape. `src/app/api/health-profile/route.ts` SHALL retain document/source filtering and call the helper for each scoped observation. The generator’s eligibility projection and contract test SHALL call the helper with canonical fixtures. `buildHealthProfile` in `src/lib/health-systems.ts` remains the authoritative downstream scoring behavior. `MeasurementDefinition.aliases` and `AliasDefinition` supply alias governance; `MeasurementDefinition.unitPolicy` and `conversion` supply unit/conversion policy; `MeasurementDefinition.maturity` and the shared consumer projection supply concrete-resolution and consumer eligibility.

The generator SHALL not scrape Markdown, use an independent catalog JSON copy, recreate Health Profile predicates, or synthesize a claim from prose. This prevents documentation drift from the resolver and consumer path.

Alternative rejected: hand-authored catalog pages. They duplicate 107 definitions and 625 aliases, exceed the intended issue capacity, and have no mechanical freshness guarantee.

### 2. Corpus evidence uses a technical API with no approval input

Apply SHALL add and use `runRegistryV2CandidateCorpusTechnical` in `scripts/lib/registry-v2-candidate-corpus.ts`. This API SHALL load only `corpus.json`, `documents.json`, referenced document fixtures, `policy.json`, reset/rollback notes, and Registry 2.0 resolver/version inputs. It SHALL NOT read, parse, hash, validate, or expose `registry/candidate-release/v1/approvals.json`.

It SHALL return row evidence, technical fixture validation, and threshold results required for documentation. It SHALL omit release-approval validation and `launchable`; technical evidence must remain usable when approvals are absent, unsigned, malformed, or bound to another candidate hash. The existing full `runRegistryV2CandidateCorpus` remains the release-governance path and continues to own approvals/launchability. `scripts/registry-v2-candidate-corpus.ts --technical-check` SHALL invoke only the technical API and exit non-zero only for technical fixture/threshold failure, never for approval state.

Alternative rejected: letting the docs generator call the current full runner and merely ignore `approvalErrors`. That still makes a technical documentation build depend on an approval file it must not read.

### 3. Ownership is explicit: four full files and one managed README section

The generator fully owns, writes, and byte-checks these files:

| Fully generator-owned file | Purpose |
|---|---|
| `docs/03-modules/biomarkers.md` | Architecture, lifecycle, outcomes, unknown handling, reprocessing, and actual gaps. |
| `docs/05-data/biomarker-catalog.md` | Every definition, identity axes, unit/conversion policy, maturity/eligibility, alias projection, and bindings. |
| `docs/05-data/biomarker-aliases.md` | One authoritative generated governance row per alias. |
| `docs/05-data/biomarker-corpus-evidence.md` | Technical candidate-corpus metrics and one row of evidence per corpus row. |

`docs/README.md` remains human-owned. The generator owns only the contents between exactly one `<!-- generated-biomarker-docs:start -->` and exactly one `<!-- generated-biomarker-docs:end -->` marker. It SHALL replace only that interior, preserving every byte outside the markers. Missing, reversed, or duplicate markers are an error; `--check` reports the README section stale without writing it. Tests SHALL prove unrelated README text survives a write unchanged.

`docs/05-data/biomarker-catalog-issue.md` is not a generated output in the target contract. Apply SHALL inspect its uncommitted provenance and content against this decision, preserve it until review, then remove or relocate it only as the clean cutover from the old candidate approach. No generated documentation file contains a GitHub issue body.

### 4. One deterministic model feeds catalog and alias projections

The generator SHALL derive both documents from the same validated, stable-sorted `MeasurementDefinition[]` and `AliasDefinition[]` model. The catalog contains a compact per-definition alias projection: verbatim alias value, stable alias key, locale grouping, and laboratory restriction where present. The alias document is the full governance authority for every alias metadata field.

No alias field is independently assembled or manually copied between the two documents. Rendering SHALL use alias key as the join identity. Contract tests SHALL prove every projected catalog alias key appears exactly once in the full alias table under the same owning definition, and that the aggregate projection count equals the alias-table count.

### 5. Counts are versioned acceptance baselines, not generator constants

Counts are always computed from the typed runtime input. The expected 107 definitions, 68 reviewed definitions, 39 provisional definitions, 77 analytes, 625 aliases, locale totals (`en=277`, `ru=179`, `es=169`), 44 assessment-bound definitions, and corpus totals (`72`, `en=53`, `ru=9`, `es=10`) SHALL live in a reviewed, versioned data baseline at `registry/biomarker-registry/v2.0.0/documentation-baseline.json`, bound to the catalog manifest version and digest.

The generator and verifier SHALL read this baseline; they SHALL NOT encode raw count literals as implementation constants. Generation/check/test fail when computed facts do not reconcile with the baseline. A catalog or corpus change requires an explicit reviewed baseline update in the same change; `generate` MUST NOT silently rewrite it.

### 6. Unknown and incomplete persistence is documented from the actual path

The module guide SHALL describe the currently implemented path precisely. `worker/src/pipeline.ts` calls `extractPipelineBiomarkersFromText` or `extractPipelineBiomarkersFromImage` and inserts every extracted laboratory row into `public.document_extracted_biomarkers` with `document_id`, `profile_id`, `biomarker_name`, `raw_name`, numeric/text value, unit/raw unit, source-page/source-text evidence, and `status='needs_review'`. It does not call `resolveMeasurementDefinition`; therefore no resolver outcome is persisted at initial extraction. The document type is persisted on `public.documents.document_type`, not denormalized onto the extracted row.

`GET src/app/api/documents/[id]/biomarkers/route.ts` returns that raw extracted row and uses `buildNormalizationReview` to compute a preview. A preview is not persisted. On explicit acceptance through `POST src/app/api/documents/[id]/biomarkers/accept/route.ts`, or correction through `PATCH src/app/api/documents/[id]/biomarkers/route.ts`, `writeExtractedBiomarkerNormalization` resolves the raw writer input and calls `public.write_observation_normalization_revision_v2`. The RPC persists one observation linked to the extracted row and one active normalization revision for all four outcomes. It copies raw label/value/unit and `document_id` to `observations`, persists the resolver result and trace on the revision, and projects result/status/evidence back to the extracted row. `partial`, `ambiguous`, and `unmapped` have no concrete definition key and remain `pending`; `resolved` requires a reviewed concrete identity. `GET src/app/api/documents/[id]/observations/route.ts` serializes the persisted outcome and raw fields. `document_type` remains available only by the linked `documents` row.

Operator-controlled reprocessing is implemented, not deferred: `scripts/reprocess-batch.ts` invokes `runReprocessBatchDryRun` / `applyReprocessBatch` in `src/lib/registry-reprocessing/service.ts`; selection in `selection.ts` reads the retained extracted raw fields and includes filters for all four outcomes, then apply reuses the same writer. There is no HTTP admin reprocessing surface, automatic trigger after catalog edits, automatic promotion from unknown input, admin catalog-review queue, or source-document-to-catalog provenance promotion. Initial worker reprocessing at `POST src/app/api/documents/[id]/reprocess/route.ts` is a separate user-owned full re-extraction path, not Registry batch reprocessing.

### 7. Health Profile/scoring claims are projected from the actual consumer boundary

For each documented definition, the generator SHALL derive and render reviewed assessment bindings from `getReviewedAssessmentBinding`; score role from `getRegistryV2ScoreRole`; readiness groups from `getRegistryV2ScoreReadinessGroups`; contribution groups from `getRegistryV2ScoreContributionGroups`; and consumer eligibility by evaluating a canonical per-definition fixture through `projectHealthProfileLaboratoryInput`. Each fixture SHALL contain a lab observation and active revision with internally consistent `resolver_result`, trace `outcome`, selected candidate key, definition key, reviewed provenance, compatible binding, numeric value, unit, and document reference range. It SHALL never claim an actual patient observation exists.

The rendered contract SHALL state that a definition is Health Profile-eligible only when the helper returns an input: the active revision is lab, `resolved`, selected-candidate-consistent, and bound to a reviewed Registry v2 definition with a reviewed compatible assessment binding. A numeric value is necessary but not sufficient for score contribution: `buildHealthProfile` uses the Registry score role, usable document reference range, and reviewed specimen match; `evaluateSystemScoreReadiness` uses the documented readiness groups, and `computeSystemStateScore` uses contribution groups. The documentation SHALL distinguish eligibility from actual observation presence, system scoreability, and a non-null state score.

Provisional definitions SHALL be documented as consumer-ineligible because the real projection rejects their non-reviewed maturity even when a synthetic revision reports `resolved`. The renderer SHALL not duplicate these predicates. Contract coverage SHALL compare the former inline route projection and the helper across resolved, partial, ambiguous, unmapped, non-lab, no-active-revision, trace-mismatch, incompatible-binding, qualitative, numeric-conversion, missing-reference, and provisional fixtures before deleting the inline implementation.


### 8. CLI, exit, stale-file, CI, and local Wiki-export contract

Package scripts SHALL be exactly:

```json
{
  "generate:biomarker-docs": "tsx scripts/generate-biomarker-docs.ts --write",
  "check:biomarker-docs": "tsx scripts/generate-biomarker-docs.ts --check",
  "test:biomarker-docs": "tsx scripts/verify-biomarker-docs.ts",
  "render:biomarker-docs-issue-body": "tsx scripts/generate-biomarker-docs.ts --issue-body",
  "render:biomarker-wiki": "tsx scripts/export-biomarker-wiki.ts --render",
  "export:biomarker-wiki": "tsx scripts/export-biomarker-wiki.ts --write"
}
```

`--write` validates all inputs before writing the four fully-owned files and the README managed section. It exits `0` only after all outputs are written. `--check` generates in memory, compares the four files and managed README section, writes nothing, and exits non-zero for invalid input, absent/invalid README markers, technical corpus failure, baseline manifest-version/digest mismatch, or one or more stale paths. Its output lists every stale path. `--issue-body` writes only deterministic text to stdout, makes no filesystem writes, and never creates, updates, comments on, or queries a GitHub issue. `render:biomarker-wiki` constructs the seven-page mirror in memory and emits deterministic page data to stdout without a filesystem, GitHub API, credential, or network side effect. `export:biomarker-wiki` writes that same rendered page set only to an explicitly provided local empty staging directory; it never publishes.

`.github/workflows/measurement-registry.yml` SHALL run these exact commands after `pnpm typecheck` and before `pnpm check:registry-v2-cutover` and `pnpm verify:registry`:

```yaml
- name: Verify generated biomarker documentation
  run: pnpm check:biomarker-docs
- name: Verify biomarker documentation contract
  run: pnpm test:biomarker-docs
```

### 9. GitHub issue and Wiki publication are separate human actions

After CI-equivalent checks are green, a maintainer may obtain the text with `pnpm render:biomarker-docs-issue-body` and create or update one concise tracking issue through a separate, explicitly authorized GitHub action. The body contains only computed summary counts, canonical repository links, regeneration/check commands, and remaining gaps. It names `docs/` as canonical and SHALL NOT contain a catalog, alias, or corpus inventory.

The Wiki is a generated mirror, never a source of truth. `scripts/export-biomarker-wiki.ts` SHALL replace the candidate implementation and derive the following complete set only from the canonical generated docs and a canonical-doc-derived index: `Home.md`, `Biomarker-Architecture.md`, `Biomarker-Catalog.md`, `Biomarker-Aliases.md`, `Biomarker-Corpus-Evidence.md`, `Registry-v1-Legacy.md`, and `_Sidebar.md`. It SHALL not read runtime catalog, corpus, policy, `approvals.json`, issue state, or a remote Wiki. After `render`/local staging checks pass, an explicitly authorized maintainer may copy the staged pages into a separately cloned Wiki repository, inspect the diff, and publish it. That publication is outside CI and every package script.

## Risks / Trade-offs

- **Candidate reconciliation:** local candidate implementation, docs, and Wiki exporter may contain valid material, but also conflict with the target contract. Apply begins with a documented file-by-file comparison; no candidate file is adopted merely because it exists.
- **Persistence semantics:** resolver output is not recorded at initial extraction. Documentation must distinguish extracted raw retention and API preview from an accepted/reprocessed persisted normalization outcome.
- **Health Profile claims:** eligibility is a consumer projection, not a property inferred from binding prose. Fixtures and tests must pin it to the active production path.
- **Catalog evolution:** the baseline is an intentional tripwire. A reviewed catalog or corpus change must update it and regenerated docs together.
- **Markdown escaping:** aliases can contain pipes, backticks, or newlines. The renderer must escape cells deterministically rather than create malformed tables.
- **Technical-versus-release evidence:** technical corpus evidence deliberately omits approval state; it must never be represented as a launchability claim.
- **Generated-file edits:** direct edits to fully-owned files are overwritten. README edits outside markers are preserved.
- **Wiki publication:** local render/staging cannot prove or perform remote publication. The separately authorized maintainer action must review and publish the seven-page mirror.
- **Issue freshness:** the issue is not mechanically kept current; it defers to canonical docs and is updated only through explicit maintainer action.

## Migration Plan

1. Inventory and diff every existing candidate generator/docs/Wiki exporter/README/CI/package file against this contract; record adopt/revise/remove disposition before changing it.
2. Split approval-independent technical corpus evaluation from the full approval-bound release runner, with regression tests proving approval isolation.
3. Export the missing Registry scoring functions from the public biomarker barrel; extract and parity-test the semantics-preserving Health Profile laboratory-input helper; then add the versioned documentation baseline and deterministic renderer that consumes the actual consumer projections.
4. Add the four owned outputs, README managed section, stdout-only issue body, side-effect-free seven-page Wiki renderer, and explicit local Wiki staging writer.
5. Add contract tests for persistence truth, Health Profile eligibility parity, baseline manifest identity, stale output, README preservation, technical isolation, and Wiki derivation.
6. Generate canonical docs, verify clean checks and local Wiki staging, then present the concise issue body and Wiki staging output for separately authorized publication.

## Open Questions

None. `docs/` remains canonical; the existing seven-page Wiki is a generated mirror only; current release approvals remain outside this change.
