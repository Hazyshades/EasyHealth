## ADDED Requirements

### Requirement: Registry 2.0 documentation reads authoritative runtime inputs and a versioned acceptance baseline

The generator SHALL obtain Registry 2.0 catalog and scoring facts only from public module exports. `src/lib/biomarkers/index.ts` SHALL export and the generator SHALL import `MEASUREMENT_DEFINITIONS`, `ANALYTES`, `getMeasurementIdentity`, `getMeasurementConversionPolicy`, `getReviewedAssessmentBinding`, `getReviewedScoreReadinessGroups`, `getReviewedScoreContributionGroups`, `getRegistryV2ScoreRole`, `getRegistryV2ScoreReadinessGroups`, `getRegistryV2ScoreContributionGroups`, `MEASUREMENT_CATALOG_MANIFEST_VERSION`, `MEASUREMENT_CATALOG_MANIFEST_DIGEST`, `MEASUREMENT_RESOLVER_VERSION`, and `MEASUREMENT_NORMALIZATION_VERSION`. The latter three Registry score functions currently originate in `src/lib/biomarkers/registry-v2-runtime.ts` and SHALL be re-exported by the public barrel during apply. The generator SHALL import `projectActiveRegistryV2LaboratoryBinding` from `src/lib/documents/observation-read-boundaries.ts`, `projectLaboratoryOutcome` from `src/lib/documents/incomplete-laboratory-outcomes.ts`, and pure `projectHealthProfileLaboratoryInput` from `src/lib/health-profile-input.ts`. During apply the helper SHALL replace only the existing inline laboratory-admission projection in `src/app/api/health-profile/route.ts`; the route, generator, and tests SHALL consume the same helper. `MeasurementDefinition.aliases` and `AliasDefinition` SHALL provide alias governance metadata; `MeasurementDefinition.unitPolicy` and `conversion` SHALL provide unit/conversion policy.

The generator SHALL read a reviewed acceptance baseline at `registry/biomarker-registry/v2.0.0/documentation-baseline.json`, bound to the exact runtime `MEASUREMENT_CATALOG_MANIFEST_VERSION` and `MEASUREMENT_CATALOG_MANIFEST_DIGEST`. It SHALL calculate counts from runtime inputs and reconcile them with the baseline. The 107/68/39/77/625/44 catalog counts, `en=277`/`ru=179`/`es=169` alias totals, and `72`/`en=53`/`ru=9`/`es=10` corpus totals SHALL NOT be implementation constants in generator code. Generation, checking, and verification SHALL fail on count, manifest version, or manifest digest mismatch; generation SHALL NOT rewrite the baseline.

Rendering SHALL be deterministic: identical runtime inputs and baseline produce byte-identical outputs with stable ordering and no timestamps, local paths, Git metadata, network data, or GitHub API input.

#### Scenario: Identical inputs render identically
- **WHEN** documentation is rendered twice from unchanged runtime inputs and baseline
- **THEN** every rendered file, Wiki render, and issue body has identical bytes
- **AND** no output contains a generation timestamp, workspace path, commit SHA, or network-derived value

#### Scenario: Catalog facts or manifest identity changes without an approved baseline update
- **WHEN** a Registry 2.0 definition, alias, unit policy, binding, corpus count, manifest version, or manifest digest changes
- **THEN** generation, check, and verification fail against the versioned baseline
- **AND** a maintainer must review and update the baseline in the same change before regenerated documentation is accepted

### Requirement: Corpus evidence is technically independent of production approvals

`scripts/lib/registry-v2-candidate-corpus.ts` SHALL export `runRegistryV2CandidateCorpusTechnical`. The technical API SHALL read corpus, document index, referenced fixtures, policy, reset/rollback notes, and Registry 2.0 resolver/version inputs needed for row evidence and threshold validation. It SHALL NOT read, parse, hash, validate, expose, or otherwise depend on `registry/candidate-release/v1/approvals.json`.

