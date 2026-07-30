# EH-114: Glucose specimen and timing identities

**Roadmap status:** Implementation complete; manual QA and local database execution are pending
**Build / environment:** `________`
**Test run date:** `________`
**Tester:** `________`

## What this checklist covers

EH-114 keeps glucose results distinct by specimen and meal timing. A result is
concrete only when the document supplies compatible evidence; incomplete or
incompatible evidence remains non-concrete rather than being treated as serum,
fasting, or another blood measurement.

## Before you start

- [ ] Use a dedicated test account and a disposable test profile.
- [ ] Use only synthetic or de-identified documents; never upload real health
  records.
- [ ] Confirm each listed document has finished processing before review.
- [ ] Sign in as the owner of the test profile in a supported browser.

## Test data

| ID | Test document or setup | Purpose |
| --- | --- | --- |
| `EH114-SERUM` | Synthetic result: `Glucose 5.3 mmol/L`, explicit serum specimen | Serum numeric identity |
| `EH114-PLASMA` | Synthetic results with explicit plasma evidence: `Glucose 5.6 mmol/L`, `Fasting glucose 4.8 mmol/L`, and `Post-prandial glucose 6.9 mmol/L` | Plasma, fasting, and post-prandial identities |
| `EH114-WHOLE-BLOOD` | Synthetic result: `Glucose 92 mg/dL`, explicit whole-blood specimen | Whole-blood identity and conversion |
| `EH114-URINE` | Synthetic result: `Urine glucose Positive`, explicit urine specimen and dipstick/qualitative evidence | Urine qualitative identity |
| `EH114-INCOMPLETE` | Synthetic results: `Glucose 5.1 mmol/L` with no specimen, and `Fasting glucose 4.7 mmol/L` with plasma but no timing evidence | Missing-context safety |
| `EH114-BAD-UNIT` | Synthetic result: `Glucose 5.0%`, explicit serum specimen | Incompatible-unit safety |

## Interface checks

### EH114-UI-01: Review explicit glucose identities

**Precondition:** `EH114-SERUM`, `EH114-PLASMA`, and `EH114-WHOLE-BLOOD` are
processed and visible in **Documents** → **Extracted biomarkers**.

1. Open each document in **Documents**.
2. In **Extracted biomarkers**, inspect the mapping for each glucose result.
3. Verify the serum, plasma, whole-blood, fasting, and post-prandial results
   are not presented as one interchangeable glucose measurement.
4. Accept the reviewed results using the existing review action, then refresh
   each document.

**Expected result:** Each result remains resolved to its compatible identity.
Fasting and post-prandial results remain distinct from point-in-time plasma
results; a whole-blood result is not relabeled as serum or plasma.

**Result:** `________`
**Notes / evidence link:** `________`

### EH114-UI-02: Keep urine glucose qualitative and display-only

**Precondition:** `EH114-URINE` is processed and visible in **Documents** →
**Extracted biomarkers**.

1. Open `EH114-URINE` in **Documents**.
2. Inspect the extracted urine glucose result and accept it if the existing
   review interface offers that action.
3. Refresh the document, then open **Biomarkers** and **Health Profile**.

**Expected result:** The result remains a qualitative urine-dipstick finding.
It is not shown with a numeric `mg/dL`/`mmol/L` conversion and is not used as a
metabolic assessment input.

**Result:** `________`
**Notes / evidence link:** `________`

### EH114-UI-03: Preserve incomplete or conflicting glucose evidence

**Precondition:** `EH114-INCOMPLETE` and `EH114-BAD-UNIT` are processed and
visible in **Documents** → **Extracted biomarkers**.

1. Open each document in **Documents**.
2. Read the mapping status and available evidence in **Extracted biomarkers**.
3. Do not choose a manual serum, plasma, fasting, or post-prandial correction.
4. Refresh each document and inspect **Biomarkers**.

