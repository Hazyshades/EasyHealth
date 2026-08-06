# Issue #105: Reordered lab names are recognised again

> Tracking id is **GitHub issue #105**, not roadmap item EH-105. Roadmap EH-105
> ("Registry 2.0 observation identity cut-over") has its own checklist at
> `QA/eh-105/checklist.md` and is unrelated to this fix.

**Roadmap status:** Implemented, blocked on release re-approval and reprocessing  
**Build / environment:** `________`  
**Test run date:** `________`  
**Tester:** `________`

## What this checklist covers

Some results were shown as **Measurement not recognized** even though the app
knows that measurement perfectly well. It happened when the reader wrote the
short name at the end of the test name instead of the front — for example
`Alanine aminotransferase (ALT)` instead of `ALT (alanine aminotransferase)`.
Nothing was wrong with the document or the value; the app simply failed to
recognise the name.

After this fix the app recognises both spellings identically.

**Important — read before judging a result as a failure.** Recognising a name
is not the same as fully identifying a measurement. Many of these results will
now say **More details needed** or **Multiple possible matches** rather than
jumping straight to **Matched measurement**. That is the correct and intended
outcome: the app now recognises the test but still refuses to guess a specimen
the report never stated. Moving out of **Measurement not recognized** is the
success condition.

## Before you start

- [ ] Use a dedicated test account.
- [ ] Use only synthetic or de-identified documents.
- [ ] Confirm the listed test data has finished processing.
- [ ] Ask a developer to confirm the reprocessing step has been applied for your
  account, otherwise documents uploaded *before* the fix will still show their
  old state. Newly uploaded documents do not need this.

## Test data

| ID | Test document or setup | Purpose |
| --- | --- | --- |
| `I105-01` | `lab_data/sample_lab_report_english_mock.pdf` (synthetic, in-repo) uploaded fresh after the fix | Main path: recognition of reordered names |
| `I105-02` | The same document uploaded **before** the fix and left untouched | Retroactive reprocessing path |
| `I105-03` | Any synthetic report containing a genuinely invented test name, for example `XYZ-9 Trace` | Confirms unknown tests are still honestly reported as unrecognised |

## Interface checks

### I105-UI-01: A known test is no longer reported as unrecognised

**Precondition:** `I105-01` has finished processing and is open in
**Document review**.

1. Go to **Documents** and open `I105-01`.
2. Find the row for **ALT** (alanine aminotransferase).
3. Read the two coloured labels on that row.

**Expected result:** The row does **not** say **Measurement not recognized**. It
says **More details needed** or **Matched measurement**. The reported value
`28 U/L` and the reference range are unchanged. The row must not be renamed to
some other measurement.

**Result:** `Pass | Fail | Blocked | N/A`  
**Notes / evidence link:** `________`

### I105-UI-02: The row name and its source quote agree

**Precondition:** `I105-01` is open.

1. Select the **ALT** row.
2. Compare the name shown on the row with the quoted source text shown under the
   document image.

**Expected result:** Both refer to the same test. Before the fix the row could
read `Alanine aminotransferase (ALT)` while its own quote read
`"ALT (alanine aminotransferase): 28 U/L"` and the row was still marked
unrecognised — that contradiction must be gone.

**Result:** `Pass | Fail | Blocked | N/A`  
**Notes / evidence link:** `________`

### I105-UI-03: The whole report improves, not just one row

**Precondition:** `I105-01` is open.

1. Read the summary line above the results list (for example
   `42 results · 20 matched · 22 incomplete · 42 not verified`).
2. Compare it with the recorded baseline in the developer-evidence section.

**Expected result:** The number of results is unchanged. The number of rows
reported as **Measurement not recognized** has dropped. Rows have moved into
**More details needed** or **Multiple possible matches**, not out of the list.
No result has disappeared.

**Result:** `Pass | Fail | Blocked | N/A`  
**Notes / evidence link:** `________`

