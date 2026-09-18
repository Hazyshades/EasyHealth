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
| `EH150-SAFETY-01` | Fixture containing diagnosis, treatment, urgency, imperative, and unsupported free-form factual fields plus a non-factual question | Unsafe-content path |
| `EH150-TEMPLATE-01` | Fixture with model-authored factual text, unknown template ID/parameter, and a removed claim | Closed template contract |
| `EH150-VERSION-01` | Current, recognized historical, missing, unknown, and retired validator-version envelopes | Version compatibility |

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

- [ ] Validator fixtures cover valid, missing, unknown, broken, out-of-scope, cross-profile, archived/removed active-document sources, tombstoned source documents, and uncited claims. *(Evidence provider: EH-150 validator owner; EH-148 read-resolver owner.)*
- [ ] Identity failures (unknown/broken/cross-profile/out-of-scope/source-kind) return `invalid` and block persistence; uncited or unsafe-but-in-scope claims are removed or limited only through the documented deterministic issue policy. *(Evidence provider: EH-150 validator owner; EH-148 report owner.)*
- [ ] Generation, share, and export paths consume the same validator result/status and do not duplicate checks. *(Evidence provider: EH-148 generation owner; EH-151 share owner; EH-153 export owner.)*
- [ ] Logs and errors contain issue codes/request IDs only, not source text, health values, tokens, or PINs. *(Evidence provider: EH-150 validator owner; EH-154 gate owner.)*
- [ ] Adversarial unsafe-content fixtures fail closed for prohibited diagnosis/treatment/urgency/imperative/free-form factual fields, while non-factual `clinician_question` content remains non-factual. *(Evidence provider: EH-150 validator owner; EH-148 safety-policy owner.)*
- [ ] Read-time lifecycle status is supplied by EH-148's resolver: archived/removed source rows under active documents become `SOURCE_UNAVAILABLE` limited snapshots, while a tombstoned source document invalidates the complete report before owner/share/export bytes; EH-150 does not authorize live/raw-source access from a historical snapshot. *(Evidence provider: EH-148 read-resolver owner; EH-150 validator owner.)*
- [ ] Closed-template evidence proves factual input contains only approved template IDs/parameters, server-rendered text is derived from cited snapshots, and removed claims are absent from persistence and all export formats. *(Evidence provider: EH-148 contract/safety owner; EH-150 validator owner; EH-153 serializer owner.)*
- [ ] Validator-version evidence proves new reports persist `eh150.v1`, recognized historical versions remain readable only while listed by EH-150, and missing/unknown/retired versions fail closed across owner/share/export reads. *(Evidence provider: EH-150 version-policy owner; EH-148 read-resolver owner; EH-151 share owner; EH-153 export owner.)*

## Out of scope or not manually testable yet

- The validator does not prove that a cited medical value is clinically correct.
- Share-token behavior is covered by EH-151/EH-154; export formatting is covered by EH-153.
- Until the implementation exists, interface rows remain `N/A`, not `Pass`.
