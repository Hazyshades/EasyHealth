## Papercuts

This rule applies to every workflow, including OpenSpec skills.

When you encounter friction during work — for example a failed tool call, broken link,
misleading documentation, unsafe configuration, or missing helper — log it before
continuing:

```powershell
papercuts add "<what happened and what would have prevented it>" --tag <area>
```

Do not stop working to resolve the report. Use `minor` (the default) for annoyances,
`major` for significant time loss, and `blocker` for hard walls. Run `papercuts schema`
when the full command contract is needed.

Periodically review reports with:

```powershell
papercuts list --format md
```

## Roadmap QA checklists

For every implemented roadmap OpenSpec change (`EH-xxx`), create or update
`QA/eh-xxx/checklist.md` before claiming the implementation is complete,
updating the roadmap to done, or closing its GitHub issue. Invoke the
`roadmap-qa-checklists` skill when the work starts or when its scope changes.

Write the manual section for a tester using product interfaces: include
preconditions, safe test data, numbered actions, and observable expected
results. Put database, migration, concurrency, and other non-UI assertions in
a separate developer-evidence section. Do not mark an unavailable interface as
tested; state the limitation and the evidence required instead.

## Registry and biomarker documentation synchronization

Whenever a change touches the Registry, biomarker catalog, aliases, resolver,
units, corpus, assessment bindings, Health Profile laboratory projection,
biomarker persistence/reprocessing, related migrations/RPCs, or Registry CI,
invoke the `registry-documentation-sync` skill.

This is a completion gate, not optional follow-up work. Before declaring the
change complete:

1. Update or intentionally confirm the affected canonical `docs/` pages.
2. Regenerate and verify the generated documentation:
   `pnpm generate:biomarker-docs`, `pnpm check:biomarker-docs`, and
   `pnpm test:biomarker-docs`.
3. Regenerate and review the Wiki mirror with
   `pnpm render:biomarker-wiki` and the explicit local staging export. Confirm
   remote Wiki publication, or record `PENDING`/`BLOCKED` with evidence; a local
   render is not a published Wiki update.
4. Create or update exactly one matching GitHub tracking issue using
   `.github/ISSUE_TEMPLATE/registry-documentation-update.md`. The issue is an
   index and status record, not a copy of the catalog.
5. Link canonical docs, Wiki status, commands, verification results, and
   remaining gaps. Never describe unavailable or planned Registry behavior as
   implemented.

If remote Wiki or GitHub access is unavailable, finish all local work but do not
silently skip the publication/issue gate or claim completion. Leave the exact
handoff and blocker in the tracking record.