### I105-UI-04: Values, units and ranges are untouched

**Precondition:** `I105-01` is open.

1. Pick three rows that changed state.
2. For each, check the displayed value, unit and reference range against the PDF.

**Expected result:** Every value, unit and reference range matches the document
exactly. Nothing was converted, renamed, or given a specimen the report did not
state. Opening **Technical details** must not show a specimen that the printed
report never mentioned.

**Result:** `Pass | Fail | Blocked | N/A`  
**Notes / evidence link:** `________`

### I105-UI-05: A genuinely unknown test is still reported honestly

**Precondition:** `I105-03` has finished processing.

1. Open `I105-03` and find the invented test name.

**Expected result:** It still reads **Measurement not recognized**, and the raw
result is still preserved and acceptable as reported. The fix must not have made
the app claim to recognise things it does not.

**Result:** `Pass | Fail | Blocked | N/A`  
**Notes / evidence link:** `________`

### I105-UI-06: An older document improves after reprocessing

**Precondition:** `I105-02` was uploaded before the fix, and a developer has
confirmed the reprocessing step was applied.

1. Open `I105-02`.
2. Find the same rows you checked in I105-UI-01.

**Expected result:** They show the same improved state as the freshly uploaded
copy. Any decision you made by hand earlier — a manual mapping or a correction —
is still there and was not overwritten.

**Result:** `Pass | Fail | Blocked | N/A`  
**Notes / evidence link:** `________`

### I105-UI-07: Accepting still works and still requires no mapping

**Precondition:** `I105-01` is awaiting review.

1. Leave every mapping dropdown untouched.
2. Keep the newly recognised rows ticked and click **Accept selected (n)**.

**Expected result:** Acceptance succeeds with no mapping chosen, and the stored
results keep the printed name, value, unit and reference range.

**Result:** `Pass | Fail | Blocked | N/A`  
**Notes / evidence link:** `________`

## Developer evidence required

- [ ] `pnpm test:alias-order` proves outcome parity between both label orderings
  across the launch corpus, that token containment is still rejected, that
  single-token labels gain nothing, that the reported match type is the mode
  that actually fired, and that the admitted alias keeps its own authority,
  approval status, lifecycle and provenance. Provided by the implementing
  engineer in CI.
- [ ] `pnpm test:alias-order-db` proves the widened EH-115 trace allowlist
  accepts `alias_token_set_match`, still accepts traces written under resolver
  version 8, and still rejects unknown codes and malformed traces.
- [ ] The 52-row launch corpus report must be byte-identical before and after
  for every already-resolved row. A developer must confirm 0 identity
  regressions and 0 outcome changes.
- [ ] The EH-116 reprocessing dry run must be reviewed for
  `regressed_resolution`, `identity_changed` and `manual_selection_lost` before
  any apply, and the counts recorded here.
- [ ] `MEASUREMENT_RESOLVER_VERSION` is `9` and
  `MEASUREMENT_CATALOG_MANIFEST_DIGEST` is unchanged — this is a resolver
  change, not a catalog-content change.

## Automated regression coverage (2026-08-05)

| #105 boundary | Automated evidence |
| --- | --- |
| Both label orderings resolve identically (26 parenthetical labels) | `scripts/verify-alias-order-insensitivity.ts` |
| Token containment is not admitted | `scripts/verify-alias-order-insensitivity.ts` |
| Single-token labels admit nothing new | `scripts/verify-alias-order-insensitivity.ts` |
| Reported match type is the mode that fired | `scripts/verify-alias-order-insensitivity.ts` |
| Admitted alias keeps its authority/approval/lifecycle/provenance | `scripts/verify-alias-order-insensitivity.ts` |
| No two reviewed analytes share a token-set projection | `validateMeasurementRegistry` via `scripts/verify-measurement-registry-runner.ts` |
| Specimen variants of one analyte are not a collision | `scripts/verify-alias-order-insensitivity.ts` |
| Trace allowlist widened additively | `supabase/tests/alias_token_set_trace_code.sql` |
| Launch corpus unaffected, `maxFalseConcreteResolutions: 0` | `scripts/registry-v2-candidate-corpus.ts --technical-check` |
| CBC identity antipairs unaffected | `scripts/verify-cbc-measurement-regression-runner.ts` |

