# EH-150: Report Citation Validator

**Roadmap status:** Implemented validator; EH-148 integration and manual report UI QA pending
**Build / environment:** Local worktree with pnpm; Supabase CLI/Docker present but `supabase_db_easyhealth` exited
**Test run date:** `2026-09-23`
**Tester:** Automated developer evidence; manual tester unassigned

## What this checklist covers

This checklist covers the report publication gate that validates source identity, profile ownership, report scope, claim support, and safe sanitization. The validator is an internal contract and is not a substitute for clinical fact checking.

## Before you start

- [ ] Use a dedicated test account.
- [ ] Use only synthetic or de-identified documents.
- [ ] Confirm the listed test data has finished processing, unless the check intentionally tests processing.

Developer-only execution used in-memory synthetic fixtures; no account, document upload, or database fixture is required for the EH-150 pure validator.

## Test data

| ID                  | Test document or setup                                                                                                             | Purpose                  |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| `EH150-VALID-01`    | Validated brief whose claims cite same-profile in-scope sources                                                                    | Valid path               |
| `EH150-UNCITED-01`  | Generator fixture with one factual claim and no citation                                                                           | Unsupported claim        |
| `EH150-BROKEN-01`   | Fixture with unknown source ID and out-of-scope document ID                                                                        | Broken/scope path        |
| `EH150-CROSS-01`    | Two synthetic profiles with a source row owned by profile B                                                                        | Isolation path           |
| `EH150-SAFETY-01`   | Fixture containing diagnosis, treatment, urgency, imperative, and unsupported free-form factual fields plus a non-factual question | Unsafe-content path      |
| `EH150-TEMPLATE-01` | Fixture with model-authored factual text, unknown template ID/parameter, and a removed claim                                       | Closed template contract |
| `EH150-VERSION-01`  | Current, recognized historical, missing, unknown, and retired validator-version envelopes                                          | Version compatibility    |

## Interface checks

EH-150 has no standalone user interface. The following checks are not manually executable until report generation exposes the validator result through the report detail surface; the developer evidence below is mandatory.

### EH150-UI-01: Display a valid citation ledger

**Precondition:** EH-148 has delivered a report detail view and `EH150-VALID-01` is persisted.

1. Open the report detail page.
2. Inspect a factual claim and its source ledger entry.

**Expected result:** The claim is visible with the expected same-profile source. No internal issue payload, token, or cross-profile metadata is shown.

**Result:** `N/A`
**Notes / evidence link:** `Internal validator; execute only after EH-148 report UI is available.`

### EH150-UI-02: Show a limitation instead of unsupported prose

**Precondition:** The generation fixture produces `EH150-UNCITED-01`.

1. Generate or load the fixture through the supported report path.
2. Inspect the affected section and limitations.

**Expected result:** The unsupported factual sentence and unsafe directive are absent from publishable content, an explicit limitation is shown, and the raw model output is not exposed. A non-factual question may remain only as a question.

**Result:** `N/A`
**Notes / evidence link:** `Internal validator; execute only after the fixture hook is available.`

## Developer evidence required

- [ ] Validator fixtures cover valid, missing, unknown, broken, out-of-scope, cross-profile, archived/removed active-document sources, tombstoned source documents, and uncited claims. _(PARTIAL: pure-validator fixtures pass; EH-148 read-resolver and durable persistence behavior remain a handoff.)_
- [x] Identity failures (unknown/broken/cross-profile/out-of-scope/source-kind) return `invalid` and block persistence; uncited or unsafe-but-in-scope claims are removed or limited only through the documented deterministic issue policy. _(Evidence: focused verifier passed; persistence is intentionally outside EH-150.)_
- [ ] Generation, share, and export paths consume the same validator result/status and do not duplicate checks. **BLOCKED:** EH-148 generation, EH-151 share, and EH-153 export adapters are separate owners and are not present in this change.
- [x] Logs and errors contain issue codes/request IDs only, not source text, health values, tokens, or PINs. _(Evidence: safe invalid-result and cross-profile assertions passed; validator output contains only stable codes and safe summaries.)_
- [x] Candidate contract versions, authorized source profile identity, and overview provenance fail closed: unsupported `eh148` revisions, missing resolver profile IDs, and candidate-supplied overview text return `SCHEMA_INVALID`/`SOURCE_NOT_FOUND`; valid output uses the injected server overview renderer, whose output is checked for unsafe Unicode. _(Evidence: focused verifier passed.)_
- [x] Authorized source projections require a source-row identity and closed document lifecycle; output snapshots come only from the authorized resolver. Non-factual clinician questions are NFC-normalized, unique, limited to five user-selected values, bounded by Unicode scalar count, and free of controls or line separators. _(Evidence: focused verifier passed.)_
- [x] Adversarial unsafe-content fixtures fail closed for prohibited diagnosis/treatment/urgency/imperative/free-form factual fields, while non-factual `clinician_question` content remains non-factual. _(Evidence: focused verifier passed with all unsafe-field markers absent.)_
- [x] Section-contract fixtures prove the EH-148 canonical six-section order, exactly one required container each, typed claim/limitation/source references bind one-to-one to the top-level collections, unknown/duplicate/missing/incompatible failures return `SCHEMA_INVALID`, and explicit allowed empty states carry visible limitations. _(Evidence: focused verifier passed.)_
- [ ] Read-time lifecycle status is supplied by EH-148's resolver after the committed `make-document-deletion-durable` tombstone state: archived/removed source rows under active documents become `SOURCE_UNAVAILABLE` limited snapshots, while a tombstoned source document invalidates the complete report before owner/share/export bytes; EH-150 does not authorize live/raw-source access from a historical snapshot. **PARTIAL:** pure-validator archived/tombstone fixtures pass; EH-148 resolver, durable deletion, and DB smoke evidence are unavailable (`supabase_db_easyhealth` exited).
- [ ] Closed-template evidence proves factual input contains only approved template IDs/parameters, server-rendered text is derived from cited snapshots, and removed claims are absent from persistence and all export formats. **PARTIAL:** EH-150 validates template IDs/parameters and removed-claim serialization; EH-148 renderer and EH-153 persistence/export evidence are pending.
- [ ] Validator-version evidence proves new reports persist `eh150.v1`, recognized historical versions remain readable only while listed by EH-150, and missing/unknown/retired versions fail closed across owner/share/export reads. **PARTIAL:** current, `eh150.v0`, missing, unknown, and retired envelope checks pass; owner/share/export read gates are pending.

## Executed evidence

- `pnpm exec tsx scripts/verify-eh150-report-citation-validator.ts` — PASS: all focused validator, sanitization, lifecycle, section, and version checks.
- `pnpm exec tsc --noEmit` — PASS.
- `pnpm exec prettier --check src/lib/report-citation-validator.ts scripts/verify-eh150-report-citation-validator.ts` — PASS.
- `openspec validate eh-150-report-citation-validator --type change --strict --no-interactive` — PASS: change is valid.
- `supabase status` / `supabase start` — BLOCKED: `supabase_db_easyhealth` is exited and the CLI reports an existing start already running. EH-150 is a pure resolver-injected module, so no database assertion is required for its focused verifier.

## Out of scope or not manually testable yet

- The validator does not prove that a cited medical value is clinically correct.
- Share-token behavior is covered by EH-151/EH-154; export formatting is covered by EH-153.
- EH-150 has no standalone user interface; interface rows remain `N/A`, not `Pass`, until EH-148 report generation/detail integration is available.
