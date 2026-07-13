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
