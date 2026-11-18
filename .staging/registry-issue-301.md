## Change summary

- Source change / PR / commit: `eh-171-guest-mode` / `ff12445` (`feat: add guest mode and private beta controls`); no PR is open yet.
- Affected surfaces: persistence, migrations/RPCs, guest-owned document and biomarker reprocessing boundaries, deletion-worker cleanup, and authorization guards.
- Contract or count delta: no Registry definition, alias, unit, resolver, assessment-binding, corpus, or catalog-count change. The generated Registry snapshot remains 113 definitions, 83 analytes, and 637 aliases.

## Canonical documentation

- [x] `docs/03-modules/biomarkers.md` reviewed/confirmed unchanged; this change does not alter Registry lifecycle semantics.
- [x] `docs/05-data/biomarker-catalog.md` reviewed/confirmed unchanged; no definition or catalog delta.
- [x] `docs/05-data/biomarker-aliases.md` reviewed/confirmed unchanged; no alias delta.
- [x] `docs/05-data/biomarker-corpus-evidence.md` reviewed/confirmed unchanged; no corpus delta.
- [x] `docs/README.md` reviewed/updated: added the guest release-guide link; the generated Registry managed section is current.

Links:

- Module lifecycle: https://github.com/Hazyshades/EasyHealth/blob/master/docs/03-modules/biomarkers.md
- Definition catalog: https://github.com/Hazyshades/EasyHealth/blob/master/docs/05-data/biomarker-catalog.md
- Alias reference: https://github.com/Hazyshades/EasyHealth/blob/master/docs/05-data/biomarker-aliases.md
- Corpus evidence: https://github.com/Hazyshades/EasyHealth/blob/master/docs/05-data/biomarker-corpus-evidence.md
- Guest release guide: https://github.com/Hazyshades/EasyHealth/blob/ff12445/docs/guest-mode.md

## Wiki mirror

- Status: `PUBLISHED` based on the last successful remote probe at `7894981233cfda7e2ed053f6deb9bad41b959cfb`; generated output remains unchanged.
- Current recheck: `BLOCKED` because `git ls-remote https://github.com/Hazyshades/EasyHealth.wiki.git` failed with `Could not resolve host: github.com` in this environment. No publication change was attempted.
- Local staging reviewed at `.staging/registry-wiki-ff12445/` (7 generated pages).
- Wiki links: https://github.com/Hazyshades/EasyHealth/wiki/Home and generated Registry pages linked from that page.

## Regeneration and verification

```text
corepack pnpm generate:biomarker-docs
corepack pnpm check:biomarker-docs
corepack pnpm test:biomarker-docs
corepack pnpm render:biomarker-wiki
corepack pnpm export:biomarker-wiki -- --output=.staging/registry-wiki-ff12445
```

Additional checks:

- [x] Typecheck: `corepack pnpm exec tsc --noEmit`; `corepack pnpm --dir worker exec tsc --noEmit`.
- [x] Relevant Registry/runtime checks: biomarker documentation checks passed; guest pure verifier, app navigation verifier, worker reliability verifier, and direct Next build passed.
- [ ] Relevant database/migration checks: blocked because the Supabase CLI and Docker/local Postgres are unavailable; hosted Supabase evidence for the guest objects is recorded in `docs/guest-mode.md` and `QA/guest-mode/checklist.md`.
- [x] Environment-dependent blockers recorded explicitly.

## Remaining gaps and follow-up

- Guest Auth/Storage/worker end-to-end evidence, direct API authorization/quota/deletion evidence, and database purge evidence require the hosted/private-beta smoke and remain pending in the guest-mode QA checklist.
- This issue tracks the Registry-facing persistence/reprocessing boundary only; it does not claim new Registry behavior.
