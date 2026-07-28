# EH-109: Resolver evidence engine

**Roadmap status:** Planned
**Build / environment:** `________`
**Test run date:** `________`
**Tester:** `________`

## What this checklist covers

EH-109 makes laboratory mapping decisions explainable from source evidence instead of simple string matching. A tester can confirm that raw results remain visible and that incomplete mappings are not presented as concrete biomarker bindings; scoring weights, conflicts, tie policy, and revision persistence require developer evidence.

## Before you start

- [ ] Use a dedicated test account.
- [ ] Use only synthetic or de-identified documents.
- [ ] Confirm the listed test data has finished processing.
- [ ] Confirm EH-110 alias authority has been deployed to the same test environment.

## Test data

| ID | Test document or setup | Purpose |
| --- | --- | --- |
| `EH109-RESOLVED-01` | Synthetic/de-identified laboratory row with an active reviewed alias and complete compatible unit, specimen, value kind, timing, and method evidence. | Normal reviewed concrete mapping. |
| `EH109-PARTIAL-01` | Synthetic/de-identified row with a recognized alias but missing required specimen, timing, method, or value-kind evidence. | Safe incomplete mapping. |
| `EH109-CONFLICT-01` | Synthetic/de-identified row with a reviewed alias but an incompatible unit, specimen, or value kind. | Explicit conflict protection. |
| `EH109-AMBIGUOUS-01` | Synthetic/de-identified row admitting two reviewed candidates whose scores differ by fewer than eight points. | Deterministic no-winner behavior. |

## Interface checks

### EH109-UI-01: Complete evidence produces a concrete mapping

**Precondition:** EH-109 is implemented and `EH109-RESOLVED-01` has completed processing.

1. Go to **Documents**.
2. Open the document containing `EH109-RESOLVED-01`.
3. Open the extracted laboratory result.
4. Review the displayed mapping status and selected biomarker name.

**Expected result:** The result displays one reviewed concrete mapping. The raw label, value, unit, and source context remain available for review.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

### EH109-UI-02: Missing or conflicting evidence remains safe and visible

**Precondition:** EH-109 is implemented and `EH109-PARTIAL-01` and `EH109-CONFLICT-01` have completed processing.

1. Go to **Documents**.
2. Open the document containing `EH109-PARTIAL-01` and inspect the extracted result.
3. Open the document containing `EH109-CONFLICT-01` and inspect the extracted result.
4. Confirm each raw result is still visible and inspect the mapping status.

**Expected result:** Neither result is presented as a reviewed concrete biomarker binding. The product uses its existing incomplete-mapping wording and preserves the extracted label/value/unit rather than dropping the row.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

### EH109-UI-03: Close candidates do not select an arbitrary mapping

**Precondition:** EH-109 is implemented and `EH109-AMBIGUOUS-01` has completed processing.

1. Go to **Documents**.
2. Open the document containing `EH109-AMBIGUOUS-01`.
3. Open the extracted laboratory result and inspect its mapping status.

**Expected result:** The raw result remains visible with the existing ambiguous-mapping wording. No single reviewed concrete biomarker is shown as selected.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

## Developer evidence required

- [ ] Pure resolver tests prove the `evidence-1` weights, 70-point eligibility threshold, eight-point margin rule, stable candidate ordering, and every four-state outcome. Provided by CI.
- [ ] Compatibility tests prove stated unit, specimen, value-kind, timing, method, and required-modifier mismatches are hard conflicts; missing axes are recorded without inference. Provided by CI.
- [ ] Writer and database tests prove the typed decision envelope and evidence-policy version are persisted atomically with the active normalization revision, while historic revisions are not rewritten. Provided by CI.
- [ ] Hash/idempotency tests prove timing, method, laboratory, reference shape, value kind, and policy version affect normalization identity. Provided by CI.
- [ ] DTO/API tests prove the active revision exposes policy version, ordered candidate evidence, alias provenance, score, confidence, missing axes, conflicts, and selected decision fields. Provided by the implementing engineer and CI.
- [ ] Focused biomarker, writer/database, and CBC regression commands pass on the implementation commit. Provided by CI or the implementing engineer.

## Out of scope or not manually testable yet

- Candidate weights, hard-conflict evaluation, confidence calculation, tie margin, alias provenance, policy-version persistence, atomic revision promotion, and hash behavior are not safely verifiable through product screens; they require the developer evidence above.
- Existing incomplete-state UI wording is a read-only regression boundary here. EH-112 owns expanded consumer behavior, trends, scoring exclusion, metrics, and reprocessability.
- EH-111 compatibility corpus, EH-113/EH-114 clinical case packs, EH-115 decision traces, and EH-116 reprocessing are out of scope.
- This checklist is planned evidence only. No interface check is marked as executed until EH-109 is implemented in a test environment.