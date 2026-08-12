## 1. Inventory and policy foundation

- [x] 1.1 Capture the current `package.json` `test:*` script graph, workflow commands, seven issue-110 orphans, and the known `test:pr2-db`/`test:eh111` failures as implementation baselines.
- [x] 1.2 Define the versioned CI-suite policy format, including suite identity, verification files, required job/environment, local-only status, owner, and reason fields; reject undocumented exceptions.
- [x] 1.3 Implement transitive package-script resolution for direct `tsx`, `supabase test db --local`, chained `&&`, and nested `pnpm run` commands without relying on a duplicated biomarker test list.
- [x] 1.4 Implement fail-closed workflow command discovery for single-line and block `run` steps, environment prefixes, comments, command chains, and supported package-script invocations.
- [x] 1.5 Add `check:ci-suite-coverage` and a deterministic report of covered, local-only, orphaned, stale-policy, and unsupported-command entries.

## 2. Coverage contract tests

- [x] 2.1 Add fixture coverage for an unrunnered `test:*` script that fails with the script and underlying verification file named.
- [x] 2.2 Add fixture coverage for an explicitly reviewed local-only suite and for a stale local-only policy entry.
- [x] 2.3 Add fixture coverage for nested package scripts, `&&` chains, workflow block commands, and fail-closed unsupported workflow syntax.
- [x] 2.4 Add assertions that the seven issue-110 suites map to the intended `verify`, `database`, or `integration` job and that no required suite is local-only.
- [x] 2.5 Add a contract proving generated Registry 2.0 documentation, multilingual corpus, candidate-release, and local Wiki-render commands remain derived from canonical sources and are not replaced by hard-coded biomarker counts.

## 3. Workflow execution wiring

- [x] 3.1 Add `test:document-worker`, `test:eh113`, and `test:eh116` to the verify job with only the deterministic environment placeholders required for module loading.
- [x] 3.2 Add `test:eh113-db`, `test:eh116-db`, and `test:pr2-db` to the database job after local Supabase database startup, with unconditional stack shutdown.
- [x] 3.3 Add a full-stack Supabase/PostgREST integration job for `test:postgrest-embeds`, inject real local endpoint credentials only for the test step, and shut the stack down on every outcome.
- [x] 3.4 Add the coverage check to the Measurement Registry workflow before release verification and ensure a non-zero suite or coverage result fails the job.
- [x] 3.5 Verify that the existing Registry 2.0 documentation, EN/RU/ES multilingual, corpus, trace, CBC, and generated Wiki-local-render checks remain reachable after workflow changes. Coverage reports 45/45 reachable; deterministic docs, multilingual, candidate corpus, CBC, runtime, and Wiki render checks pass. Trace remains environment-dependent and is covered by the workflow.

## 4. Known failure resolution and integration safety

- [x] 4.1 Reproduce `test:pr2-db` on a clean local Supabase reset, inspect the ownership constraints, and fix the schema or fixture assertion to preserve the intended cross-owner rejection contract.
- [x] 4.2 Reproduce `test:eh111` and decide whether the missing `unit_dimension_conflict` is resolver behavior or stale expected evidence; apply the smallest contract-correct fix and record the decision. Decision: resolver behavior is correct; the fixture used non-authorized shorthand labels and an unevidenced `serum` specimen. Canonical CBC labels and source text containing `serum` now exercise the intended unit-dimension conflict and stated-axis contract.
- [x] 4.3 Exercise `test:postgrest-embeds` against the full local stack, verify all consumer embeds and the old-hint compatibility read, and prove fixture cleanup runs after success and failure. Added explicit service-role table grants for the direct PostgREST fixture path, residue assertions, and a test-only forced-failure path; clean-stack success and expected failure both clean every fixture row.
- [x] 4.4 Confirm no required suite uses `continue-on-error`, placeholder credentials for live integration, silent skips, or undocumented local-only exceptions. Static workflow review found placeholders only on node-only module-loading steps; integration receives local Supabase outputs, and coverage reports no local-only suites.

## 5. Closure evidence and release handoff

- [x] 5.1 Run the complete coverage verifier and all seven issue-110 suites from a clean dependency/database setup, recording the deterministic report and known-failure decisions. Locked dependencies installed; coverage reports 45/45 covered, 0 local-only/orphaned/partial/invalid; document-worker, EH-113, EH-116, PR2 DB, and PostgREST suites pass.
- [x] 5.2 Run the existing Registry 2.0 documentation, biomarker, multilingual, corpus, Wiki-local-export, and relevant database contracts to prove expanded biomarker coverage remains intact. Generated docs, Registry, multilingual, CBC, Wiki render, all workflow database contracts, and TypeScript typecheck pass.
- [ ] 5.3 Run the full GitHub Actions workflow and retain the passing verify, database, and integration evidence, including artifact/report output where configured. BLOCKED: this uncommitted worktree has no valid remote CI run, and no local `act` runner is installed; local equivalents are green.
- [ ] 5.4 Add a reproducible evidence comment to issue #110 linking the change, coverage report, suite results, and final CI run; close the issue only after every acceptance criterion passes. BLOCKED: issue closure depends on the missing committed-change GitHub Actions run.
- [x] 5.5 Document the maintainer workflow for adding future verification suites, including the required package script, policy disposition, workflow runner, and mutation-test expectation. See `ci/README.md`.