The technical result SHALL contain row evidence, fixture errors, threshold checks, and technical metrics but SHALL NOT contain release-approval validation or a `launchable` claim. The existing `runRegistryV2CandidateCorpus` SHALL remain the approval-bound release-governance path. The docs generator and `scripts/registry-v2-candidate-corpus.ts --technical-check` SHALL use the technical API.

#### Scenario: Unsigned approvals do not block evidence rendering
- **WHEN** production approvals are missing, unsigned, malformed, or hash-bound to a different candidate input
- **THEN** technical corpus generation can still render row evidence when corpus fixtures and thresholds are valid
- **AND** the generated evidence does not claim that the release is launchable

#### Scenario: Technical fixture failure remains blocking
- **WHEN** a corpus fixture or technical threshold fails
- **THEN** technical corpus generation and `--technical-check` exit non-zero
- **AND** the failure does not read or report approval state

### Requirement: Generator ownership and write boundaries are explicit

The generator SHALL fully own and byte-check these files:

- `docs/03-modules/biomarkers.md`
- `docs/05-data/biomarker-catalog.md`
- `docs/05-data/biomarker-aliases.md`
- `docs/05-data/biomarker-corpus-evidence.md`

Every fully-owned file SHALL begin with a generated-file notice and SHALL be overwritten only after all inputs, technical evidence, baseline, and render invariants pass.

`docs/README.md` SHALL remain human-owned except for exactly one managed section delimited by `<!-- generated-biomarker-docs:start -->` and `<!-- generated-biomarker-docs:end -->`. The generator SHALL replace only the content inside those markers, preserving all bytes outside them. Missing, reversed, or duplicate markers SHALL fail write/check without modifying the file. `docs/05-data/biomarker-catalog-issue.md` SHALL NOT be a generated output or a `--check` input.

#### Scenario: README contains unrelated documentation
- **WHEN** the README has text before or after the managed biomarker section
- **THEN** generation updates only the section interior
- **AND** byte-for-byte unrelated text remains unchanged

#### Scenario: README markers are invalid
- **WHEN** either managed-section marker is absent, duplicated, or ordered incorrectly
- **THEN** `generate:biomarker-docs` and `check:biomarker-docs` exit non-zero
- **AND** neither command overwrites `docs/README.md`

### Requirement: Shared Health Profile input projection preserves existing behavior

Apply SHALL extract the current inline laboratory-admission projection in `GET /api/health-profile` into pure `projectHealthProfileLaboratoryInput({ observation, relation, labUnitSystem })` at `src/lib/health-profile-input.ts`. The helper SHALL return the exact one `buildHealthProfile` input produced by the current route or `null`. It SHALL preserve the exact active-revision, resolved-trace, selected-candidate, reviewed Registry-v2 provenance, and reviewed-compatible assessment-binding gates through `projectActiveRegistryV2LaboratoryBinding` and `projectLaboratoryOutcome`; value-kind behavior; numeric unit conversion through `presentObservation`; raw reference-range handling; and all returned fields. The route SHALL retain authorization, database selection, processed-document filtering, laboratory-only filtering, source construction, `buildHealthProfile`, and response serialization.

#### Scenario: Existing route inputs preserve Health Profile admission
- **WHEN** the route processes resolved, partial, ambiguous, unmapped, inactive, trace-mismatched, incompatible-binding, provisional, qualitative, and numeric-conversion laboratory fixtures
- **THEN** the helper returns exactly the input previously produced by the inline projection or `null` for every fixture
- **AND** the route’s `buildHealthProfile` result is unchanged


### Requirement: Canonical docs cover every Registry 2.0 definition and actual Health Profile eligibility

The generator SHALL write `docs/05-data/biomarker-catalog.md` and render every Registry 2.0 measurement definition exactly once. The document SHALL state that the 107 definitions span 77 analytes because a definition identity includes analyte plus specimen, property, scale, timing, method, and value kind. It SHALL separately render reviewed and provisional definitions in stable definition-key order.

