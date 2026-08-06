# Issue #106: Inferred specimen is treated as stated evidence

**Roadmap status:** In progress
**Build / environment:** Local Supabase and application development environment
**Test run date:** `________`
**Tester:** `________`

## What this checklist covers

The extraction model used to guess clinical axes the document never printed —
most often `specimen: "serum"` on a plain `ALT` line — and the resolver accepted
that guess as if the laboratory had stated it. A guessed axis then unlocked a
concrete Registry 2.0 identity, so an invented fact became durable medical
identity.

After this change a concrete axis (`specimen`, `modifier`, `method`) only
reaches the resolver when the row's own label, its verbatim source snippet, or
its section heading actually states it. When nothing states it, the axis is
absent, the row stays `partial`, and the missing axis is named. Rows do not
disappear and raw values are never altered — they simply stop claiming a
specimen nobody wrote down.

**Expected user-visible movement on a typical biochemistry + CBC report:** rows
that previously showed a confident specimen-specific result now show
"needs details" with the missing axis named. On the reference sample document
this is 27 confident rows out of 44 becoming 0. That drop is the correct
outcome, not a regression: see *Non-goals* below.

See `openspec/changes/fix-inferred-specimen-as-stated-evidence/`.

## Before you start

- [ ] Use a dedicated test account.
- [ ] Use only synthetic or de-identified documents.
- [ ] Confirm each uploaded document has finished processing before checking it.
- [ ] Note the build: rows extracted before this change keep their stored axes.
  Re-upload a document to see new extraction behaviour; the review screen
  applies the new rule to old rows on read.

## Test data

| ID | Test document or setup | Purpose |
| --- | --- | --- |
| `I106-DOC-01` | Synthetic biochemistry report with a plain `ALT (alanine aminotransferase) 28 U/L` line and no "Material:", "Serum" or similar wording anywhere | Main path: no stated specimen |
| `I106-DOC-02` | Same report with a `Material: serum` line, or a `Serum chemistry` section heading above the ALT row | Positive path: specimen stated by the document |
| `I106-DOC-03` | Synthetic CBC report printed under `Complete blood count` with no `whole blood` wording | Panel heading alone must not supply a specimen |
| `I106-DOC-04` | Synthetic report with a `Fasting glucose, plasma 4.8 mmol/L` line | Two stated axes on one row |
| `I106-DOC-05` | Any document already processed on an earlier build | Old rows stay visible and re-processable |

## Interface checks

### I106-UI-01: An unstated specimen is not invented

**Precondition:** `I106-DOC-01` uploaded and processed.

1. Go to **Documents** and open `I106-DOC-01`.
2. Find the `ALT (alanine aminotransferase)` row in the review list.
3. Open **Technical details** for that row.

**Expected result:** The row is present with its printed value `28 U/L` and its
reference range unchanged. Its status is the incomplete state ("needs details"),
not a confident match. The technical details name `specimen` as the missing
axis. Nowhere does the screen display or preselect the word "serum" for this
row.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

### I106-UI-02: A stated specimen still resolves

**Precondition:** `I106-DOC-02` uploaded and processed.

1. Go to **Documents** and open `I106-DOC-02`.
2. Find the `ALT (alanine aminotransferase)` row.

**Expected result:** The row reaches the confident, specimen-specific result.
The specimen shown matches the word printed in the document. This confirms the
change blocks guesses only, not real evidence.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

### I106-UI-03: A panel heading does not supply a specimen

**Precondition:** `I106-DOC-03` uploaded and processed.

1. Open `I106-DOC-03` and review the haematology rows
   (`Haemoglobin`, `White blood cells`, `Platelets`).

**Expected result:** Every row keeps its printed value and stays visible. None
of them claims a `whole blood` specimen, because the document never printed
those words — the heading `Complete blood count` alone is not enough in this
change. Rows show the incomplete state with `specimen` named as missing.

> This is a deliberate boundary, not a defect. A separate change
> (`add-reviewed-panel-specimen-policy`) introduces reviewed panel policies so
> that an approved heading may supply a specimen. Until that ships, record any
> "this should really be whole blood" observation here rather than failing the
> check.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

### I106-UI-04: Two stated axes on one row

**Precondition:** `I106-DOC-04` uploaded and processed.

1. Open `I106-DOC-04` and find the `Fasting glucose` row.

**Expected result:** The row reaches the confident fasting-plasma-glucose
result. Both the timing (`fasting`, from the printed label) and the specimen
(`plasma`, from the printed line) were stated, so both are honoured.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

### I106-UI-05: Manual correction is still offered without a specimen

**Precondition:** `I106-DOC-01` open on the review screen.

1. Select the `ALT` row from `I106-UI-01`.
2. Look at the correction control.

**Expected result:** The row can still be accepted as raw and the reviewer is
not forced to invent a specimen to keep it. No dropdown silently preselects a
specimen-specific definition.

> Known limitation to record, not to fail: when no axis is stated the candidate
> list is empty, so the reviewer sees no selectable definitions at all — there
> is nothing to choose between. Note it here as UX evidence.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

### I106-UI-06: Existing documents stay visible and re-processable

**Precondition:** `I106-DOC-05` processed on an earlier build.

1. Open `I106-DOC-05`.
2. Confirm every previously extracted row is still listed with its original
   value, unit and reference range.

**Expected result:** No row is deleted or blanked. Values, units and reference
ranges are byte-identical to before. Only the mapping status may change, from
confident to "needs details".

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

### I106-UI-07: Health Profile loses only guessed inputs

**Precondition:** `I106-DOC-01` processed; note your Health Profile biomarker
list before and after.

