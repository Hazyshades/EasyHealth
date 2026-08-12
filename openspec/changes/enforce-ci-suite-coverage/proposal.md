## Why

Issue #110 remains open because verification scripts can be added to `package.json` without any corresponding GitHub Actions runner. The current workflow still omits seven suites, so Registry 2.0 expansion—107 definitions, 625 EN/RU/ES aliases, 72 candidate-corpus rows, generated documentation, and a seven-page Wiki mirror—can regress while CI remains green.

## What Changes

- Add a deterministic CI-suite coverage verifier that inventories every `test:*` package script, resolves the verification files it executes, and proves that each is reached by a workflow runner.
- Add an explicit, reviewed `local-only` policy for suites that cannot run in CI; an unclassified orphan fails CI rather than being silently ignored.
- Wire the seven remaining suites from #110 into the correct execution environments:
  - pure verification: `test:document-worker`, `test:eh113`, `test:eh116`;
  - local database: `test:eh113-db`, `test:eh116-db`, `test:pr2-db`;
  - full PostgREST integration: `test:postgrest-embeds`.
- Run the PostgREST suite against a real local Supabase/PostgREST stack with deterministic fixture cleanup; never satisfy it with CI placeholder credentials.
- Resolve or explicitly triage the known failures required by #110 closure: the `test:pr2-db` SQLSTATE contract mismatch and the pre-existing `test:eh111` unit-dimension conflict assertion. No failing suite may be hidden with `continue-on-error` or an untracked exception.
- Keep the existing Registry 2.0 documentation contract in the coverage inventory: generated docs checks, multilingual corpus checks, and Wiki-export derivation remain sourced from the typed catalog and technical corpus rather than from hand-maintained lists.
- Preserve the Wiki boundary established by the biomarker documentation change: `docs/` and the typed Registry 2.0 catalog remain canonical, the seven Wiki pages remain a generated mirror, and CI validates local render/staging freshness without editing the remote Wiki.
- Add regression evidence proving that a newly introduced `test:*` script without a runner fails CI and that an explicitly declared local-only suite is reported but allowed.
- Publish final CI evidence in issue #110 and close the issue only after the complete workflow is green and the acceptance criteria are mechanically demonstrated.

## Capabilities

### New Capabilities

- `ci-suite-coverage`: deterministic discovery, policy, and CI execution coverage for repository verification suites, including environment-specific runners and explicit local-only exceptions.

### Modified Capabilities

- `measurement-registry-governance`: Registry release verification must include complete, auditable CI-suite coverage and must not treat missing verification runners as a passing release condition.

## Impact

- **Target domains:** `documents` for worker and PostgREST integration verification; `health-profile` for Registry 2.0, CBC, multilingual alias, corpus, and Health Profile-adjacent verification; cross-cutting release governance for CI policy.
- **Affected workflow:** `.github/workflows/measurement-registry.yml`, with a new coverage guard and dedicated full-stack integration execution where required.
- **Affected package/test surface:** `package.json` `test:*` scripts; `scripts/verify-*`; `supabase/tests/*.sql`; `QA-Db_tests/*.sql`.
- **Affected existing capability specs for verification evidence:** `document-worker-reliability`, `cbc-measurement-regression-suite`, `biomarker-catalog`, `registry-release-corpus-governance`, and `measurement-registry-governance`. Product extraction, resolver, persistence, and scoring semantics are not intentionally changed.
- **Documentation/Wiki:** existing generated Registry 2.0 docs and seven-page Wiki mirror are validated and, if source output changes during implementation, regenerated through their existing deterministic exporter. No manual catalog or remote Wiki edits are introduced by CI.
- **Operational closure:** issue #110 receives a reproducible evidence comment and is closed only after required GitHub Actions checks pass.