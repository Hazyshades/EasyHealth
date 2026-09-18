# EH-150: Report Citation Validator

**Roadmap status:** Planned
**Build / environment:** `________`
**Test run date:** `________`
**Tester:** `________`

## What this checklist covers

This checklist covers the report publication gate that validates source identity, profile ownership, report scope, claim support, and safe sanitization. The validator is an internal contract and is not a substitute for clinical fact checking.

## Before you start

- [ ] Use a dedicated test account.
- [ ] Use only synthetic or de-identified documents.
- [ ] Confirm the listed test data has finished processing, unless the check intentionally tests processing.

## Test data

| ID | Test document or setup | Purpose |
| --- | --- | --- |
| `EH150-VALID-01` | Validated brief whose claims cite same-profile in-scope sources | Valid path |
| `EH150-UNCITED-01` | Generator fixture with one factual claim and no citation | Unsupported claim |
| `EH150-BROKEN-01` | Fixture with unknown source ID and out-of-scope document ID | Broken/scope path |
| `EH150-CROSS-01` | Two synthetic profiles with a source row owned by profile B | Isolation path |

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

**Expected result:** The unsupported factual sentence is absent from publishable content and an explicit limitation is shown. The raw model output is not exposed.

**Result:** `N/A`
**Notes / evidence link:** `Internal validator; execute only after the fixture hook is available.`

## Developer evidence required

- [ ] Validator fixtures cover valid, missing, unknown, broken, out-of-scope, cross-profile, archived, and uncited claims.
- [ ] A cross-profile citation fails closed without revealing the other profile's source data.
- [ ] A broken factual claim is removed or marked only through the documented deterministic issue policy.
- [ ] Generation, share, and export paths consume the same validator result/status and do not duplicate checks.
- [ ] Logs and errors contain issue codes/request IDs only, not source text, health values, tokens, or PINs.

## Out of scope or not manually testable yet

- The validator does not prove that a cited medical value is clinically correct.
- Share-token behavior is covered by EH-151/EH-154; export formatting is covered by EH-153.
- Until the implementation exists, interface rows remain `N/A`, not `Pass`.
