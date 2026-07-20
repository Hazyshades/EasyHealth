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
