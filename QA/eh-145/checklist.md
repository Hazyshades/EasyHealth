# EH-145: Score provenance and explanation

**Roadmap status:** In progress
**Build / environment:** `eh-145-build-score-provenance-and-explanation` against local Supabase (Docker) and `pnpm dev`
**Test run date:** `2026-08-24`
**Tester:** `Codex`

## What this checklist covers

This checklist covers the Health Profile explanation panel that shows the
algorithm version, readiness groups, score contributors, excluded observations,
and links back to source documents. It also covers the profile-level list of
laboratory observations that remain factual records but were not eligible for a
current-state score.

The explanation is descriptive evidence only. It must not present a diagnosis,
change a score, or remove any factual laboratory result.

## Before you start

- [x] Use a dedicated synthetic test account (`eh145-tester@example.com`, magic-link session created for this run and deleted afterwards).
- [x] Use only synthetic documents (`eh145-e2e-synthetic-lab.pdf`, seeded directly; no real patient data).
- [x] Confirm the synthetic observations were visible to the synchronous assessment fallback (no cached assessment version existed).
- [x] Synthetic glucose (90 mg/dL, 70–99, page 1, exact region) and HbA1c (5.4 %, 4.0–5.6, page 2, exact region) on one synthetic document.
- [x] Synthetic unmapped "Mystery marker" (no reviewed identity) on page 2 of the same document.

## Test data

| ID | Test document or setup | Purpose |
| --- | --- | --- |
| `EH145-01` | Synthetic lab PDF: glucose 90 mg/dL, range 70–99; HbA1c 5.4%, range 4.0–5.6; results on pages 1 and 2 | Satisfied metabolic readiness and contributor/source evidence |
| `EH145-02` | Synthetic lab PDF: a result with no reviewed measurement identity, or a numeric result without a usable document range | Profile-level exclusion and no-score explanation |
| `EH145-03` | Synthetic lab PDF with only the glucose result from `EH145-01` | Missing readiness group and null-score explanation |

## Interface checks

### EH145-UI-01: Open score explanation for a scored system

**Precondition:** `EH145-01` is processed and the Health Profile assessment is
successful. The metabolic system card displays a numeric score.

1. Go to **Health Profile**.
2. Select the **Metabolic** system card or open its details drawer.
3. Expand **How this assessment was calculated**.

**Expected result:** The expanded panel shows an algorithm version, readiness
groups, and the numeric score. It lists the observation(s) used as score
contributors and shows the contribution group, observed value, document range,
and source document/page. No diagnosis or new clinical recommendation is
shown.

**Result:** `Pass`
**Notes / evidence link:** Authenticated browser E2E on 2026-08-24. The drawer showed Metabolic 95/100 (Stable); the expanded panel showed `eh145-score-v1`, readiness group "fasting_glucose or hba1c — Ready (satisfied by hba1c)", contributor "Glucose 95/100 — Used for glycemia · 5 mmol/L · Document range 3.89–5.49" with `Page 1 · Exact source region`, snippet, and an "Open source document" link carrying `page=1` plus system/measurement/observation context. Screenshot captured during the run.

### EH145-UI-02: Follow contributor source evidence

**Precondition:** `EH145-UI-01` is available and a contributor in `EH145-01`
shows a source page.

1. Expand **How this assessment was calculated** for **Metabolic**.
2. Select **Open source document** for a listed contributor.
3. Inspect the document viewer page and the selected laboratory row.

**Expected result:** The document viewer opens the linked source document on the
reported page. The source text and exact region are shown when page-coherent
geometry exists; otherwise the UI labels the evidence as page-only or unavailable
rather than drawing a false highlight.

**Result:** `Pass`
**Notes / evidence link:** The contributor link opened `/app/documents/…?…&page=1`; the document review workspace loaded with "Measurement context: glucose_serum" and grouped the synthetic rows under Page 1 / Page 2. The synthetic fixture has no rendered PDF file, so the workspace shows page-only rows; the exact-rectangle rendering contract is covered by `pnpm test:eh162` and the panel's "Exact source region" label.

