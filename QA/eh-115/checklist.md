# EH-115: Persist resolver decision traces

**Roadmap status:** In progress
**Build / environment:** Local Supabase and application development environment
**Test run date:** `________`
**Tester:** `________`

## What this checklist covers

EH-115 lets a document owner inspect the recorded, privacy-safe reason a laboratory observation was resolved, remained ambiguous, was incomplete, or was unmapped. The explanation belongs to the normalization revision that produced it, so later registry or resolver changes must not rewrite historical decisions.

## Before you start

- [ ] Use a dedicated test account.
- [ ] Use only synthetic or de-identified laboratory documents.
- [ ] Confirm the listed documents have finished processing and have extracted laboratory rows.
- [ ] Prepare one document with a reviewed, resolvable laboratory row and one document with an incomplete or ambiguous laboratory row.

## Test data

| ID | Test document or setup | Purpose |
| --- | --- | --- |
| `EH115-RESOLVED-01` | Synthetic laboratory document with a reviewed glucose result, unit, and specimen | Stored resolved decision trace |
| `EH115-INCOMPLETE-02` | Synthetic laboratory document with a recognized label but no specimen or unit needed for a unique match | Stored partial or ambiguous decision trace |
| `EH115-LEGACY-03` | Existing synthetic document whose active normalization revision predates the EH-115 migration | Legacy trace-unavailable state |

## Interface checks

### EH115-UI-01: View the persisted decision rationale

**Precondition:** `EH115-RESOLVED-01` has an active normalized laboratory observation created after EH-115 is deployed.

1. Sign in with the account that owns `EH115-RESOLVED-01`.
2. Open **Documents** and select `EH115-RESOLVED-01`.
3. Open the extracted laboratory results and expand **Technical details** for the resolved row.
4. Note the displayed outcome, decision rationale, selected candidate, candidate evidence-code summaries, and catalog/resolver versions.

**Expected result:** The technical details identify a persisted decision trace and show the recorded rationale and version identifiers. They do not expose source text, raw label, raw value, raw unit, section context, neighbouring labels, or document metadata.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

### EH115-UI-02: Explain an incomplete or non-unique result

**Precondition:** `EH115-INCOMPLETE-02` has an active normalized laboratory observation created after EH-115 is deployed.

1. Sign in with the owner account.
2. Open `EH115-INCOMPLETE-02` in **Documents**.
3. Expand **Technical details** for the incomplete or ambiguous result.
4. Note the recorded outcome, missing axes, conflicts, and candidate evidence-code summaries.

**Expected result:** The interface labels the result as partial, ambiguous, or unmapped as recorded; it lists only privacy-safe missing-axis, conflict, and evidence-code summaries. It does not invent a winning measurement identity or display raw document content.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

### EH115-UI-03: Distinguish preview and legacy states

**Precondition:** `EH115-LEGACY-03` is available, and a second synthetic document has an extracted row with no persisted normalization revision.

1. Open `EH115-LEGACY-03` and expand **Technical details** for its relevant row.
2. Verify the trace status.
3. Open the document that has no persisted normalization revision and expand **Technical details** for its relevant row.
4. Verify the trace status and labels.

**Expected result:** The legacy row explicitly states that no historical decision trace was stored; it does not present recomputed resolver output as history. The non-persisted row is explicitly labelled as a preview and is visually distinct from the persisted trace.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

### EH115-UI-04: Enforce document ownership

**Precondition:** A second dedicated account exists and does not own `EH115-RESOLVED-01`.

1. Sign in with the second account.
2. Attempt to open `EH115-RESOLVED-01` through the application.
3. If an authenticated API inspection tool is available, request the document's biomarker endpoint while signed in as the second account.

**Expected result:** The second account cannot view the document or its resolver trace. No trace content is returned to an unauthorised account.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

## Developer evidence required

- [x] `pnpm test:measurement-registry` verifies canonical resolver traces for resolved, ambiguous, partial, unmapped, manual-selection, canonical ordering, and raw-input redaction.
- [x] `SKIP_ENV_VALIDATION=1 pnpm test:document-review` verifies persisted-trace selection, legacy-unavailable behaviour, preview labelling, authenticated ownership enforcement, and no raw trace content in the API model.
- [x] `pnpm test:eh115-db` verifies the additive migration, service-only writer access, atomic persistence, trace validation, immutability, and idempotent reuse against a freshly reset local Supabase database.
- [ ] Deployment owner confirms migration `039_eh115_resolver_decision_trace.sql` has applied to the target environment before product QA.
- [ ] Reviewer confirms a historical persisted trace remains unchanged after a resolver/catalog release update in a deployed environment.

## Out of scope or not manually testable yet

- Trace schema validation, immutability enforcement, request-hash idempotency, and raw-source redaction are database and API contracts; use the automated evidence above.
- Production migration deployment and a live historical-release comparison are unavailable in the local QA interface and require deployment-owner evidence.