## Local verification record (2026-08-05)

Baseline for `lab_data/sample_lab_report_english_mock.pdf` before the fix:
`42 results · 20 matched · 22 incomplete · 42 not verified`.

- [x] `corepack pnpm typecheck` — pass.
- [x] `corepack pnpm test:alias-order` — pass; 26 parenthetical labels compared
  in both orderings. Before the fix the same script failed on all 26.
- [x] `corepack pnpm test:cbc-regression` — pass.
- [x] `corepack pnpm test:eh112` — pass.
- [x] `corepack pnpm test:eh113` — pass.
- [x] `corepack pnpm test:eh106` — pass.
- [x] `corepack pnpm test:eh116` — pass.
- [x] `corepack pnpm test:document-review` — pass.
- [x] `corepack pnpm verify:registry` — pass (now includes the alias-order suite).
- [x] `corepack pnpm build` — pass.
- [x] Launch-corpus diff before/after: 52 rows unchanged, metrics identical
  (`resolved: 7`, `partial: 45`, `unmapped: 0`, `falseConcreteResolutions: 0`),
  **0 identity regressions, 0 outcome changes, 0 alias-match-type changes**.
- [x] `classifyMeasurementDefinitionChange`: **0 changed definitions**, no
  classification emitted — confirms this is a resolver-only change with no
  catalog-content delta.
- [x] `MEASUREMENT_CATALOG_MANIFEST_DIGEST` unchanged at
  `5341c12e8a38255a0276c92c98fdf8bc97adc3d85c916d0726347ea3983f7357`;
  `MEASUREMENT_RESOLVER_VERSION` `8` → `9`.
- [x] `corepack pnpm check:registry-v2-candidate-corpus` — **fails as designed**:
  all seven approvals report "bound to a different candidate input hash" and the
  manifest is not launchable. This is the governance gate, not a defect.
- [ ] `corepack pnpm test:eh111` — **fails, pre-existing on `master` at
  `f87e8fe`** (`unit_dimension_conflict` assertion at
  `scripts/verify-eh111-clinical-compatibility.ts:184`). Reproduced identically
  on the untouched master checkout before this change; unrelated to #105.
- [ ] `corepack pnpm test:alias-order-db` and `corepack pnpm test:eh115-db`
  — **blocked**: Docker is unavailable in this environment, so
  `supabase test db --local` cannot run. Must be executed in CI.
- [ ] EH-116 reprocessing dry run — **blocked**: requires a live database.
- [ ] Manual interface checks I105-UI-01..07 — **not executed**: require a
  running app with Supabase credentials.

## Out of scope or not manually testable yet

- **Growing the catalog with new measurements.** This change only fixes
  recognition of measurements that were already in the catalog. Genuinely
  unknown tests stay unrecognised by design, and that is checked by I105-UI-05.
- **Aggregating unrecognised test names for triage.** Deliberately deferred: it
  depends on this fix landing first, otherwise the list would be dominated by
  names the app actually knows.
- **The LLM-proposed key.** `MeasurementResolutionInput.proposedKey` is still
  threaded through the pipeline and never read, and `proposed_key_match` is
  still reserved but never emitted. Separate follow-up; it would not have fixed
  this bug.
- **Non-parenthetical rephrasing.** This change makes matching insensitive to
  token *order*. It does not handle a reader that adds, drops or translates
  words, which remains extraction-quality work.
- **Browser end-to-end automation.** There is no browser E2E harness in this
  repository. The interface scenarios above remain manual QA.
