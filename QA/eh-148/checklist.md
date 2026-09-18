# EH-148: Doctor Visit Brief

**Roadmap status:** Planned
**Build / environment:** `________`
**Test run date:** `________`
**Tester:** `________`

## What this checklist covers

This checklist covers the source-grounded Doctor Visit Brief: typed sections, explicit limitations, source references, and the materialized document scope. It does not treat a filename or an LLM sentence as evidence by itself.

## Before you start

- [ ] Use a dedicated test account.
- [ ] Use only synthetic or de-identified documents.
- [ ] Confirm the listed test data has finished processing, unless the check intentionally tests processing.

## Test data

| ID | Test document or setup | Purpose |
| --- | --- | --- |
| `EH148-LAB-01` | Synthetic lab with two dated numeric observations and ranges | Normal evidence path |
| `EH148-MIXED-01` | Synthetic imaging/consultation record with accepted structured fields | Multi-source scope |
| `EH148-LIMIT-01` | Synthetic record with one point or no comparable history | Missing-evidence path |
| `EH148-LEGACY-01` | Existing test fixture representing an unversioned legacy report | Legacy boundary |

## Interface checks

### EH148-UI-01: Create a mixed-source brief

**Precondition:** The dedicated account has `EH148-LAB-01` and `EH148-MIXED-01` eligible for reports.

1. Go to **Reports → Create report**.
2. Select both synthetic documents and create a standard brief.
3. Open the generated report detail page.

**Expected result:** The brief shows typed document summaries, latest measurements, changes, questions, limitations, and a visible disclaimer. Each factual item has an inspectable source reference; no unrelated document appears.

**Result:** `N/A`
**Notes / evidence link:** `Implementation not started; execute after EH-148 delivery.`

### EH148-UI-02: Show missing evidence as a limitation

**Precondition:** The account has only `EH148-LIMIT-01` in scope.

1. Create a brief from the limited fixture.
2. Open the report detail page.
3. Inspect the changes and limitations sections.

**Expected result:** The page explains that a comparison is unavailable. It does not label the result as improving, worsening, diagnosed, or treated.

**Result:** `N/A`
**Notes / evidence link:** `Implementation not started; execute after EH-148 delivery.`

### EH148-UI-03: Inspect the source ledger

**Precondition:** A validated brief exists with `EH148-LAB-01` in scope.

1. Open the source details for a measurement claim.
2. Compare the displayed value, unit, reference range, date, and document label with the synthetic source.
3. Inspect the visible source ledger and citation labels.

**Expected result:** The ledger shows the evidence snapshot and document identity, and citation labels are derived from source IDs rather than filenames.

**Result:** `N/A`
**Notes / evidence link:** `Implementation not started; execute after EH-148 delivery.`

### EH148-UI-04: Keep legacy reports readable without fabricated citations

**Precondition:** `EH148-LEGACY-01` is visible to the dedicated account.

1. Open the legacy report.
2. Confirm the existing content remains readable.
3. Look for sharing and export actions.

**Expected result:** Legacy content is identified as legacy. Source-grounded sharing/export is unavailable until revalidation; no citation markers are invented from old filenames.

**Result:** `N/A`
**Notes / evidence link:** `Implementation not started; execute after EH-148 delivery.`

## Developer evidence required

- [ ] Contract/schema verification proves every new factual claim has an in-payload source ID and every source retains row/document identity.
- [ ] API verification proves the all-eligible request stores an exact document UUID array and cannot widen explicit scope.
- [ ] Mixed-source verification covers observations, findings, notes, prescriptions/referrals, and document summaries.
- [ ] Legacy verification proves unversioned/null-scope rows are readable but not silently upgraded.
- [ ] The EH-150 validator handoff and integration seam are recorded before share/export work begins.
- [ ] Focused API/route verification proves storage paths and cross-profile source records never enter the report response or source ledger.
- [ ] Service-transition evidence proves `public.create_validated_report` rechecks identity/scope and rolls back staged report/mapping/status on injected validator, RPC, and persistence failure with no readable unvalidated candidate.

## Out of scope or not manually testable yet

- Citation semantics, token verification, access logs, and export format fidelity are covered by EH-150, EH-151/EH-152, and EH-153.
- The checklist is planned; no row is evidence of an executed test until the implementation exists.
