# Local pgTAP against Docker Supabase

Worktree checkouts often share the Docker stack started from the main EasyHealth directory (`project_id = "easyhealth"`, container `supabase_db_easyhealth`, host port **54322**). Bare `supabase test db --local` looks up a stack for the current directory and can fail with `LegacyDbConnectError` even when Postgres is healthy.

`pnpm test:*-db` goes through `scripts/run-supabase-db-tests.mjs`. That runner tries `--local` first (CI after `supabase db start`), then `--db-url` on `127.0.0.1:54322` without `--local`, then `docker exec` into `supabase_db_easyhealth`.

## Do not reset the shared stack

Do not run `supabase db reset` to make these suites green. A reset wipes synthetic data used by other worktrees. CI remains the clean-database authority: `.github/workflows/measurement-registry.yml` runs `supabase db start` then the existing `test:*-db` scripts.

## Preferred local invocation

Use the package scripts:

```text
pnpm test:eh119-db
pnpm test:eh122-db
pnpm test:eh123-db
pnpm test:eh142-db
pnpm test:eh144-db
```

Override the URL with `SUPABASE_DB_URL` or `SUPABASE_TEST_DB_URL` when the shared stack is not on the default local Docker role. On Supabase CLI 2.109.0, `--local` and `--db-url` are mutually exclusive; the runner never sets both. Use `127.0.0.1`, not `localhost`.

## Fallback when the CLI cannot connect or mount

If `--db-url` still returns `LegacyDbConnectError`, `LegacyDockerRunError`, or a Windows Docker mount error (`mkdir /run/desktop/mnt/host/c`), the runner executes the **same** SQL file in the container:

```text
docker exec -i supabase_db_easyhealth psql -U postgres -d postgres < QA-Db_tests/eh119_observation_measurement_correction.sql
```

A pgTAP `PASS` from that path is accepted local evidence. TAP `not ok` / `Result: FAIL` is a failed suite even when `psql` exits 0. CLI connect failure is not a failed database contract. CI still uses `supabase db start` and `--local`.
