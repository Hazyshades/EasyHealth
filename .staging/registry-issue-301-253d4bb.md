## Change summary

- Source change / PR / commit: `eh-171-guest-mode` / `253d4bb`
- Affected surfaces: guest persistence and RPC migration, profile consent audit fields, durable upload quota reservation attachment/reconciliation, guest processing quotas, deletion-race fencing, generated-document synchronization gate
- Contract or count delta: no Registry definition, alias, unit, resolver, assessment-binding, corpus, or catalog-count delta; generated canonical pages remain current

## Canonical documentation

- [x] `docs/03-modules/biomarkers.md` reviewed/unchanged
- [x] `docs/05-data/biomarker-catalog.md` reviewed/unchanged
- [x] `docs/05-data/biomarker-aliases.md` reviewed/unchanged
- [x] `docs/05-data/biomarker-corpus-evidence.md` reviewed/unchanged
- [x] `docs/README.md` reviewed/unchanged

Links:

- Module lifecycle: https://github.com/Hazyshades/EasyHealth/blob/253d4bb/docs/03-modules/biomarkers.md
- Definition catalog: https://github.com/Hazyshades/EasyHealth/blob/253d4bb/docs/05-data/biomarker-catalog.md
- Alias reference: https://github.com/Hazyshades/EasyHealth/blob/253d4bb/docs/05-data/biomarker-aliases.md
- Corpus evidence: https://github.com/Hazyshades/EasyHealth/blob/253d4bb/docs/05-data/biomarker-corpus-evidence.md
- Guest release evidence: https://github.com/Hazyshades/EasyHealth/blob/253d4bb/docs/guest-mode.md

## Wiki mirror

- Status: `PUBLISHED`
- Local staging or publication evidence: `.staging/registry-wiki-594d48e-guest111races`; `git ls-remote https://github.com/Hazyshades/EasyHealth.wiki.git` returned published HEAD `7894981233cfda7e2ed053f6deb9bad41b959cfb`; all seven generated staging file hashes match the published Wiki checkout at that HEAD. The final `253d4bb` change is application-only and does not alter generated Registry content.
- Wiki links:
  - https://github.com/Hazyshades/EasyHealth/wiki/Biomarker-Architecture
  - https://github.com/Hazyshades/EasyHealth/wiki/Biomarker-Catalog
  - https://github.com/Hazyshades/EasyHealth/wiki/Biomarker-Aliases
  - https://github.com/Hazyshades/EasyHealth/wiki/Biomarker-Corpus-Evidence

## Regeneration and verification

```text
corepack pnpm generate:biomarker-docs   PASS
corepack pnpm check:biomarker-docs      PASS
corepack pnpm test:biomarker-docs       PASS
corepack pnpm render:biomarker-wiki     PASS
corepack pnpm export:biomarker-wiki -- --output=.staging/registry-wiki-594d48e-guest111races PASS
```

Additional checks:

- [x] `corepack pnpm exec next build` (also passes after `253d4bb`)
- [x] Guest lifecycle, onboarding, navigation, closed-beta, assistant/recalculation quota, and worker verifiers/typechecks
- [ ] Hosted migration 111/application smoke: BLOCKED because the Supabase dashboard session expired; local DB test is also blocked by unavailable Supabase CLI/Docker/local Postgres
- [x] Unavailable environment-dependent blockers recorded in `docs/guest-mode.md` and `QA/eh-171/checklist.md`

## Remaining gaps and follow-up

- Migration 111 is source-only until a maintainer re-authenticates to Supabase and applies it. Do not deploy the guest web branch before that migration is hosted-applied.
- Railway cannot currently select the pushed `Hazyshades/EasyHealth` branch through its GitHub App integration; no EH-171 web deployment or guest browser smoke is claimed.
- This issue is the synchronization index; there is no Registry catalog or alias work to schedule.
