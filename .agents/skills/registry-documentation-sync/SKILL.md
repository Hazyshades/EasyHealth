---
name: registry-documentation-sync
description: Keep Registry, biomarker, catalog, alias, resolver, corpus, and assessment changes synchronized across canonical Markdown documentation, the GitHub Wiki mirror, and a tracking GitHub issue. Use whenever a change touches registry data or runtime behavior.
---

# Registry Documentation Synchronization

This is a completion gate for every change that can alter the public meaning of a
biomarker, the Registry, laboratory resolution, assessment bindings, or the
Health Profile projection.

## Activate when

Use this skill when a change:

- edits `registry/**`, `src/lib/biomarkers/**`, biomarker extraction/resolution,
  assessment bindings, Health Profile laboratory projection, or related worker
  code;
- changes biomarker aliases, definitions, analytes, specimens, properties, value
  kinds, units, conversions, maturity, lifecycle, provenance, corpus fixtures,
  approval policy, or catalog manifests;
- changes database migrations, RPCs, API routes, reprocessing, observations, or
  review flows that persist or consume biomarker resolution;
- changes generated biomarker documentation, the Wiki exporter, or the Registry
  verification/CI gates.

A test-only change is in scope when it changes a Registry contract or fixture.
A formatting-only change to unrelated code is not in scope.

## Source-of-truth rule

- Typed Registry/runtime data and behavior are authoritative.
- `docs/` is the canonical human-readable documentation surface.
- The GitHub Wiki is a generated mirror, not an independent source of truth.
- A GitHub issue is the tracking and publication record, not a second catalog.
- Never hand-edit generated catalog, alias, corpus, or Wiki inventory pages.
- A `[Registry Docs]` issue is not a product feature. Wiki tails are not the
  next sprint.

## Required workflow

### 1. Classify the change

Before editing, list the affected Registry surfaces and find an existing open
tracking issue for the same logical change. Reuse and update that issue instead
of creating duplicate issues. If no matching issue exists, plan one with the
`[Registry Docs]` title prefix.

Record whether the change affects:

- definition identity or counts;
- aliases or locale/laboratory governance;
- units, conversions, or missing-unit behavior;
- resolution outcomes or unknown-label handling;
- assessment bindings, scoring, readiness, or Health Profile admission;
- persistence, migrations, RPCs, API contracts, or reprocessing;
- corpus evidence, approval-independent technical checks, or release gates.

### 2. Update canonical documentation

Update the relevant source or runtime code first, then regenerate the owned
Markdown files. At minimum, inspect these files when the matching surface is
changed:

- `docs/03-modules/biomarkers.md`
- `docs/05-data/biomarker-catalog.md`
- `docs/05-data/biomarker-aliases.md`
- `docs/05-data/biomarker-corpus-evidence.md`
- `docs/README.md`

Use the repository generator and drift check when available:

```text
pnpm generate:biomarker-docs
pnpm check:biomarker-docs
pnpm test:biomarker-docs
```

Document both implemented behavior and explicit unavailable/deferred behavior.
Do not describe a planned admin queue, automatic catalog growth, automatic
reprocessing, or source-document provenance promotion as existing functionality.

### 3. Synchronize the Wiki

Regenerate the Wiki mirror from canonical docs. For this repository:

```text
pnpm render:biomarker-wiki
pnpm export:biomarker-wiki -- --output=<empty-local-staging-dir>
```

Review the local staging output and publish the same generated pages to the
repository Wiki through the approved publication path. Do not claim “Wiki
updated” from a local render alone. If remote publication is unavailable, mark
the issue and completion gate `BLOCKED` or `PENDING`, include the rendered
staging evidence, and state exactly what a maintainer must publish.

Do not use `gh repo view owner/repo.wiki` as a Wiki-existence check. GitHub
Wikis are not GraphQL Repositories. Probe with
`git ls-remote https://github.com/Hazyshades/EasyHealth.wiki.git`.

A `[Registry Docs]` issue is tracking, not a feature. If canonical docs are
green and the only leftover is Wiki `PENDING` from that GraphQL miss, or the
issue is still open after Wiki `PUBLISHED`, close it as an ops tail. Do not
take it as the next sprint. Historical examples: #150, #158 (PENDING probe);
#159, #167 (already PUBLISHED, left open).

### 4. Create or update the tracking issue

Create or update exactly one issue for the logical Registry change. The issue
must be concise and must not paste the full catalog or alias inventory. Include:

- the change summary and affected Registry surfaces;
- links to the canonical `docs/` pages;
- links to the published Wiki pages, or a clear `PENDING`/`BLOCKED` status;
- source branch, PR, or commit when available;
- regeneration, drift-check, and verification commands;
- current counts or contract deltas when they changed;
- known gaps, deferred behavior, and required follow-up;
- evidence for docs, Wiki, issue, and CI status.

Use `.github/ISSUE_TEMPLATE/registry-documentation-update.md` as the issue
body contract. Rendered issue text may be prepared locally, but remote issue
creation/update must be confirmed before the work is called complete.

### 5. Verify the complete surface

Run the narrowest applicable checks plus the Registry checks required by the
change. At minimum, for generated documentation changes run:

```text
pnpm check:biomarker-docs
pnpm test:biomarker-docs
```

Also run typecheck and relevant Registry/runtime/database checks. Verify that:

- generated docs are current and deterministic;
- all affected definitions, aliases, bindings, and corpus rows are represented;
- Wiki output is derived from canonical docs and contains no stale page;
- the tracking issue links resolve and accurately state publication status;
- unavailable environment-dependent checks are reported as blocked, not passed.

## Completion gate

Do not mark a Registry/biomarker change complete until every applicable box is
true:

- [ ] Canonical `docs/` pages were updated or intentionally confirmed unchanged.
- [ ] Generated documentation drift check passes.
- [ ] Wiki mirror was regenerated, reviewed, and published; or the issue records
      an explicit `PENDING`/`BLOCKED` handoff with evidence.
- [ ] One matching GitHub tracking issue was created or updated.
- [ ] The issue links canonical docs, Wiki status, commands, verification, and
      remaining gaps.
- [ ] Relevant tests/typecheck/database checks ran, with blockers recorded.
- [ ] No claim of completion relies on an unpublished local file or an imagined
      interface.
- [ ] A Wiki-only leftover is not left open as sprint/feature work.

If a required remote action cannot be performed, finish all local work, report
the exact blocker, and leave the issue/documentation status open rather than
silently skipping the action. Do not convert that leftover into the next
sprint.