**Expected result:** Missing-specimen, missing-timing, and incompatible-unit
results stay non-concrete. The product does not invent a specimen or meal
timing, convert the incompatible unit, or add these results as concrete trends
or assessment inputs.

**Result:** `________`
**Notes / evidence link:** `________`

### EH114-UI-04: Reprocess without changing a reviewed identity

**Precondition:** Complete EH114-UI-01 with one accepted explicit glucose
result.

1. Use the existing **Reprocess** action for that document, if it is available
   in the build under test.
2. Wait for processing to finish and reopen **Extracted biomarkers**.
3. Open **Biomarkers** and compare the displayed result with the source
   document.

**Expected result:** The reprocessed result retains the same compatible glucose
identity or presents the existing safe review state. It does not create a
duplicate result or silently change specimen or timing.

**Result:** `________`
**Notes / evidence link:** `________`

## Developer evidence required

- [x] **Engineering:** `pnpm test:measurement-registry` verifies serum,
  plasma, whole-blood, fasting, post-prandial, and urine-dipstick resolution;
  missing timing/specimen, conflicting modifiers, incompatible units, numeric
  conversion availability, and absence of a urine assessment binding.
- [x] **Release owner and assessment owner:** Authorization bundle
  `019fae7b-02ca-7000-bf2a-6a2fa2e052ec` approved the hash-bound registry
  safety review, release gate, ALT manual correction, and
  serum/plasma/whole-blood/fasting glucose score-affecting bindings for
  candidate input `d10b6c0b2e7b3fe2451bc47fcd2c1c081709147f10b778b7557f559787649a25`.
- [x] **Engineering:** `pnpm test:registry-v2-candidate-corpus` and
  `pnpm check:registry-v2-candidate-corpus` passed: 52 rows, all expected
  classifications, zero false-concrete resolutions, and a launchable manifest.
- [x] **Engineering:** `pnpm test:biomarkers`, `pnpm verify:registry`,
  `pnpm typecheck`, and `openspec validate eh-114-cover-glucose-specimen-timing
  --strict` passed. `verify:registry` used non-secret placeholder environment
  values because its runtime import validates environment configuration.
- [ ] **Database owner:** `pnpm test:eh114-db` exercises the v2 writer with
  synthetic post-prandial plasma, qualitative urine-dipstick, and missing-timing
  glucose inputs. It must pass on a disposable local or CI Supabase stack
  before database execution is marked complete.

## Local verification record (2026-07-30)

- [x] `corepack pnpm test:biomarkers` and `corepack pnpm test:measurement-registry` passed.
- [x] `corepack pnpm typecheck` passed.
- [x] `openspec validate eh-114-cover-glucose-specimen-timing --strict` passed.
- [x] Candidate report resolves all 52 expected rows with 100% raw, recognition,
  expected-classification, alias, and unit coverage; it reports zero false
  concrete resolutions and zero processing errors.
- [x] `corepack pnpm test:registry-v2-candidate-corpus` and
  `corepack pnpm check:registry-v2-candidate-corpus` passed with no approval
  errors and a launchable 52-row manifest.
- [x] `corepack pnpm verify:registry` passed with non-secret placeholder
  environment values.
- [ ] `corepack pnpm test:eh114-db` could not execute: this workspace exposes
  the local database port, but the Supabase test runner cannot access Docker
  Desktop and no `psql` client is installed for direct pgTAP execution.

## Out of scope or not manually testable yet

- Candidate-corpus hashing, approval validation, threshold evaluation, and
  false-concrete regression checks have no end-user interface. Use the
  developer evidence above; do not invent a release screen.
- EH-114 does not add a new upload, review, Biomarkers, or Health Profile
  interface. If the current build does not expose specimen, timing, or mapping
  evidence in **Extracted biomarkers**, mark the related manual check
  **Blocked** and attach the developer evidence instead.
- External-code mappings, database migrations, clinical reference ranges,
  diagnosis logic, and Registry v1 changes are out of scope.
- No interface check is passed until a tester records an observed result and
  supporting evidence.