### EH145-UI-03: Explain a null score without inventing an average

**Precondition:** `EH145-03` is processed and the assessment is successful.

1. Go to **Health Profile**.
2. Open the **Metabolic** system details.
3. Expand **How this assessment was calculated**.

**Expected result:** The system remains visible, but its score is shown as
unavailable. The panel identifies the missing readiness group and shows no
numeric contributor average. It does not substitute a partial score or claim
that the missing marker is normal.

**Result:** `Pass`
**Notes / evidence link:** With only glucose seeded, Metabolic showed "-", the panel showed "No numeric score is available from the current readiness evidence", readiness "fasting_glucose or hba1c — Missing", "No observations contributed to a numeric score", and the glucose row excluded with `score_not_available · required_readiness_group_incomplete`. Screenshot captured during the run.

### EH145-UI-04: Review excluded observations globally

**Precondition:** `EH145-02` is processed, the assessment is successful, and at
least one result is excluded before score calculation.

1. Go to **Health Profile**.
2. Expand **Observations not used in a score**.
3. Review the exclusion reason and select **Open source document** when a source
   is available.

**Expected result:** The result remains listed with its name, value/text, date,
reason, and source context. The reason is concrete (for example, incomplete
resolution, non-numeric value, or missing reference range). Opening the source
never deletes, edits, or reclassifies the observation.

**Result:** `Pass`
**Notes / evidence link:** "Observations not used in a score" listed the unmapped row as "Resolution is incomplete · no_candidate" with source text and link, plus the glucose row as "Score unavailable until readiness is complete" in the null-score phase. Rows stayed factual; opening the source made no changes.

## Developer evidence required

- [x] `pnpm test:eh145` — synthetic fixtures prove stable algorithm version,
      deterministic contribution-group selection, contributor source metadata,
      duplicate-group exclusions, profile-level pre-projection exclusions, and
      null-score behavior.
- [x] `pnpm typecheck` — verifies the Health Profile/API/worker/UI provenance
      contract compiles.
- [x] `pnpm test:health-profile-lab-input` — verifies laboratory projection
      boundaries remain Registry-v2-gated and preserve source metadata.
- [x] `pnpm test:eh162` — verifies source-region parsing and page-coherent
      rendering predicates used by source evidence links.
- [x] `pnpm test:eh123` — verifies request-time/queued assessment snapshot
      wiring and immutable assessment persistence contract checks.
- [x] `pnpm smoke:eh145` — renders the real panel and drawer with fixtures; asserts algorithm version, readiness groups, contributor card with source page/exact-region labels, page-only labeling, machine exclusion reasons, null-score state, legacy no-provenance states, and drawer integration.
- [x] `pnpm test:eh123-db` (Supabase local Docker) — 20/20 pgTAP assertions pass for claim/complete/version persistence; the receipt assertion was scoped to the test's own dependency event because the shared local database holds committed receipts from other profiles.
- [x] Authenticated browser E2E — full pass for UI-01..UI-04 against local Supabase with a synthetic magic-link account; synthetic data was removed afterwards (document archived, observations and job deleted; append-only normalization revisions remain by design).
- [x] Database migration/RPC evidence — no migration or persistence RPC change
      was required; the existing immutable assessment-version payload persists
      the additive provenance fields.

## Out of scope or not manually testable yet

- Legacy cached assessment payloads without provenance remain readable; they do
  not receive fabricated explanations until a new assessment is generated.
- The panel does not provide a diagnosis, treatment advice, automated review
  decision, or a manual correction workflow.
- Automatic catalog changes, new assessment bindings, and document reprocessing
  are not part of EH-145.
- Manual UI results above were executed and passed on 2026-08-24; the exact-rectangle overlay on a rendered PDF page remains covered by `pnpm test:eh162` because the synthetic fixture carries no rendered PDF file.
