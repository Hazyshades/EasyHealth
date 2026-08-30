# Verification suite onboarding

Every new `test:*` package script must be part of the same change as its CI disposition and workflow runner.

## 1. Add the package script

Use a deterministic command in `package.json`:

- `tsx` commands must name the verification file directly.
- Database commands must use `node scripts/run-supabase-db-tests.mjs <file.sql>`. That runner tries `supabase test db --local` first (CI after `supabase db start`), then `--db-url` without `--local`, then the same SQL via `docker exec` `psql`. A TAP failure is a failed suite. Do not invoke `supabase db reset`.
- Chained commands and `pnpm run <script>` references are resolved transitively, but keep the chain readable.
- Do not add a silent skip, `continue-on-error`, or a placeholder credential to make a suite pass.

## 2. Add the policy entry

Add an entry to `ci/verification-suite-policy.json` with:

- the exact package-script name;
- every TypeScript or SQL verification file reached by the script;
- the owning workflow job (`verify`, `database`, or `integration`) when routing matters;
- the required environment (`node-only`, `local-supabase-db`, or `local-supabase-postgrest`) when routing matters;
- an owner and review reason.

Use `localOnly` only when the suite genuinely cannot run in GitHub Actions. A local-only entry still needs its verification files, owner, and reason; it must not have a workflow runner. Release-relevant or database/integration suites must not be classified local-only to hide a failure.

## 3. Add the workflow runner

Add the command to `.github/workflows/measurement-registry.yml` in the job matching its runtime:

- `verify` for deterministic pure checks;
- `database` after `supabase db start`, with unconditional `supabase stop --no-backup`;
- `integration` after the full `supabase start`, passing real local endpoint credentials only to the consumer step and stopping the stack unconditionally.

If a suite needs environment variables only because an imported module validates configuration, use deterministic non-network placeholders in `verify`. Never use those placeholders for a live Supabase/PostgREST test.

## 4. Add contract coverage

Extend `scripts/verify-ci-suite-coverage-contract.ts` when introducing a new command form, policy exception, or routing rule. Include a mutation-style fixture that fails when:

- the `test:*` script has no reachable workflow runner;
- a policy entry names a removed script or file;
- the expected job is changed or the suite is made local-only;
- generated evidence is replaced with a hard-coded catalog count.

The coverage checker must discover the current `package.json` graph and workflow commands; do not maintain a second list of all test suites.

## 5. Preserve fail-fast verification

Run `pnpm check:fail-fast-verification` when changing verification scripts or workflow commands. The guard reads package scripts and workflow `run` fields and rejects a verifier followed by `rg`, `grep`, or `findstr` through `;` or `||`, because a later search can mask an earlier failure. A chain joined with `&&` is accepted as fail-fast. Keep executable verifiers and structural checks as independently named workflow steps.

The Measurement Registry workflow wraps `pnpm verify:registry` with Bash `set -o pipefail` and `tee`. When verification fails, the step appends a labeled fenced block containing the last 200 output lines to `$GITHUB_STEP_SUMMARY` and preserves the non-zero exit status. Full output remains in the Actions log; the summary is intentionally bounded and must not expose credentials.

## 6. Verify before review

Run:

```text
pnpm check:fail-fast-verification
pnpm check:ci-suite-coverage-contract
pnpm check:ci-suite-coverage
pnpm typecheck
```

Then run the new suite directly and the applicable workflow-local contracts. For generated Registry documentation, corpus, and Wiki staging, verify that output is derived from canonical sources and that no remote Wiki is mutated. A failing database or integration suite requires a contract fix or explicit triage; it must not be skipped or downgraded to local-only.