For every definition, the document SHALL render definition key, display name, analyte, specimen, property, scale, timing, method, value kind, unit dimensions, accepted units, canonical unit, conversion policy/reference, missing-unit behavior, maturity, concrete-resolution eligibility, definition provenance, lifecycle, compact aliases grouped by locale, and all assessment bindings. Compact aliases SHALL preserve verbatim EN/RU/ES values, stable alias keys, and laboratory restrictions where present. The catalog SHALL link to the complete alias-governance reference for authority, approval, lifecycle, fixture, provenance, and review metadata.

For every definition, the generator SHALL derive—not infer—its documented Health Profile/scoring claim through the named public exports and `projectHealthProfileLaboratoryInput`. It SHALL render reviewed assessment binding, score role, readiness groups, contribution groups, and whether the canonical projection is consumer-eligible. A claim of Health Profile eligibility SHALL state the exact conditions: a lab observation with an active revision; `resolved` revision and trace outcome; matching selected candidate and definition key; reviewed Registry v2 maturity/provenance; and a reviewed compatible assessment binding. It SHALL then distinguish this from actual score contribution, which additionally depends on the real observation value kind/value, document reference range, reviewed specimen match, system readiness, and contribution groups in `buildHealthProfile`.

#### Scenario: Reviewed definition is documented
- **WHEN** a reviewed definition is rendered
- **THEN** it states its projected binding, score role, readiness/contribution groups, and exact consumer-eligibility preconditions
- **AND** its claims equal the outputs of `projectHealthProfileLaboratoryInput`, `projectActiveRegistryV2LaboratoryBinding`, and `projectLaboratoryOutcome` for the canonical fixture used by `src/app/api/health-profile/route.ts`

#### Scenario: Provisional definition is documented
- **WHEN** a provisional definition is rendered
- **THEN** it appears in the provisional section, separate from reviewed definitions
- **AND** the real consumer projection rejects it even under a synthetic `resolved` revision, so it cannot become consumer-eligible or affect Health Profile/scoring

### Requirement: Alias projections and alias governance use one model

The generator SHALL derive catalog alias projections and `docs/05-data/biomarker-aliases.md` from the same validated, stable-sorted `AliasDefinition[]`. The alias document SHALL contain exactly one row per alias with owning definition key, alias key, verbatim value, normalized value, locale, source, match type, match authority, approval status, lifecycle, provenance, review reference when present, laboratory restriction when present, and fixture references when present.

Alias key is the join identity between documents. The generator SHALL NOT separately assemble or manually copy alias values or metadata. Verification SHALL prove each catalog-projected alias key appears exactly once under the same owning definition in the full alias table and that projection and full-table aggregate counts reconcile.

#### Scenario: Restricted alias is rendered
- **WHEN** an alias has a laboratory or fixture restriction
- **THEN** the catalog projection states its laboratory restriction and the alias row states all governance metadata
- **AND** neither representation broadens the alias scope

#### Scenario: Locale totals reconcile
- **WHEN** alias documentation is generated from the current catalog
- **THEN** it reconciles its derived totals with the versioned baseline
- **AND** every alias has one full governance row

### Requirement: Corpus evidence documentation exposes technical resolution safety

The generator SHALL write `docs/05-data/biomarker-corpus-evidence.md` from `runRegistryV2CandidateCorpusTechnical`. It SHALL render technical candidate metrics and language segments, then exactly one stable evidence row per corpus row. Each row SHALL show corpus row id, language, raw label, unit/value context, expected classification, actual result, selected definition when any, resolver status, false-concrete status, relevant alias match/authority evidence, and a concise safety rationale.

The evidence SHALL distinguish `resolved`, `partial`, `ambiguous`, and `unmapped`. It SHALL state that unknown-marker rows remain unmapped and do not extend the catalog. It SHALL not render approvals, approval errors, approval hashes, or `launchable`.

#### Scenario: Candidate corpus is technically safe
- **WHEN** the current technical candidate corpus is rendered
- **THEN** its derived totals reconcile with the versioned baseline
- **AND** expected-classification rate is 1.0, false concrete resolutions are 0, and processing errors are 0

