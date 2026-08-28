---
name: Registry documentation update
about: Track synchronized Registry, biomarker documentation, Wiki, and catalog updates
title: "[Registry Docs] "
labels: documentation, biomarkers
---

## Change summary

<!-- Keep this concise. This issue is an index/tracking record, not a catalog dump. -->

- Source change / PR / commit:
- Affected surfaces: <!-- definitions, aliases, units, resolver, bindings, Health Profile, persistence, corpus, CI -->
- Contract or count delta:

## Canonical documentation

- [ ] `docs/03-modules/biomarkers.md` reviewed/updated
- [ ] `docs/05-data/biomarker-catalog.md` reviewed/updated
- [ ] `docs/05-data/biomarker-aliases.md` reviewed/updated
- [ ] `docs/05-data/biomarker-corpus-evidence.md` reviewed/updated
- [ ] `docs/README.md` reviewed/updated

Links:

- Module lifecycle:
- Definition catalog:
- Alias reference:
- Corpus evidence:

## Wiki mirror

- Status: `PENDING` / `PUBLISHED` / `BLOCKED`
- Local staging or publication evidence:
- Wiki links:

## Regeneration and verification

```text
pnpm generate:biomarker-docs
pnpm check:biomarker-docs
pnpm test:biomarker-docs
pnpm render:biomarker-wiki
pnpm export:biomarker-wiki -- --output=<empty-local-staging-dir>
```

Additional checks:

- [ ] Typecheck
- [ ] Relevant Registry/runtime checks
- [ ] Relevant database/migration checks
- [ ] Environment-dependent blockers recorded explicitly

## Remaining gaps and follow-up

<!-- Name deferred behavior, owner, and next action. Do not describe planned behavior as implemented. -->
<!-- This issue is an index, not a product feature. Wiki PENDING from `gh repo view …wiki` GraphQL failure is an ops tail — probe with git ls-remote on EasyHealth.wiki.git. Do not schedule that leftover as the next sprint. -->

-
