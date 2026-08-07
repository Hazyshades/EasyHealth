# Issue #114: incomplete rows say why, and who can act

**Roadmap status:** In progress
**Build / environment:** Local Supabase and application development environment
**Test run date:** `________`
**Tester:** `________`

## What this checklist covers

Every incomplete laboratory row used to show one sentence — *"The result is recognized, but
required context is missing"* — no matter why it was incomplete. For a row whose specimen
the report never printed, that is true and actionable. For a row blocked only because our
measurement catalog has not reviewed that definition yet, it is **false**: nothing the
reader could supply would move it, and looking for a missing detail invites them to guess
a specimen the document never stated.

Rows now carry a reason, and the wording, the technical details and the header counts all
follow it. Values, units, reference ranges and raw acceptance are unchanged.

See `openspec/changes/distinguish-incomplete-row-reasons/`. This also closes the last open
criterion of issue #63.

## Expected movement, so it is not filed as a regression

On a report with no specimen wording, the header used to read a single figure such as
`44 incomplete`. It now also reads the split — for the reference document,
**32 awaiting details from the report** and **12 awaiting our catalog review**. The total is
unchanged; it is being explained, not recalculated.

Documents whose incomplete rows are **all** catalog-blocked no longer offer reprocessing.
That is deliberate: reprocessing re-runs the resolver against the same catalog release and
would return the same verdict.

## Before you start

- [ ] Use a dedicated test account.
- [ ] Use only synthetic or de-identified documents.
- [ ] Confirm each uploaded document has finished processing before checking it.
- [ ] Note the build: this change alters wording and counters only. If a value, unit or
  reference range differs from before, that is a defect, not part of this change.

## Test data

| ID | Test document or setup | Purpose |
| --- | --- | --- |
| `I114-DOC-01` | Synthetic biochemistry + haematology report with **no** specimen wording anywhere (no "serum", "plasma", "whole blood", no "Material:" line) | Mixed reasons on one document |
| `I114-DOC-02` | A report containing a recognized specialty result — anti-Toxocara IgG, anti-Echinococcus IgG, Total IgE or Eosinophilic cationic protein | Catalog-blocked path |
| `I114-DOC-03` | Same report as `I114-DOC-01` but with a `Material: serum` line added | Control: the reason disappears when the document states it |
| `I114-DOC-04` | A report with an impossible unit for its analyte, e.g. `Glucose 5.0 %` | Conflict path |

## Interface checks

### I114-UI-01: A catalog-blocked row says the wait is ours

**Precondition:** `I114-DOC-02` uploaded and processed.

1. Go to **Documents** and open `I114-DOC-02`.
2. Find the specialty row (for example `Total IgE`).

**Expected result:** The row states that the measurement is **recognized and awaiting review
in our catalog**, and that the report is complete for this result. It does **not** say that
required context is missing, and does **not** ask for a specimen, method or any other
detail. The printed value, unit and reference range are unchanged.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

### I114-UI-02: A document-blocked row names the missing detail

**Precondition:** `I114-DOC-01` uploaded and processed.

1. Open `I114-DOC-01` and find the `ALT` row.

**Expected result:** The row states that the result is recognized and that **the specimen is
not stated in this report** — naming the specimen specifically, visible without expanding
**Technical details**. Where more than one detail is missing they are listed in one
sentence, for example "the specimen and method are not stated in this report".

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

### I114-UI-03: The header separates the two

**Precondition:** `I114-DOC-01` open.

1. Read the counts above the results list.

**Expected result:** Alongside the totals, the header reports how many rows are awaiting
details from the report and how many are awaiting our catalog review. The two, plus any
conflicted rows, add up to the incomplete total.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

### I114-UI-04: Stating the specimen removes the reason

**Precondition:** `I114-DOC-03` uploaded and processed.

1. Open `I114-DOC-03` and find the same `ALT` row.

**Expected result:** The row now reaches a confident, specimen-specific result. This
confirms the new wording tracks real evidence rather than being cosmetic.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

### I114-UI-05: A conflict reads as a conflict

**Precondition:** `I114-DOC-04` uploaded and processed.

1. Open `I114-DOC-04` and find the `Glucose` row.

**Expected result:** The row states that the reported unit or value type does not match any
reviewed measurement. It does not claim a detail is missing and does not blame the catalog.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

### I114-UI-06: Raw acceptance still works for every reason

**Precondition:** `I114-DOC-01` and `I114-DOC-02` open in turn.

1. Accept one row of each reason as reported.

**Expected result:** Acceptance succeeds without choosing a measurement, for every reason
class. No row requires a specimen to be supplied.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

### I114-UI-07: Reprocessing is not offered where it cannot help

