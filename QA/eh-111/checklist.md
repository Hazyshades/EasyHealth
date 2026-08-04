# EH-111: Clinical measurement compatibility policy

**Roadmap status:** In progress
**Build / environment:** Local implementation worktree, current `origin/master` baseline
**Test run date:** 2026-07-28
**Tester:** Automated developer evidence recorded by implementation agent; manual tester unassigned

## What this checklist covers

EH-111 prevents a laboratory result from receiving a concrete Registry 2.0 identity when its unit family, value kind, or specimen is missing or incompatible. It also prevents partial, ambiguous, provisional, inactive, or evidence-only candidate keys from enabling display conversion.

The compatibility policy is primarily an internal resolver and read-boundary contract. EH-112 owns the future incomplete-state UI; this checklist does not claim that unavailable interface.

## Before you start

- [ ] Use a dedicated test account.
- [ ] Use only the synthetic fixtures below or equivalent de-identified documents.
- [ ] Confirm each uploaded document has finished processing before inspecting its results.
- [ ] Set the profile laboratory unit preference to SI when executing the conversion check.

## Test data

| ID | Synthetic or de-identified setup | Purpose |
| --- | --- | --- |
| `EH111-COMPLETE-01` | Synthetic serum glucose result: `Glucose 90 mg/dL`, numeric value kind, serum specimen. | Complete reviewed resolution and guarded display conversion. |
| `EH111-MISSING-UNIT-01` | Same synthetic serum glucose result with no unit. | Missing-unit incomplete path; must not become concrete. |
| `EH111-UNKNOWN-UNIT-01` | Same synthetic serum glucose result with unit `widgets/L`. | Unsupported observed-unit hard conflict. |
| `EH111-SPECIMEN-01` | Synthetic glucose result marked urine and synthetic UACR result marked serum. | Bidirectional urine/blood specimen conflict. |
| `EH111-QUAL-01` | Synthetic qualitative result `Negative` with no numeric unit. | Ordinal extraction compatible with qualitative representation and display-only unit policy. |
| `EH111-COUNT-01` | Synthetic neutrophil percent result using `10^9/L` and absolute-count result using `%`. | Bidirectional percent/absolute-count conflict. |

## Interface checks

### EH111-UI-01: Complete reviewed result remains usable

**Precondition:** `EH111-COMPLETE-01` has processed successfully and the profile laboratory unit preference is SI.

1. Go to **Documents**.
2. Open the document containing `EH111-COMPLETE-01`.
3. Confirm the extracted glucose result retains the synthetic raw label, value, unit, and specimen.
4. Go to **Biomarkers** and locate the same glucose observation.

**Expected result:** The result is available as a concrete reviewed glucose observation. When conversion is offered by the existing product interface, `90 mg/dL` is presented as approximately `5 mmol/L`; the stored/raw value remains available as its original evidence.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

### EH111-UI-02: Incomplete or conflicting evidence never appears as converted identity

**Precondition:** `EH111-MISSING-UNIT-01`, `EH111-UNKNOWN-UNIT-01`, `EH111-SPECIMEN-01`, and `EH111-COUNT-01` have processed successfully.

1. Go to **Documents**.
2. Open each synthetic document.
3. Confirm the raw extracted rows remain visible with their supplied labels, units, and specimens.
4. Go to **Biomarkers** and check whether any of those incomplete or conflicting rows appears as a converted concrete observation.

**Expected result:** No incomplete or conflicting row is presented as a converted concrete Registry 2.0 observation. Raw extracted evidence remains available. A detailed incomplete-state explanation is not required here because EH-112 owns that interface.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

### EH111-UI-03: Unitless qualitative result remains unitless

**Precondition:** `EH111-QUAL-01` has processed successfully.

1. Go to **Documents**.
2. Open the document containing `EH111-QUAL-01`.
3. Locate the `Negative` result.
4. Inspect the displayed value and unit.

**Expected result:** The non-numeric result remains visible as `Negative` without a fabricated numeric unit or numeric conversion.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

## Developer evidence required

- [x] `pnpm test:eh111` proves seven unit-policy cases, seven value-kind cases, six specimen cases, resolver tie/eligibility behavior, persistence/read projection, conversion denial states, and all 44 launch-corpus rows with zero false concrete resolutions. Provided by the implementation agent on 2026-07-28.
- [x] `pnpm typecheck` proves the resolver, writer, active read boundary, API consumers, conversion input, and regression fixtures agree on the EH-111 contracts. Provided by the implementation agent on 2026-07-28.
- [x] `pnpm test:biomarkers`, `pnpm test:measurement-registry`, and `pnpm test:registry-v2-runtime` preserve the existing biomarker, registry-validation, and Registry 2.0 runtime behavior. Provided by the implementation agent on 2026-07-28.
- [x] `SKIP_ENV_VALIDATION=1 pnpm test:eh106-consumer` passes the active-revision consumer boundary regression, including null concrete identity for incomplete/provisional/inactive revisions. Provided by the implementation agent on 2026-07-28.
- [x] `pnpm check:postgrest-embed-hints` passes after every active-revision consumer projection adds `resolver_evidence`. Provided by the implementation agent on 2026-07-28.
- [ ] `pnpm test:eh111-db` must run against a disposable migrated Supabase stack. It verifies persisted missing-axis evidence, denial of concrete identity for `partial` and `ambiguous` outcomes, rollback of invalid writes, and the resolved reviewed projection. Blocked locally on 2026-07-28 because Docker/Supabase PostgreSQL is unavailable; record the disposable-stack run result and cleanup evidence here.
- [ ] Live `pnpm test:postgrest-embeds` was not executed because this worktree has no configured disposable Supabase/PostgREST endpoint or scoped test credentials. Required evidence: run against a disposable migrated stack and record fixture cleanup.
- [x] `pnpm test:eh111` and `pnpm test:measurement-registry` confirm catalog version `2026-07-28.0`, resolver `7`, normalization `5`, decision trace `2`, compatibility policy `1`, registry validity, and deterministic manifest serialization. Provided by the implementation agent on 2026-07-28.
- [ ] Obtain new hash-bound candidate-release approvals from the registry safety reviewer, assessment owner, and release manager. The EH-111 manifest/input digest changed, so prior EH-109/EH-110 approvals cannot be silently rebound. Until these approvals exist, the behavioral corpus is 44/44 with zero false concrete resolutions but the release manifest remains correctly non-launchable.

## Out of scope or not manually testable yet

- Per-candidate evidence arrays, missing-axis serialization, hard-conflict codes, deterministic scores, selected-trace equality, active-revision guards, manifest digests, and historical trace versioning are not manually testable through the product UI. Use the developer evidence above.
- EH-112 owns explicit incomplete/ambiguous status presentation. Do not fail EH-111 because that future UI is unavailable, and do not mark it tested.
- EH-113 CBC scenario expansion, EH-114 glucose scenario expansion, EH-115 support trace access/redaction, and EH-116 reprocessing are out of scope.
- No manual interface result is marked as passed until a tester executes it in a deployed test environment.
