## Change summary

- Source change / PR / commit: `eh-171-guest-mode` / `d778f2c`
- Affected surfaces: guest persistence and RPC migration, profile consent audit fields, durable upload quota reservations, generated-document synchronization gate
- Contract or count delta: no Registry definition, alias, unit, resolver, assessment-binding, corpus, or catalog-count delta; generated canonical pages remain current

## Canonical documentation

- [x] `docs/03-modules/biomarkers.md` reviewed/unchanged
- [x] `docs/05-data/biomarker-catalog.md` reviewed/unchanged
- [x] `docs/05-data/biomarker-aliases.md` reviewed/unchanged
- [x] `docs/05-data/biomarker-corpus-evidence.md` reviewed/unchanged
- [x] `docs/README.md` reviewed/unchanged

Links:

- Module lifecycle: https://github.com/Hazyshades/EasyHealth/blob/d778f2c/docs/03-modules/biomarkers.md
- Definition catalog: https://github.com/Hazyshades/EasyHealth/blob/d778f2c/docs/05-data/biomarker-catalog.md
- Alias reference: https://github.com/Hazyshades/EasyHealth/blob/d778f2c/docs/05-data/biomarker-aliases.md
- Corpus evidence: https://github.com/Hazyshades/EasyHealth/blob/d778f2c/docs/05-data/biomarker-corpus-evidence.md
- Guest release evidence: https://github.com/Hazyshades/EasyHealth/blob/d778f2c/docs/guest-mode.md

## Wiki mirror

- Status: `PUBLISHED`
- Local staging or publication evidence: `.staging/registry-wiki-d778f2c-guest111privacy`; `git ls-remote https://github.com/Hazyshades/EasyHealth.wiki.git` returned published HEAD `7894981233cfda7e2ed053f6deb9bad41b959cfb`; generated staging files match the checkout hashes and the published Wiki checkout is at that HEAD
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
corepack pnpm export:biomarker-wiki -- --output=.staging/registry-wiki-d778f2c-guest111privacy PASS
```

Additional checks:

- [x] `corepack pnpm exec next build`
- [x] Guest lifecycle, onboarding, navigation, and closed-beta verifiers
- [ ] Hosted migration 111/application smoke: BLOCKED because the Supabase dashboard session expired; local DB test is also blocked by unavailable Supabase CLI/Docker/local Postgres
- [x] Unavailable environment-dependent blockers recorded in `docs/guest-mode.md` and `QA/guest-mode/checklist.md`

## Remaining gaps and follow-up

- Migration 111 is source-only until a maintainer re-authenticates to Supabase and applies it. Do not deploy the guest web branch before that migration is hosted-applied.
- Railway cannot currently select the pushed `Hazyshades/EasyHealth` branch through its GitHub App integration; no EH-171 web deployment or guest browser smoke is claimed.
- This issue is the synchronization index; there is no Registry catalog or alias work to schedule.