**Precondition:** A document whose incomplete rows are all catalog-blocked
(`I114-DOC-02` with no other incomplete rows).

**Expected result:** The document does not present reprocessing as the way to complete those
rows. On a document that also has rows awaiting details from the report, the affordance
remains.

> If a tester expects reprocessing here, record the expectation rather than failing the
> check — the affordance was removed deliberately because it could not change the outcome.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

### I114-UI-08: Technical details name the reason

**Precondition:** any incomplete row.

1. Expand **Technical details**.

**Expected result:** A `Reason:` line names the class in plain language. Missing axes and
conflicts appear as clinical English — `Specimen`, `Collection timing`, `Value type` — never
as raw tokens such as `value_kind`. No candidate key is shown as the active measurement.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

## Non-goals

- **The eight provisional definitions are not reviewed here.** Reviewing them would resolve
  those twelve rows outright, but that is a catalog decision with its own approval and
  release hash. This change makes the state legible; it does not change which definitions
  are reviewed.
- **No new resolver behaviour.** Which rows resolve, the candidate ranking and the
  confidence are unchanged. Only the explanation is richer.
- **No localization.** Copy remains English; the repository has no i18n mechanism.

## Developer evidence

### Automated regression coverage

| Boundary under test | Automated test | Command |
| --- | --- | --- |
| Provisional-only row is distinguishable from an axis-blocked row | `scripts/verify-incomplete-reason-class.ts` | `pnpm test:reason-class` |
| Precedence: conflict > missing axis > maturity | same | `pnpm test:reason-class` |
| A conflict from a non-viable candidate does not outrank a missing axis | same | `pnpm test:reason-class` |
| No class except `axis_not_stated` says "required context is missing" | same | `pnpm test:reason-class` |
| Catalog-blocked copy asks for nothing | same | `pnpm test:reason-class` |
| Every clinical axis has a label, never a raw token | same | `pnpm test:reason-class` |
| Retired/absent definition yields `no_candidate`, not `definition_not_reviewed` | same | `pnpm test:reason-class` |
| Counter split sums to the incomplete total | `scripts/verify-eh117-review-workspace.ts` | `pnpm test:eh117` |
| Catalog-blocked rows do not offer reprocessing | same | `pnpm test:eh117` |
| Metric key allowlist including the new field | `scripts/verify-eh112-incomplete-outcomes.ts` | `pnpm test:eh112` |

All four suites now run in CI. They were local-only before this change, which is why a
sentence that was false for twelve rows on a real document shipped green — see issue #110.

### Recorded evidence from the implementation run

- [ ] **Reference document `298232ee-8b7e-43cf-9b5d-0922d9825e41`, 44 rows:**
  32 `axis_not_stated`, 12 `definition_not_reviewed`, 0 unclassified.
- [ ] The twelve are `giardia_antibodies_total`, `ascaris_igg`, `toxocara_igg`,
  `opisthorchis_felineus_igg`, `echinococcus_igg`, `trichinella_igg`,
  `total_ige_unspecified`, `ecp_unspecified`.
- [ ] **Defect found while measuring:** `conflicts` unions every candidate, so numeric
  `Glucose 4.1 mmol/L` borrowed a `value_kind_conflict` from `glucose_urine_dipstick`, a
  candidate it was never going to be. A conflict now outranks a missing axis only when it
  leaves nothing selectable. Without the fix that row read as a unit conflict while four
  live candidates waited on a specimen.
- [ ] Resolver selection unchanged: `MEASUREMENT_RESOLVER_VERSION` still `9`, candidate
  input hash still `f00c0e6f4b0c…`, `launchable: true`. A moved hash would have invalidated
  the seven approvals on `registry-v2.0.0-candidate.2`.
- [ ] Dead code removed: `LaboratoryConsumerExclusionReason.unreviewed_definition` was
  declared and never produced.

### Suites run

- [ ] `pnpm typecheck`, `pnpm test:reason-class`, `pnpm test:eh112`,
  `pnpm test:document-review`, `pnpm test:eh117`, `pnpm test:eh106`,
  `pnpm test:stated-axis`, `pnpm test:cbc-regression`, `pnpm test:eh113`,
  `pnpm test:eh116`, `pnpm test:eh118`, `pnpm verify:registry`, `pnpm build`
- [ ] Database against a local stack: `eh104`, `eh105`, `eh106`, `eh111`, `eh113`, `eh114`,
  `eh115`, `eh116`, `eh118`, `postgrest-alias`, `alias-order`, `stated-axis` — all PASS.

### Known unrelated failures

`pnpm test:eh111` fails at `verify-eh111-clinical-compatibility.ts:184`, and `test:pr2-db`
fails, both reproduced on a clean `master` before this change. Tracked in issue #110.
