## Context

Measurement Registry CI (`.github/workflows/measurement-registry.yml`) already requires `pnpm typecheck:worker`, `pnpm check:biomarker-docs`, and `supabase test db --local` after `supabase db start` on ubuntu-latest. This worktree can pass the #190 product verifiers while those three gates fail locally.

Current state:

```
app node_modules/ai  ^7  LanguageModelV4 ("v4")
        ▲
        │  worker/src/ai.ts re-exports coreResolveModelForStage
        │  from ../../src/lib/ai/resolve-model-core
        │
worker node_modules/ai  ^5  LanguageModelV2 ("v2")
        ▲
        │  worker/src/pipeline-llm.ts types runText/runImage as LanguageModel
        │
        ✕  Type '"v4"' is not assignable to type '"v2"'
```

`worker/tsconfig.json` includes worker sources and selected `../src/lib/**` files, with `@/*` mapped into the app tree. `skipLibCheck` does not hide the argument mismatch.

Postgres is already up as `supabase_db_easyhealth:54322` from the main EasyHealth compose. `supabase test db --local` from this worktree returns `LegacyDbConnectError`. The same SQL files pass when piped through `docker exec … psql`. `~/.supabase/profile` is absent; `SUPABASE_DB_URL` is unset. Windows Docker mount failures for `supabase test db` are already recorded in EH-116, EH-121, and the i18n change.

`pnpm check:biomarker-docs` compares generator output to four owned files plus the marked README section. Runtime catalog/aliases/corpus have moved; the files have not been regenerated. Wiki publication is a separate maintainer action.

Static scripts such as `test:document-review` import `src/lib/biomarkers` → `src/lib/env.ts`. CI injects placeholder keys; local `tsx` does not load `.env` unless `--env-file` is passed.

## Goals / Non-Goals

**Goals:**

- One `LanguageModel` specification version on the worker typecheck path after a frozen worker install.
- A documented, repeatable way to run the EH-119/122/123/142/144 pgTAP files against the existing local Docker database without `db reset`.
- Canonical generated Registry docs matching the current runtime catalog so `--check` is green, or an explicit baseline update in the same change if counts/digest moved.
- Placeholder-env or `--env-file` path for env-gated static verifiers without committing secrets.

**Non-Goals:**

- Changing extraction, resolver, Health Profile scoring, or reported-results UX.
- Reopening or amending archived `harden-health-profile-review-papercuts`.
- Implementing reviewed panel specimen policy (#111).
- Publishing the GitHub Wiki or creating a Registry docs tracking issue (unless generate/check forces a new tracking comment later).
- Replacing CI's `supabase db start` disposable stack.
- Weakening `check:biomarker-docs` to ignore drift.

## Decisions

### 1. Align worker AI SDK with the application, not isolate tsconfig

Prefer bumping `worker/package.json` `ai` and `@ai-sdk/openai` to the same major line as the app (`ai` ^7, `@ai-sdk/openai` ^4) and refreshing `worker/pnpm-lock.yaml` so `pnpm --dir worker install --frozen-lockfile` and `pnpm typecheck:worker` share `LanguageModelV4`.

Rejected: narrowing worker `include` so app LLM modules are invisible — that hides a real dual-package graph while runtime still crosses the boundary.

Rejected as the primary fix: opaque `any` / duplicate local `LanguageModel` aliases in `pipeline-llm.ts` — type-only and can mask a runtime SDK mismatch.

If the bump breaks `generateText` / message shapes, stop and record a follow-up; do not paper over with `skipLibCheck: false` exceptions. Runtime extraction call sites (`runStructuredTextExtraction`, worker `runStageTextOrImage`) MUST keep compiling against the app helpers they already import.

### 2. Explicit local DB URL, then in-container psql fallback

First attempt: document and, if the CLI supports it in 2.109.0, thread `postgresql://postgres:<local docker password>@127.0.0.1:54322/postgres` into `supabase test db --local --db-url …` (or `PGHOST=127.0.0.1`). Use `127.0.0.1`, not `localhost`, to avoid IPv6/socket surprises on Windows.

Do not `supabase db reset` on the shared `easyhealth` stack: it destroys other worktrees' synthetic data (already called out in EH-126 QA).

If CLI connect/mount still fails (`LegacyDbConnectError`, `LegacyDockerRunError`, `mkdir /run/desktop/mnt/host/c`), run the **same** SQL files via:

`docker exec -i supabase_db_easyhealth psql -U postgres -d postgres < <file.sql>`

That is accepted local evidence, matching the i18n change. CI remains the authority for a clean disposable database.

Optional package scripts (for example `test:eh119-db:docker`) MUST name the identical SQL path as `test:eh119-db` and MUST NOT be the only CI runner.

### 3. Generator write, not hand edits

Stale docs are fixed only by `pnpm generate:biomarker-docs` (`--write`). Review the diff for catalog counts, alias tables, and Health Profile eligibility wording. If the baseline digest/counts no longer match, update `documentation-baseline.json` in the same change after reconciling with `MEASUREMENT_CATALOG_MANIFEST_*`. Then `pnpm check:biomarker-docs` and `pnpm test:biomarker-docs` MUST pass.

Do not edit the four owned Markdown files or the README interior by hand. Do not treat Wiki remote publish as a gate for this change. OpenSpec `generate-biomarker-reference-documentation` task 2.2 remains a separate incomplete extraction; this change MUST NOT finish that task unless the generator already depends on the shared helper (it does via `health-profile-input.ts`).

### 4. Env for static verifiers

Keep CI placeholders. Locally, prefer `corepack pnpm exec tsx --env-file=.env scripts/verify-document-review-runner.ts` when a real `.env` exists, or the four CI placeholders when it does not. Do not change `src/lib/env.ts` validation for production. A later isolation of resolver imports from `env.ts` is optional and out of the minimum path.

## Risks / Trade-offs

- [Worker SDK bump changes runtime generateText] → Typecheck worker and a focused `test:document-worker` after the bump; revert the bump if pipeline compile fails.
- [Shared Docker DB is not a clean CI clone] → Never reset it for this change; record CLI vs docker-exec evidence separately; CI database job stays authoritative.
- [Docs regenerate a large catalog diff] → Generator-only files; review for accidental non-docs edits; no product copy in app UI.
- [Lockfile-only worker change surprises CI frozen install] → Commit `worker/pnpm-lock.yaml` with the package bump.

## Migration Plan

1. Worker dependency bump + lockfile + `pnpm typecheck:worker`.
2. Document local pgTAP invocation; run EH-119/122/123/142/144 via CLI-with-url or docker exec.
3. `pnpm generate:biomarker-docs` if `--check` still fails; baseline only if manifest/counts require it.
4. Re-run `typecheck`, `typecheck:worker`, `check:biomarker-docs`, `test:biomarker-docs`, focused #190 verifiers (reported-results, document-review, eh122, drawer, persistence).
5. Rollback: revert worker package/lockfile and generated docs independently; no database migration exists.

## Open Questions

- Exact local Docker `postgres` password in this environment (standard local Supabase `postgres`, not the app service role). Confirm at apply time without writing secrets into OpenSpec artifacts.
- Whether Supabase CLI 2.109.0 on this Windows host accepts `--db-url` for `test db --local`; if not, docker exec is the documented local path.
