## Context

Issue #110 is a release-safety gap in the repository's verification topology. `package.json` contains verification scripts whose underlying TypeScript or pgTAP files are not reached by `.github/workflows/measurement-registry.yml`. The current workflow has separate `verify` and `database` jobs, while `test:postgrest-embeds` additionally requires a live PostgREST endpoint. Seven suites remain outside CI after the earlier reduction from nine: `test:document-worker`, `test:pr2-db`, `test:postgrest-embeds`, `test:eh113`, `test:eh113-db`, `test:eh116`, and `test:eh116-db`.

The repository is also larger than the original issue context. Registry 2.0 now has a typed catalog, EN/RU/ES alias governance, CBC launch fixtures, a multilingual candidate corpus, generated `docs/` pages, and a seven-page generated GitHub Wiki mirror. The existing documentation change defines `docs/` and the typed catalog as canonical; the Wiki is derived output and must not become a second CI source of truth. The public Wiki currently contains generated approval-status text, so release approval state must remain separate from test-suite coverage and must not be hard-coded into the new checker.

Current evidence includes two known failures that must be addressed before claiming closure: `test:pr2-db` expects SQLSTATE `23503` while the current schema returns `23514` for one ownership assertion, and `test:eh111` has a pre-existing unit-dimension conflict assertion failure. These are contract decisions, not reasons to weaken CI.

## Goals / Non-Goals

**Goals:**

- Make every `test:*` package script either mechanically reachable from a GitHub Actions runner or explicitly declared `local-only` with a reviewable reason.
- Detect a newly added orphan suite before it can merge.
- Run the seven #110 suites in jobs that provide the correct environment and fail the workflow on real errors.
- Provide a full local Supabase/PostgREST integration path for `test:postgrest-embeds`, without CI placeholder credentials.
- Preserve the existing Registry 2.0 documentation and Wiki architecture while ensuring expanded catalog, multilingual, corpus, and generated-output checks remain visible to CI coverage analysis.
- Produce reproducible issue #110 closure evidence: coverage report, known-failure decisions, targeted suite results, and a green GitHub Actions run.

**Non-Goals:**

- No change to biomarker extraction, alias admission, resolver identity, observation persistence, Health Profile eligibility, scoring, or reprocessing semantics except where a failing test proves an existing contract is wrong and the separately reviewed fix is required.
- No automatic catalog growth from unknown labels and no new language or biomarker definitions.
- No remote Wiki API integration or automatic Wiki publication. The existing local generated-mirror workflow remains the only Wiki interaction in this change.
- No release-approval redesign. Candidate approvals, hashes, and launchability remain governed by the existing release-corpus process; the coverage checker only proves that the verification code is executed.
- No `continue-on-error`, silent skip, broad allowlist, or permanent exception for a failing suite.

## Decisions

### 1. Use package scripts plus a small explicit CI policy

Add a non-`test:*` command such as `check:ci-suite-coverage` backed by `scripts/verify-ci-suite-coverage.ts` and a versioned policy file under `ci/`. The checker will:

1. read `package.json` and enumerate every `test:*` script;
2. resolve direct `tsx` and `supabase test db --local` file operands plus nested `pnpm run` script references;
3. read workflow `run` steps and normalize the package-script/direct-command invocations that execute verification files;
4. compare the transitive verification-file set for every test script with the workflow-reachable set;
5. require every exception to appear in an explicit `localOnly` policy entry with an owner-facing reason; and
6. print a deterministic report of covered, local-only, and orphan suites.

A new `test:*` script with no policy entry and no reachable workflow file fails the check. Existing workflow aggregators such as `verify:registry` are resolved transitively, so a file is not reported as orphaned merely because it is not invoked through a dedicated `test:*` step. The checker is itself a `check:*` command, not a `test:*` suite, avoiding self-reference.

A purpose-built normalized scanner is preferred over a full YAML dependency: workflow parsing is limited to `run` command blocks and is covered by fixture tests for single-line commands, block commands, `&&` chains, environment prefixes, comments, and nested package scripts. If the workflow structure outgrows that parser, the checker must fail closed rather than silently under-counting coverage.

**Alternative rejected:** a hand-maintained list of all covered suites without comparing it to `package.json`. That recreates the defect by allowing a new test script to be omitted from the list.

