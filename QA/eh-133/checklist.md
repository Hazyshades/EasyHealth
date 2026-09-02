# EH-133: Define version-controlled Knowledge Base content schema

**Roadmap status:** In progress
**Build / environment:** EH-133 implementation on PR #226; focused EH-133/EH-134 verification, project typechecks, Registry documentation checks, CI coverage checks, OpenSpec validation, and production build
**Test run date:** 2026-09-01
**Tester:** Engineering verification

## What this checklist covers

This checklist covers the shared, version-controlled Knowledge Base article contract. It verifies that measurement and panel records use one strict typed boundary, reference Registry subjects without copying Registry or assessment data, require review/source evidence before publication, and remain separate from private observations.

EH-133 adds no editor, CMS, database table, public article corpus, or new user-facing route. The production catalog remains empty until EH-136 supplies reviewed measurement content. Internal schema and loader behavior belongs in developer evidence; it must not be represented as an executed UI pass.

## Before you start

- [x] Use only synthetic in-memory article records and Registry keys.
- [x] Do not use real patient data, profile identifiers, observation identifiers, or document identifiers.
- [x] Confirm the EH-134 baseline is present in the checkout before running the EH-133 verifier.
- [ ] Confirm a reviewed published article record is available. This remains intentionally unavailable until EH-136.

## Test data

| ID                     | Test record or setup                                                                                                              | Purpose                                        |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `EH133-MEASUREMENT-01` | Synthetic published `measurement` record for `hemoglobin_whole_blood` in `scripts/verify-eh133-knowledge-base.ts`                 | Canonical measurement contract                 |
| `EH133-PANEL-01`       | Synthetic published `panel` record for `cbc` in `scripts/verify-eh133-knowledge-base.ts`                                          | Panel discriminator and Panel Registry subject |
| `EH133-LIFECYCLE-01`   | Synthetic draft, in-review, and deprecated records                                                                                | Published-reader withholding                   |
| `EH133-INVALID-01`     | Synthetic HTTP source, unknown/provisional subject, duplicate identity, unsupported private field, and mismatched subject records | Fail-closed validation                         |

## Interface checks

### EH133-UI-01: Article and publishing UI availability

**Precondition:** EH-133 introduces no editor, publication screen, or new article route, and EH-136 has not supplied a published article corpus.

1. Do not use a product screen to infer that the internal schema is valid.
2. Do not mark an article page as passed when no reviewed record is available.
3. Use the developer evidence below for contract verification.

**Expected result:** `N/A` for UI execution. No unavailable interface is claimed as tested. A future tester needs a reviewed EH-136 article fixture and an authenticated app session before validating article rendering or publishing behavior.

**Result:** `N/A` — no EH-133 user interface exists in this change.
**Notes / evidence link:** `src/lib/knowledge-base/knowledge-base-articles.ts`; `scripts/verify-eh133-knowledge-base.ts`

## Developer evidence required

- [x] `pnpm test:eh133` passes the measurement/panel schema, exact-locale lookup, lifecycle filtering, Registry validation, source safety, duplicate identity, deprecation, private-field rejection, deterministic ordering, and empty-catalog checks.
- [x] `pnpm test:eh134` remains green as the compatibility contract for the merged EH-134 measurement article route and result separation.
- [x] `pnpm typecheck` passes the shared types, catalogs, verifier, and exports.
- [x] `openspec validate eh-133-define-versioned-knowledge-base-content --strict` passes.
- [x] `pnpm generate:biomarker-docs`, `pnpm check:biomarker-docs`, and `pnpm test:biomarker-docs` pass; canonical Registry docs remain intentionally unchanged because this is a consumer-only Registry read.
- [x] `pnpm render:biomarker-wiki` and the explicit local staging export complete; remote Wiki publication status is recorded in Registry issue #225.
- [x] Database regression coverage is `N/A`: EH-133 adds no migration, persistence, RPC, authorization, or user-data projection.
- [x] No downstream EH-135/EH-136/EH-139 article shape is present in this checkout; the shared contract and issue #225 require migration through it or one explicit adapter before merge.

## Out of scope or not manually testable yet

- EH-136 reviewed article publication and matching authenticated observations are required for visible measurement education, **Your results**, and source-document navigation flows.
- EH-135 panel page/CBC UI, EH-138 index/search, EH-139 publication/staleness workflow, and EH-140 safety/accessibility review are separate roadmap work.
- No database migration, CMS/editor workflow, or public unauthenticated Knowledge Base route is introduced here.
- A local contract verifier is evidence for internal behavior; it is not a substitute for a future authenticated UI test with synthetic fixtures.
