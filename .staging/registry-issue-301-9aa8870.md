## Change summary

- Source change / PR / commit: `eh-171-guest-mode` / `9aa8870` (`fix: close guest release and mutation races`); no PR is open yet.
- Affected surfaces: guest-owned document and biomarker persistence/reprocessing boundaries, deletion-worker cleanup, guest write fences, activity refresh on product mutations, conversion consent-version enforcement, and authorization guards.
- Contract or count delta: no Registry definition, alias, unit, resolver, assessment-binding, corpus, or catalog-count change. The generated Registry snapshot remains 113 definitions, 83 analytes, and 637 aliases.

## Canonical documentation

- [x] `docs/03-modules/biomarkers.md` reviewed/confirmed unchanged; this change does not alter Registry lifecycle semantics.
- [x] `docs/05-data/biomarker-catalog.md` reviewed/confirmed unchanged; no definition or catalog delta.
- [x] `docs/05-data/biomarker-aliases.md` reviewed/confirmed unchanged; no alias delta.
- [x] `docs/05-data/biomarker-corpus-evidence.md` reviewed/confirmed unchanged; no corpus delta.
- [x] `docs/README.md` generated section remains current; the guest release guide is linked.

Links:

- Module lifecycle: https://github.com/Hazyshades/EasyHealth/blob/master/docs/03-modules/biomarkers.md
- Definition catalog: https://github.com/Hazyshades/EasyHealth/blob/master/docs/05-data/biomarker-catalog.md
- Alias reference: https://github.com/Hazyshades/EasyHealth/blob/master/docs/05-data/biomarker-aliases.md
- Corpus evidence: https://github.com/Hazyshades/EasyHealth/blob/master/docs/05-data/biomarker-corpus-evidence.md
- Guest release guide: https://github.com/Hazyshades/EasyHealth/blob/9aa8870/docs/guest-mode.md

## Wiki mirror

- Status: `PUBLISHED` based on the last successful remote probe at `7894981233cfda7e2ed053f6deb9bad41b959cfb`; generated output remains unchanged.
- Current recheck: `BLOCKED` because `git ls-remote https://github.com/Hazyshades/EasyHealth.wiki.git` failed with `Could not resolve host: github.com` in this environment. No publication change was attempted.
- Local staging reviewed at `.staging/registry-wiki-9451b27-guest111/` (7 generated pages).
- Wiki links: https://github.com/Hazyshades/EasyHealth/wiki/Home and generated Registry pages linked from that page.

## Regeneration and verification

```text
corepack pnpm generate:biomarker-docs
corepack pnpm check:biomarker-docs
corepack pnpm test:biomarker-docs
corepack pnpm render:biomarker-wiki
corepack pnpm export:biomarker-wiki -- --output=.staging/registry-wiki-9451b27-guest111
```

Additional checks:

- [x] Typecheck: `corepack pnpm exec tsc --noEmit`; `corepack pnpm --dir worker exec tsc --noEmit`.
- [x] Relevant Registry/runtime checks: biomarker documentation checks passed; guest pure verifier, onboarding verifier, app navigation verifier, direct Next build, and OpenSpec validation passed.
- [x] Hosted Supabase evidence: migrations 107–110 were applied manually; guest ticket, write-fence, deletion idempotence/TTL, expired activity, and eligible conversion transaction smokes passed with rollback cleanup.
- [ ] `111_guest_activity_and_consent.sql` hosted application and smoke are pending because the Supabase dashboard session expired before the forward migration could be applied.
- [x] Environment-dependent blockers recorded explicitly.

## Remaining gaps and follow-up

- Guest Auth/Storage/worker end-to-end evidence, direct API authorization/quota/deletion evidence, and database purge evidence require the hosted/private-beta smoke and remain pending in the guest-mode QA checklist.
- Migration history still ends at version `100`; manually applied guest SQL is not migration-history reconciliation. Migration 111 is source-only until applied deliberately.
- Public provider-token abuse control and Google OAuth are unavailable; legal approval flags remain false because repository legal pages contain placeholders. The private beta is explicitly access-limited and is not public abuse protection.
- This issue tracks the Registry-facing persistence/reprocessing boundary only; it does not claim new Registry behavior.