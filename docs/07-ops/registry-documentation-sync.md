# Registry Documentation Synchronization

Every change that can alter Registry, biomarker catalog, resolution, assessment
bindings, or Health Profile laboratory behavior must keep canonical Markdown,
the GitHub Wiki mirror, and one tracking GitHub issue synchronized.

## Scope

This policy applies to changes involving:

- `registry/**`, `src/lib/biomarkers/**`, biomarker extraction/resolution, worker
  persistence, assessment bindings, or Health Profile laboratory projection;
- definitions, analytes, aliases, locale/laboratory governance, specimens,
  properties, value kinds, units, conversions, maturity, lifecycle, provenance,
  corpus fixtures, approval policy, or catalog manifests;
- migrations, RPCs, API routes, observations, reprocessing, and review flows
  that persist or consume biomarker resolution;
- generated biomarker docs, Wiki export code, Registry verification, or CI gates.

The typed catalog and runtime code remain authoritative. `docs/` is the
canonical human-readable surface. The Wiki is a generated mirror. A GitHub issue
is an index and tracking record, not a duplicate catalog.

The agent workflow is defined in
[`registry-documentation-sync`](../../.agents/skills/registry-documentation-sync/SKILL.md).
`AGENTS.md` makes that workflow a repository completion gate.

## Required sequence

### 1. Identify the logical change

Before editing, list affected Registry surfaces and search for an existing open
tracking issue. Update that issue when it covers the same logical change; create
one new issue with the title prefix `[Registry Docs]` when none exists. Do not
create multiple issues for generated pages from one source change.

### 2. Update canonical docs

Change source/runtime behavior first, then regenerate the owned outputs. For the
current Registry 2.0 documentation surface:

```text
pnpm generate:biomarker-docs
pnpm check:biomarker-docs
pnpm test:biomarker-docs
```

Review the module lifecycle, definition catalog, alias governance, corpus
evidence, and `docs/README.md`. State unavailable or deferred capabilities as
unavailable; do not present planned catalog promotion, automatic reprocessing,
admin review, or provenance workflows as implemented.

### CI verification safeguards

The Measurement Registry workflow runs
`pnpm check:fail-fast-verification` before suite-coverage checks. The guard
reads package scripts and workflow `run` fields and rejects a verifier followed
by `rg`, `grep`, or `findstr` through `;` or `||`, because a later search can
mask an earlier failure. A chain joined with `&&` is accepted as fail-fast.
Executable verifiers and structural checks remain independently named workflow
steps.

The final `verify:registry` step uses Bash `set -o pipefail` and `tee`. On
failure it appends a labeled fenced block containing the last 200 output lines
to `$GITHUB_STEP_SUMMARY` and preserves the non-zero exit status. Full output
remains in the Actions log; the summary is intentionally bounded and must not
expose credentials. These safeguards change CI diagnostics and command
composition checks only; they do not change Registry semantics or catalog data.

### 3. Update the Wiki mirror

Render and stage the Wiki only from canonical docs:

```text
pnpm render:biomarker-wiki
pnpm export:biomarker-wiki -- --output=<empty-local-staging-dir>
```

Review the staging directory, then publish the generated pages through the
approved Wiki publication path. A local staging directory is evidence for a
handoff, not proof that the remote Wiki changed. If publication is unavailable,
record `PENDING` or `BLOCKED` in the tracking issue and name the exact handoff.

Do not probe Wiki existence with `gh repo view Hazyshades/EasyHealth.wiki`.
GitHub Wikis are not GraphQL Repositories; that command fails even when the
Wiki git remote is live. Confirm the remote with:

```text
git ls-remote https://github.com/Hazyshades/EasyHealth.wiki.git
```

A `[Registry Docs]` issue is an index, not a product feature. When canonical
docs are already green and the source change has no remaining Registry
semantic delta, Wiki `PENDING`/`BLOCKED` from that GraphQL miss — or an issue
left open after Wiki was already `PUBLISHED` — is an ops tail. Close it with
that disposition. Do not schedule it as the next sprint. Closed examples of
this class: #150, #158, #159, #167.

### 4. Create or update the issue

The issue must contain only a concise index and tracking record:

- summary of the Registry change and affected surfaces;
- links to canonical docs and Wiki pages;
- source branch/PR/commit when available;
- generation, drift-check, and test commands;
- changed counts or contract deltas;
- docs, Wiki, CI, and publication status;
- remaining gaps and explicit follow-up owners/actions.

Use the repository template:

`.github/ISSUE_TEMPLATE/registry-documentation-update.md`

Do not paste all 107 definitions or 625 aliases into an issue.

## Completion checklist

A change is complete only when all applicable items are true:

- [ ] Canonical docs were updated or intentionally confirmed unchanged.
- [ ] Generated docs are deterministic and `pnpm check:biomarker-docs` passes.
- [ ] `pnpm test:biomarker-docs` and relevant runtime/database checks pass.
- [ ] Wiki output was regenerated and reviewed.
- [ ] Remote Wiki publication is confirmed, or the issue contains an explicit
      `PENDING`/`BLOCKED` handoff with local staging evidence.
- [ ] One matching GitHub issue was created or updated.
- [ ] The issue links docs, Wiki status, commands, verification, and gaps.
- [ ] Environment-dependent checks are reported as blocked rather than passed.
- [ ] A Wiki-only leftover is not left open as sprint/feature work.