1. Open **Health Profile**.

**Expected result:** Biomarkers whose rows had a genuinely stated specimen
remain. Biomarkers that only appeared because a specimen was guessed are gone.
No score is computed from a row whose specimen the document never stated.

> On a report with no specimen wording at all, this can empty the laboratory
> section entirely. That is the intended consequence of the change. Record the
> before/after counts.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

## Non-goals

State these explicitly so they are not raised as defects against this change:

- **No panel-implies-specimen rule.** `Complete blood count` does not supply
  `whole blood` here. That is `add-reviewed-panel-specimen-policy`.
- **No prevalence fallback.** "ALT is usually serum" is not evidence and must
  never resolve a row.
- **No section-heading transcription yet.** Only headings the extractor already
  captured into `section_context` participate; verbatim heading capture is part
  of the panel-policy change.
- **No re-extraction of already-stored documents.** Stored rows keep their
  axes; the rule is applied on read and on reprocessing.
- **Health Profile input loss is expected**, not a regression, wherever the
  input depended on a guessed axis.

## Developer evidence

Non-UI assertions. Run from the repository root.

### Automated regression coverage

| Boundary under test | Automated test | Command |
| --- | --- | --- |
| Predicate: stated vs. unstated axis, label / snippet / heading as evidence, separator and `%` equivalence | `scripts/verify-stated-axis-evidence.ts` | `pnpm test:stated-axis` |
| Both row-to-input builders (review preview and acceptance/correction writer) apply the filter | `scripts/verify-stated-axis-evidence.ts` | `pnpm test:stated-axis` |
| Observability column is additive, nullable and never read during resolution | `supabase/tests/stated_axis_inferred_axes.sql` | `pnpm test:stated-axis-db` |
| Launch corpus crosses the extraction-to-resolver seam; no fixture may claim an axis its provenance does not state | `scripts/lib/registry-v2-candidate-corpus.ts` seam guard | `pnpm check:registry-v2-candidate-corpus` |
| Specimen stated by section heading only | corpus row `glucose-specimen-by-section` | `pnpm test:eh106` |
| Conventional serum analyte with no stated specimen stays `partial` | corpus row `glucose-missing-specimen`, row `alt` | `pnpm test:eh106` |
| Reprocessing diff still classifies `partial` → `resolved` correctly | `scripts/verify-eh116-reprocess-batch.ts` | `pnpm test:eh116` |
| Stored document audit: which rows claim an axis their provenance lacks | `scripts/audit-stated-axis-document.ts` | `pnpm audit:stated-axis -- <documentId>` |

### Recorded evidence from the implementation run

- [ ] **Candidate corpus, before:** 52 rows, `resolved 7 / partial 45`,
  `expectedClassificationRate 1.0`, `falseConcreteResolutions 0`.
- [ ] **Candidate corpus, after routing through the seam but before fixtures
  were given provenance:** `resolved 0 / partial 52`, 7 rows failing their
  expectation — the measurement that proves the corpus previously never crossed
  this boundary.
- [ ] **Candidate corpus, final:** 53 rows, `resolved 8 / partial 45`,
  `expectedClassificationRate 1.0`, `falseConcreteResolutions 0`, 0 failing rows.
- [ ] **Reference stored document `f0a8d0c2-d950-4463-a5b8-b685a5f8c6a2`:** 44
  extracted rows, 44 of 44 claiming at least one axis their captured provenance
  does not contain. Resolver outcome with the policy applied: `partial 44`.
  Without the policy the same rows produced `resolved 27 / partial 17`.
- [ ] `MEASUREMENT_NORMALIZATION_VERSION` `5` → `6`.
- [ ] `DOCUMENT_PROCESSING_VERSION` → `2026-08-05-v1`.
- [ ] `REQUIRED_CANDIDATE_CORPUS_ROW_COUNT` `52` → `53`, with
  `corpus.requiredRowCount` and `policy.requiredLaunchRows` updated to match.

### Suites run

- [ ] `pnpm typecheck`
- [ ] `pnpm test:stated-axis`
- [ ] `pnpm test:alias-order`
- [ ] `pnpm test:cbc-regression`
- [ ] `pnpm test:eh112`
- [ ] `pnpm test:eh113`
- [ ] `pnpm test:eh106`
- [ ] `pnpm test:eh116`
- [ ] `pnpm test:document-review`
- [ ] `pnpm verify:registry`
- [ ] `pnpm build`
- [ ] Database: `pnpm test:stated-axis-db`, `pnpm test:alias-order-db`,
  `pnpm test:eh106-db`, `pnpm test:eh113-db`, `pnpm test:eh114-db`

### Known unrelated failure

`pnpm test:eh111` fails at
`scripts/verify-eh111-clinical-compatibility.ts:184`. Reproduced identically on
a clean `master` worktree before this change. Not caused by, and not fixed by,
this work.

### Release gate

Not satisfied by this checklist. The candidate input hash changed, so the seven
approval records in `registry/candidate-release/v1/approvals.json` are bound to
a stale hash and the candidate is not launchable. Re-approval is a human act
and is planned as a single `registry-v2.0.0-candidate.2` release covering
issue #105 and issue #106 together.

- [ ] #105 merged first, so alias admission is settled before the hash is cut.
- [ ] Single candidate hash captured after both changes are in.
- [ ] Seven approvals re-signed against that hash by
  `registry-safety-reviewer` (×1), `release-manager` (×1), `assessment-owner`
  (×5).
- [ ] EH-116 reprocess dry run reviewed; `regressed_resolution` rows understood
  and accepted before any `--apply`.
