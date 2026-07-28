# EH-109: Context-aware resolver evidence engine

**Roadmap status:** In progress
**Build / environment:** `________`
**Test run date:** `________`
**Tester:** `________`

## What this checklist covers

EH-109 makes the document review screen explain why a laboratory row was resolved, recognized but incomplete, ambiguous, or unmapped. It preserves the raw result when evidence is incomplete; it does not add health-profile scoring, trends, clinical interpretation, or reprocessing controls.

## Before you start

- [ ] Use a dedicated test account.
- [ ] Use only synthetic or de-identified documents.
- [ ] Confirm the supplied EH-109 test document has finished processing.
- [ ] Confirm the build includes the EH-110 alias authority contract and an EH-109 resolver version recorded by the delivery owner.

## Test data

| ID | Test document or setup | Purpose |
| --- | --- | --- |
| `EH109-RESOLVED-01` | Synthetic laboratory page with one reviewed alias, compatible numeric value, unit, and every required identity axis. | Unique reviewed mapping and technical trace. |
| `EH109-PARTIAL-01` | Synthetic laboratory page with an active recognized label and unit but an omitted required specimen, timing, method, modifier, or value kind. | Safe incomplete recognition. |
| `EH109-AMBIGUOUS-01` | Synthetic laboratory page intentionally matching two reviewed definitions without the configured score margin. | Ambiguous mapping is not arbitrarily selected. |
| `EH109-UNMAPPED-01` | Synthetic laboratory page containing an unknown label or an alias rejected by lifecycle/approval/laboratory attribution. | Safe unmapped and negative-authority behavior. |

## Interface checks

### EH109-UI-01: Reviewed row has an explainable resolved mapping

**Precondition:** `EH109-RESOLVED-01` is processed in the dedicated test account and appears in **Documents**.

1. Go to **Documents** and open `EH109-RESOLVED-01`.
2. Open the extracted biomarker row with the reviewed mapping.
3. Confirm the row shows a resolved mapping and a mapping-confidence band.
4. Expand **Technical details**.

**Expected result:** The row identifies one concrete measurement mapping. **Technical details** lists the selected candidate and its supporting evidence, shows no rejected evidence for the selected candidate, and identifies the active revision and catalog/resolver version. The mapping-confidence text describes classification evidence, not a medical result.

**Result:** `N/A — planned`
**Notes / evidence link:** `________`

### EH109-UI-02: Incomplete, ambiguous, and unmapped rows stay non-concrete

**Precondition:** `EH109-PARTIAL-01`, `EH109-AMBIGUOUS-01`, and `EH109-UNMAPPED-01` are processed in the dedicated test account.

1. Open each document from **Documents**.
2. For each extracted biomarker row, expand **Technical details**.
3. Compare the displayed mapping outcome with the test-data purpose.

**Expected result:** The partial row states that the measurement is recognized but details are pending and does not show a fabricated concrete identity. The ambiguous row states that its mapping is ambiguous and retains competing candidate evidence. The unmapped row states that it is unmapped and does not show a concrete measurement identity. All three rows retain their visible raw label, value, and unit for review.

**Result:** `N/A — planned`
**Notes / evidence link:** `________`

### EH109-UI-03: Review details remain understandable after a page reload

**Precondition:** Any one of the four EH-109 synthetic documents has completed processing.

1. Open the document in **Documents** and expand the row's **Technical details**.
2. Note the displayed outcome, candidate evidence, active revision, and catalog/resolver version.
3. Reload the page and reopen the same document and details.

**Expected result:** The displayed outcome and evidence are unchanged after reload. The page does not present incomplete or ambiguous evidence as a resolved concrete measurement.

**Result:** `N/A — planned`
**Notes / evidence link:** `________`

## Developer evidence required

- [ ] Delivery owner provides `pnpm test:biomarkers` output proving identical inputs return identical candidate order, scores, outcome, confidence band, and trace; the suite covers reviewed/provisional, conflict, missing-axis, context-only, tie, and extraction-only cases.
- [ ] Delivery owner provides `pnpm test:measurement-registry` output and corpus fixtures proving inactive, deprecated, unapproved, or source-inapplicable aliases do not generate candidates.
- [ ] Delivery owner provides `pnpm test:document-review` output and a normalization-writer regression proving the active revision persists the versioned decision trace, catalog manifest version, resolver version, outcome, and evidence-derived confidence atomically.
- [ ] Delivery owner provides a review of the EH-110 authority adapter proving the resolver consumes its lifecycle/provenance decision rather than duplicating approval or laboratory policy.
- [ ] Clinical product owner records approval of the initial scoring weights, 55-point resolution threshold, and five-point dominance margin against de-identified launch-corpus evidence.
- [ ] Delivery owner verifies that a manual selection cannot publish a provisional or hard-conflicted candidate and retains automatic evidence with explicit manual-selection evidence.

## Out of scope or not manually testable yet

- EH-111 owns clinical unit, value-kind, and specimen compatibility policy extensions; this checklist tests only the EH-109 generic evidence engine.
- EH-112 owns API, trends, scoring-exclusion, and consumer behavior for incomplete states; **Biomarkers** and **Health Profile** downstream behavior is not an EH-109 manual acceptance check.
- EH-113 and EH-114 own CBC and glucose scenario packs.
- EH-115 owns durable decision-trace presentation beyond the normalization revision payload.
- EH-116 owns reprocessing. There is no EH-109 reprocess control to test manually; reprocess/retry safety requires the EH-116 implementation and developer evidence when that item is delivered.
- No results above are marked passed. Record pass, fail, blocked, or N/A with the reason only after executing the stated check.