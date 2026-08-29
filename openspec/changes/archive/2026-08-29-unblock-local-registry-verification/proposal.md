## Why

Local Measurement Registry verification in this worktree cannot complete the same gate as GitHub Actions even when product contracts are green. The document worker typechecks two Vercel AI SDK `LanguageModel` identities; `supabase test db --local` fails to connect to an already-running Docker Postgres; generated Registry documentation is stale against the runtime catalog. The archived Health Profile change `harden-health-profile-review-papercuts` (#190) is not reopened.

## What Changes

- Align the document worker's `ai` / `@ai-sdk/openai` resolution with the application package so `pnpm typecheck:worker` sees one `LanguageModel` specification version after `pnpm --dir worker install`.
- Make local pgTAP suites runnable against the existing Docker stack (`supabase_db_easyhealth` on port 54322) without requiring `~/.supabase/profile` or inventing a second database. Prefer an explicit `--db-url` (or documented equivalent) over resetting a shared stack.
- Keep `docker exec … psql` as an evidence fallback when the CLI still cannot mount or connect on Windows, matching prior EH-116/EH-121/i18n records. Do not treat CLI connect failure as a failed SQL contract when the same files pass in-container.
- Regenerate canonical biomarker documentation through `pnpm generate:biomarker-docs` and land the generator-owned files plus `documentation-baseline.json` only when the runtime catalog/manifest actually changed. Do not hand-edit generated Markdown.
- Keep static verifiers runnable with either `--env-file=.env` or the existing CI placeholder env vars; do not require live OpenAI or service-role secrets for `test:document-review`.
- Do not change Health Profile scoring, reported-results projection, resolver outcomes, extraction persistence, or issue #190 acceptance.

## Capabilities

### New Capabilities

- `local-registry-verification`: Worktree-safe execution of Measurement Registry typecheck, pgTAP, and generated-docs gates against a shared local Docker Supabase, without dual AI SDK types or undocumented CLI connection failure.

### Modified Capabilities

- None. `generated-biomarker-documentation` and `ci-suite-coverage` remain owned by their existing changes; this change does not alter their requirement text. Product specs `health-profile-reported-results`, `health-profile-score-readiness`, and `incomplete-laboratory-outcomes` are out of scope.

## Impact

- **Target domains:** `documents` (worker LLM types and pipeline typecheck); `health-profile` only as generated Registry docs consumers; cross-cutting release/verification tooling.
- **Dependencies:** app `package.json` (`ai` ^7 / `@ai-sdk/openai` ^4) versus `worker/package.json` (`ai` ^5 / `@ai-sdk/openai` ^2). Worker `tsconfig.json` path-maps `@/*` into `../src/*`, so `worker/src/ai.ts` re-exports `coreResolveModelForStage` from the app tree.
- **Local database:** `supabase/config.toml` `project_id = "easyhealth"`; containers already named `*_easyhealth`; CLI 2.109.0 `supabase test db --local` used by `test:eh119-db` and siblings. CI still runs `supabase db start` on ubuntu-latest.
- **Generated docs:** `scripts/generate-biomarker-docs.ts --check/--write`, files under `docs/03-modules/biomarkers.md` and `docs/05-data/biomarker-*.md`, managed README markers, `registry/biomarker-registry/v2.0.0/documentation-baseline.json`. Wiki remote publication is not required to unblock local `--check`.
- **Workflow:** `.github/workflows/measurement-registry.yml` already runs `typecheck:worker`, `check:biomarker-docs`, and database jobs. This change may add a documented local invocation, not a silent skip of those jobs.
- **Out of scope:** score formulas, Registry aliases as product behavior, reviewed panel specimen policy (#111), reopening #190, production `.env` contents in git.
