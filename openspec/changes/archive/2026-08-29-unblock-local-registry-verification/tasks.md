## 1. Documents — worker AI SDK alignment

- [x] 1.1 Bump `worker/package.json` `ai` and `@ai-sdk/openai` onto the application major line (`ai` ^7, `@ai-sdk/openai` ^4) and refresh `worker/pnpm-lock.yaml`
- [x] 1.2 Confirm `worker/src/ai.ts` still re-exports `coreResolveModelForStage` and that `worker/src/pipeline-llm.ts` `runStageTextOrImage` accepts that model type without a compatibility-discarding cast
- [x] 1.3 Run `pnpm --dir worker install --frozen-lockfile` and `pnpm typecheck:worker`; fix remaining `LanguageModel` mismatches only in worker/app AI boundary files
- [x] 1.4 Run `pnpm typecheck` and `pnpm test:document-worker` after the bump; stop and record a design amendment if `generateText` / message shapes break

## 2. Cross-cutting — local pgTAP against Docker

- [x] 2.1 Probe whether `supabase test db --local --db-url postgresql://postgres:<local>@127.0.0.1:54322/postgres` works for `QA-Db_tests/eh119_observation_measurement_correction.sql` without writing the password into the repo
- [x] 2.2 If the CLI still returns `LegacyDbConnectError` or a Windows mount error, run the same SQL via `docker exec -i supabase_db_easyhealth psql` and record that as the local path
- [x] 2.3 Execute EH-119, EH-122, EH-123, EH-142, and EH-144 SQL files through the chosen local path; do not run `supabase db reset`
- [x] 2.4 Add a short developer note (QA checklist fragment or `docs/07-ops` pointer) that CLI connect failure is not a failed contract when in-container pgTAP PASSes, and that CI still uses `supabase db start`

## 3. Health-profile docs — generated Registry mirror

- [x] 3.1 Run `pnpm check:biomarker-docs` and capture the stale file list
- [x] 3.2 If stale, run `pnpm generate:biomarker-docs` and review the generator-owned diff only
- [x] 3.3 If baseline counts, manifest version, or digest disagree, update `registry/biomarker-registry/v2.0.0/documentation-baseline.json` in the same change after reconciling with runtime exports
- [x] 3.4 Run `pnpm check:biomarker-docs` and `pnpm test:biomarker-docs`; do not hand-edit owned Markdown or the README marker interior

## 4. Verification

- [x] 4.1 Run `pnpm test:document-review` with CI placeholder env or `tsx --env-file=.env`; confirm hook-order and persistence-seam assertions pass without live API calls
- [x] 4.2 Re-run #190-adjacent gates: `pnpm typecheck`, `pnpm test:health-profile-reported-results`, `pnpm test:eh122`, `pnpm test:health-profile-drawer-status`, `pnpm test:document-persistence-boundaries`
- [x] 4.3 Run `corepack pnpm exec openspec validate unblock-local-registry-verification --strict`
- [x] 4.4 Confirm no Health Profile scoring, reported-results, or extraction-persistence product files changed except worker SDK types and generated docs/baseline
