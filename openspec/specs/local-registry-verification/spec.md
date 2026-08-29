# local-registry-verification Specification

## Purpose
TBD - created by archiving change unblock-local-registry-verification. Update Purpose after archive.
## Requirements
### Requirement: Document worker typecheck uses one LanguageModel identity

After `pnpm --dir worker install --frozen-lockfile`, `pnpm typecheck:worker` SHALL typecheck `worker/src` against a single Vercel AI SDK `LanguageModel` specification version compatible with the application helpers imported from `src/lib/ai/resolve-model-core`. The worker SHALL NOT retain a second installed `ai` major that makes `LanguageModelV4` inassignable to `LanguageModelV2` at `runStageTextOrImage` call sites. Worker `tsconfig` SHALL continue to typecheck the pipeline modules that import application extraction helpers.

#### Scenario: Worker typecheck after frozen install

- **WHEN** worker dependencies are installed with the committed lockfile and `pnpm typecheck:worker` runs
- **THEN** the command exits 0
- **AND** it does not report `specificationVersion` `"v4"` not assignable to `"v2"` in `worker/src/pipeline-llm.ts`

#### Scenario: Application helpers remain the model factory

- **WHEN** `worker/src/ai.ts` re-exports `coreResolveModelForStage` from the application tree
- **THEN** `runStageTextOrImage` accepts that model's type without a cast that discards SDK compatibility
- **AND** `pnpm typecheck` for the Next.js app still exits 0

### Requirement: Local pgTAP evidence uses the existing Docker database

Local execution of Measurement Registry pgTAP files SHALL target the running `supabase_db_easyhealth` Postgres on host port 54322 without `supabase db reset`. The preferred invocation is `supabase test db --local` with an explicit `127.0.0.1` database URL when the CLI accepts it. If the CLI returns `LegacyDbConnectError` or a Windows Docker mount error, the same SQL files SHALL be executed with `docker exec` into that container. CLI connect failure SHALL NOT be recorded as a failed database contract when the in-container run reports pgTAP PASS. CI SHALL continue to start a disposable stack with `supabase db start` and the existing `test:*-db` package scripts.

#### Scenario: CLI cannot connect but Postgres is healthy

- **WHEN** `supabase_db_easyhealth` is healthy on port 54322 and `supabase test db --local QA-Db_tests/eh119_observation_measurement_correction.sql` fails with `LegacyDbConnectError`
- **THEN** the same file is run via `docker exec` `psql` against that container
- **AND** a pgTAP PASS is accepted as local evidence for that suite

#### Scenario: Shared stack is not reset

- **WHEN** local pgTAP for EH-119, EH-122, EH-123, EH-142, or EH-144 is executed in a worktree
- **THEN** the command path does not invoke `supabase db reset`
- **AND** other worktrees' synthetic data on the `easyhealth` stack are not wiped as part of this verification

### Requirement: Generated Registry documentation matches the runtime catalog

`pnpm check:biomarker-docs` SHALL pass against the current `MEASUREMENT_DEFINITIONS`, aliases, technical corpus, and `documentation-baseline.json`. Stale owned files SHALL be refreshed only by `pnpm generate:biomarker-docs`. Hand edits to `docs/03-modules/biomarkers.md`, `docs/05-data/biomarker-catalog.md`, `docs/05-data/biomarker-aliases.md`, `docs/05-data/biomarker-corpus-evidence.md`, or the marked interior of `docs/README.md` are not an accepted fix. Remote Wiki publication is not required for this requirement.

#### Scenario: Check fails because owned files drifted

- **WHEN** `pnpm check:biomarker-docs` lists one or more owned files as stale
- **THEN** a maintainer runs `pnpm generate:biomarker-docs` and reviews the generator diff
- **AND** a subsequent `pnpm check:biomarker-docs` and `pnpm test:biomarker-docs` pass
- **AND** the four owned Markdown files were not hand-edited

#### Scenario: Baseline identity moved with the catalog

- **WHEN** generation fails because baseline counts, manifest version, or digest disagree with runtime
- **THEN** `documentation-baseline.json` is updated in the same change after review
- **AND** generation does not rewrite the baseline silently inside `--check`

### Requirement: Static verifiers do not require live cloud secrets

`pnpm test:document-review` and other env-gated static Measurement Registry verifiers SHALL remain executable with the four CI placeholder environment variables already used in `.github/workflows/measurement-registry.yml`, or with `tsx --env-file=.env` when a local env file is present. Missing `SUPABASE_SERVICE_ROLE_KEY` / `OPENAI_API_KEY` / `NEXT_PUBLIC_SUPABASE_*` SHALL NOT be the only reason a source-contract verifier is skipped when placeholders can be supplied.

#### Scenario: Document-review verifier with placeholders

- **WHEN** the four CI placeholder env vars are set and `pnpm test:document-review` runs
- **THEN** the script completes its hook-order and persistence-seam assertions
- **AND** it does not call a live OpenAI or Supabase API as a success condition