#### Scenario: Unknown marker appears in evidence
- **WHEN** a corpus row is an intentional unknown marker
- **THEN** the row is documented as unmapped rather than assigned a concrete definition
- **AND** the documentation states that uploads do not silently create definitions or aliases

### Requirement: Module guide describes actual persistence lifecycle and explicitly deferred capability

The generator SHALL write `docs/03-modules/biomarkers.md` in English engineering narrative. It SHALL explain Registry 2.0 identity, resolution outcomes (`resolved`, `partial`, `ambiguous`, `unmapped`), explicit catalog governance, actual persistence, and Health Profile eligibility. It SHALL identify the authoritative current path: extraction in `worker/src/pipeline.ts`; extracted-row API/preview in `src/app/api/documents/[id]/biomarkers/route.ts`; acceptance in `src/app/api/documents/[id]/biomarkers/accept/route.ts`; normalization in `writeExtractedBiomarkerNormalization`; persistence in `write_observation_normalization_revision_v2`; observation serialization in `src/app/api/documents/[id]/observations/route.ts`; Health Profile admission in `src/app/api/health-profile/route.ts`; and operator batch reprocessing in `scripts/reprocess-batch.ts` plus `src/lib/registry-reprocessing`.

The guide SHALL state that initial extraction persists raw label, numeric/text value, unit/raw unit, `document_id`, `profile_id`, and source evidence in `document_extracted_biomarkers`, but does not run or persist a resolver result. It SHALL state that document type resides in `documents.document_type`, not as an extracted/observation denormalization. It SHALL state that API preview is not persistence. It SHALL state that explicit acceptance, correction (including confirmation), or Registry batch reprocessing persists all four outcomes as an observation plus active normalization revision: raw evidence and `document_id` persist on the observation, resolver result/trace persist on the revision and project to the extracted row; every incomplete outcome has null concrete definition identity and pending acceptance verification, while `partial` or `ambiguous` MAY retain only an analyte identity when the resolver’s viable candidates converge on it.

The guide SHALL distinguish existing explicit operator batch reprocessing from unavailable automatic historical reprocessing. It SHALL list as unavailable: an admin-facing queue that promotes unknown labels, automatic catalog growth from patient/LLM input, promotion of patient/source-document evidence into Registry definition authority, automatic catalog-change-triggered reprocessing, and an HTTP admin surface for Registry batch reprocessing. It SHALL not represent any unavailable workflow as existing functionality.

#### Scenario: Reader investigates an unknown biomarker
- **WHEN** a reader follows the guide for a document label outside the catalog
- **THEN** the guide states that the initial extracted raw row is persisted before resolution, and that `unmapped` is persisted only after acceptance or explicit Registry batch reprocessing
- **AND** it states that no definition/alias is silently created and no admin review/promotion workflow exists

#### Scenario: Reader investigates an incomplete persisted outcome
- **WHEN** a reader follows the guide for `partial` or `ambiguous`
- **THEN** it states that raw evidence and result/trace remain readable through the observation API
- **AND** it states that no concrete identity or Health Profile eligibility is created

### Requirement: Registry v1 is summarized without creating a competing copy

Generated documentation SHALL include a concise Registry v1 legacy summary that links to `registry/biomarker-registry/v1.0.0/AUDIT.md`. It SHALL state that Registry v1 is a frozen compatibility baseline, not a Registry 2.0 runtime source, and SHALL describe the disposition rules: reviewed mapping when identity is supported; explicit provisional representation when it is not; no automatic promotion, alias admission, or runtime fallback to v1.

#### Scenario: Reader needs legacy detail
- **WHEN** a reader needs the inventory of the 113 v1 concepts
- **THEN** generated documentation links to the authoritative v1 audit
- **AND** it does not duplicate the full v1 inventory into Registry 2.0 documentation

### Requirement: CLI commands, verification, CI, and Wiki rendering detect drift without publication side effects

`package.json` SHALL define exactly these scripts:

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

