# EH-110: Alias authority and lifecycle

**Roadmap status:** Planned
**Build / environment:** `________`
**Test run date:** `________`
**Tester:** `________`

## What this checklist covers

EH-110 makes Registry 2.0 alias matching auditable and safe. It changes internal catalog authority, lifecycle, corpus ownership, and manifest behavior; it does not introduce a tester-facing alias-management screen.

## Before you start

- [ ] Use a dedicated test account.
- [ ] Use only synthetic or de-identified documents.
- [ ] Confirm the listed test data has finished processing, unless the check intentionally tests processing.

## Test data

| ID | Test document or setup | Purpose |
| --- | --- | --- |
| `EH110-FIXTURE-01` | A synthetic/de-identified laboratory result whose label is an active reviewed global alias. | Normal Registry 2.0 recognition path after implementation. |
| `EH110-FIXTURE-02` | A synthetic/de-identified result using a deprecated, provisional, foreign-laboratory, fixture-only, unapproved-fuzzy, or over-distance alias. | Negative authority evidence; no real patient data. |

## Interface checks

### EH110-UI-01: No fabricated concrete mapping from a disallowed alias

**Precondition:** EH-110 is implemented, the test environment includes the approved negative-authority fixture, and the document has been processed.

1. Go to **Documents**.
2. Open the document containing `EH110-FIXTURE-02`.
3. Open the extracted laboratory result and inspect its mapping status.
4. Compare the displayed raw label with the mapping state.

**Expected result:** The raw result remains visible. It does not display a reviewed concrete biomarker binding solely because of the deprecated, provisional, foreign-laboratory, fixture-only, or unsupported fuzzy alias. Any incomplete state uses the product's existing mapping-status wording.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

## Developer evidence required

- [ ] Registry catalog validation proves every admitted alias has stable identity, provenance, required fixture references, and a valid authority/lifecycle combination. Provided by the implementing engineer through focused Registry 2.0 tests.
- [ ] Alias-admission tests prove exact, normalized, explicit OCR, laboratory-scoped, and bounded-fuzzy policies; they also prove every negative-authority case is not admitted for reviewed resolution. Provided by CI.
- [ ] Release-manifest tests prove the digest serializes alias key, source, authority, approval, lifecycle, scope, provenance, review reference, and fixture ownership, and that policy changes receive the required classification. Provided by CI.
- [ ] Launch-corpus descriptor review identifies the de-identified fixture owner and reviewer reference for every reviewed/bounded-fuzzy alias. Provided by the registry release owner.
- [ ] Focused biomarker and CBC regression commands pass on the implementation commit. Provided by CI or the implementing engineer.

## Out of scope or not manually testable yet

- Alias lifecycle transitions, source scope, fuzzy-distance bounds, corpus ownership, deterministic manifest content, and static removal of legacy matching are not manually testable through the product UI. They require the developer evidence above.
- EH-109 evidence scoring, EH-111 compatibility rules, EH-112 consumer behavior, EH-115 decision traces, and EH-116 reprocessing are out of scope.
- This checklist is planned evidence only. No interface check is marked as executed until EH-110 is implemented in a test environment.