### 2. Route suites by runtime requirements

Keep jobs separated by the resources they need:

- `verify`: run `test:document-worker`, `test:eh113`, and `test:eh116` with deterministic dummy environment values where imports require them. Run the existing generated-doc, multilingual, Registry, and corpus checks in the same job as today.
- `database`: after starting local Supabase database services, run `test:eh113-db`, `test:eh116-db`, and `test:pr2-db`. Stop the stack with `if: always()`.
- `integration`: start the full local Supabase stack, expose its real PostgREST URL and service-role key only to the step, run `test:postgrest-embeds`, and stop the stack even after failure. The test must never be changed to accept `ci-placeholder` values.

The coverage report records both the suite and its owning job. A suite is not considered covered merely because a similarly named check or a local developer command exists.

**Alternative rejected:** run every suite in the existing `verify` job. That would either give database suites no database or tempt callers to replace live integration credentials with placeholders.

### 3. Treat known failures as contract triage

Before final closure:

- For `test:pr2-db`, inspect the intended ownership invariant and current constraint ordering. Fix the schema or fixture expectation so the test asserts the intended rejection, preserving the error contract rather than accepting arbitrary SQLSTATEs.
- For `test:eh111`, decide whether the missing `unit_dimension_conflict` is resolver behavior or stale test expectation. Update the source behavior or the contract fixture accordingly, and record the decision in the implementation evidence.
- For `test:postgrest-embeds`, retain unique ephemeral fixture IDs and `finally` cleanup. A failed cleanup or endpoint setup must fail the integration contract or be visible in the job logs; it cannot turn into a green skip.

**Alternative rejected:** mark these tests flaky, allow failure, or broaden assertions until they pass. That would close the issue cosmetically while leaving the underlying regression gap.

### 4. Keep Registry 2.0 and Wiki evidence derived

The coverage guard treats existing commands such as `check:biomarker-docs`, `test:biomarker-docs`, multilingual corpus checks, and Registry release checks as ordinary workflow-reachable verification sources. It does not parse the remote Wiki, copy catalog counts into a policy file, or interpret approval text.

When the typed catalog, aliases, corpus, or generated docs change, the existing baseline and generated-output checks remain responsible for freshness. The seven-page Wiki is validated only through the existing deterministic local render/staging contract. CI does not publish or mutate the remote Wiki, and a stale approval paragraph in a generated mirror cannot make a technical suite appear covered or launchable.

### 5. Make closure evidence mechanically reviewable

The implementation will add or extend contract tests for:

- a package fixture containing an unrunnered `test:*` script, which must produce a non-zero coverage check;
- an explicitly declared `localOnly` fixture, which must be reported and allowed;
- workflow command forms and transitive script resolution;
- the seven required suite-to-job assignments; and
- generated documentation/Wiki commands remaining derived and side-effect-free.

Final evidence must include the coverage report, all targeted suite results, the known-failure triage decisions, the existing Registry 2.0 documentation/corpus checks, and a successful GitHub Actions run. Only then may the maintainer comment on and close issue #110.

## Risks / Trade-offs

- **Workflow parser drift:** a lightweight parser can miss a newly introduced YAML shape. Fixture coverage and fail-closed behavior reduce the risk; changing workflow syntax may require updating the parser contract in the same change.
- **Policy escape hatch:** `localOnly` can become a way to hide failures. Entries require a reason and review, and the seven release-relevant suites in #110 are not eligible for permanent local-only status.
- **CI duration and resource usage:** full Supabase/PostgREST setup adds time and Docker resource pressure. Isolating the integration job keeps pure verification fast while preserving real endpoint coverage.
- **Database error-code stability:** PostgreSQL may expose a different constraint error when schema order changes. The fix must assert the intended invariant and document whether the exact SQLSTATE is part of the public contract.
- **Generated Wiki freshness:** the remote Wiki is outside CI and may lag canonical docs. The change will report local render/staging status and preserve the existing owner-controlled publication boundary rather than pretending remote freshness is automatically proven.
- **Overlap with active biomarker changes:** new catalog or multilingual fixtures may add `test:*` scripts while this work is in flight. The coverage check must consume the current package/workflow graph and not freeze today's seven-suite count as an implementation constant.