`--write` validates first and writes the four fully-owned files plus only the README managed section; it exits `0` only on success. `--check` renders in memory, compares all owned files and the README managed section, performs no writes, lists every stale path, and exits non-zero for stale/missing output, invalid marker structure, invalid input, technical corpus failure, count/baseline manifest identity mismatch, or a stale managed section. `test:biomarker-docs` exits non-zero for any failed assertion.

`--issue-body` SHALL write only deterministic text to stdout. It SHALL make no filesystem writes and SHALL never create, update, comment on, authenticate to, or query a GitHub issue. `render:biomarker-wiki` SHALL construct seven deterministic pages in memory and write only their deterministic representation to stdout. It SHALL make no filesystem writes and SHALL never authenticate to, query, create, update, or publish a remote Wiki. `export:biomarker-wiki` SHALL write exactly that rendered page set only to an explicitly provided local empty staging directory and SHALL never publish.

`.github/workflows/measurement-registry.yml` SHALL run `pnpm check:biomarker-docs` and `pnpm test:biomarker-docs` after `pnpm typecheck` and before `pnpm check:registry-v2-cutover` and `pnpm verify:registry`.

#### Scenario: Generated documentation is stale
- **WHEN** an owned file or README managed section differs from deterministic renderer output
- **THEN** `pnpm check:biomarker-docs` exits non-zero without modifying any file
- **AND** its output identifies every stale path or stale managed section

#### Scenario: Wiki output is rendered or staged
- **WHEN** canonical generated docs are unchanged
- **THEN** `render:biomarker-wiki` produces the same seven pages byte-for-byte and has no side effect
- **AND** a local Wiki export contains only those pages derived from canonical docs, never approval, issue, runtime-catalog, corpus, or remote-Wiki data

#### Scenario: Invalid input is supplied
- **WHEN** generation receives duplicate definition/alias identities, a reviewed assessment binding without required runtime metadata, or a baseline manifest version/digest different from runtime exports
- **THEN** generation fails before any canonical output is written
- **AND** the failure identifies the violated input contract

### Requirement: Existing candidate files are reconciled before adoption; issue and Wiki publication remain separate

Apply SHALL first inventory the current candidate generator, verifier, Wiki exporter, generated docs, README changes, package commands, workflow changes, and `docs/05-data/biomarker-catalog-issue.md`. For each file it SHALL record whether it is adopted unchanged, revised to meet this specification, or removed/relocated as conflicting candidate output. No uncommitted candidate file becomes authoritative merely because it exists.

`docs/` is canonical. The GitHub Wiki SHALL be a generated mirror of exactly `Home.md`, `Biomarker-Architecture.md`, `Biomarker-Catalog.md`, `Biomarker-Aliases.md`, `Biomarker-Corpus-Evidence.md`, `Registry-v1-Legacy.md`, and `_Sidebar.md`. The replacement `scripts/export-biomarker-wiki.ts` SHALL derive those pages only from canonical generated docs and a canonical-doc-derived index. It SHALL not embed hard-coded counts or approval state. A maintainer MAY separately publish staged output only after explicit authorization and human diff review; no generator, verifier, CI job, or package command publishes the Wiki.

After local and CI-equivalent checks pass, a maintainer MAY obtain a concise body with `pnpm render:biomarker-docs-issue-body` and separately, with explicit authorization, create or update one tracking issue. The body SHALL contain only summary counts, canonical repository links, regeneration/check commands, and remaining gaps. It SHALL identify `docs/` as canonical and SHALL NOT contain a catalog, alias, or corpus inventory.

#### Scenario: Candidate documentation outputs conflict with final contract
- **WHEN** the candidate issue document or candidate Wiki exporter exists during apply
- **THEN** implementation classifies them as candidate output rather than canonical sources
- **AND** the issue document is removed or relocated and the Wiki exporter is revised or replaced before the final generated set is committed

#### Scenario: Issue body is rendered
- **WHEN** a maintainer runs `pnpm render:biomarker-docs-issue-body`
- **THEN** deterministic index text is written to stdout and the process exits `0`
- **AND** no GitHub issue or repository file is created, updated, queried, or deleted
