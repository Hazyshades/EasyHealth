## 1. Branch and planning baseline

- [x] 1.1 Rebase or reset `Hazyshades/eh-108` onto current `origin/master`
      before applying documentation/hygiene edits.
- [x] 1.2 Confirm OpenSpec change
      `eh-108-registry-v2-hard-cutover-adr-and-launch-checklist` validates
      with `openspec validate --strict`.

## 2. Registry ADR and index

- [x] 2.1 Create `registry/adr/0001-registry-v2-hard-cutover.md` with
      decision, rejected dual-runtime alternative, maturity/resolver policy,
      ownership, version axes, consequences, dependencies, and non-goals.
- [x] 2.2 Include the required Mermaid logical/physical schema covering
      `Analyte → MeasurementDefinition` and
      `ExtractedBiomarker → NormalizationRevision → Observation`, stating
      TypeScript catalog ownership and DB keys/versions/digest/provenance
      without catalog FK tables; do not add an ASCII duplicate.
- [x] 2.3 Explicitly list EH-104 as a direct dependency, EH-106 as
      corpus/manifest/approvals source, and EH-107 as separate CBC evidence.
- [x] 2.4 Create `registry/README.md` linking ADR, launch checklist,
      candidate-release package, CBC evidence, superseded rollout stub, and
      QA folders.

## 3. Procedural launch checklist and QA

- [x] 3.1 Create `registry/launch-cutover-checklist.md` as a purely
      procedural guide with separate Fresh/disposable and Retained scenarios,
      commands, smoke checks, evidence blanks, and forward-only rollback.
- [x] 3.2 Document the non-circular reset rule: Fresh uses
      `supabase db reset`; Phase B reset RPC only after migration 034 and only
      with disposable flags; Retained dirty preflight aborts.
- [x] 3.3 Create `QA/eh-108/checklist.md` covering explain / run / interpret,
      including the expected 2 resolved / 42 partial reading.
- [x] 3.4 Leave blanks in QA/eh-108 for final post-merge `master` SHA, CI
      verify URL, CI database URL, catalog digest, and candidate
      input/manifest/report hashes; do not accept `291087a` as final evidence.

## 4. Hygiene patches in scope

- [x] 4.1 Replace `registry/measurement-registry-rollout.md` with a
      superseded stub pointing to the ADR and launch checklist; remove active
      shadow/promote/v1 rollback instructions.
- [x] 4.2 Update `.github/workflows/measurement-registry.yml` push branches
      from `main` to `master` and add `workflow_dispatch`.
- [x] 4.3 Correct Phase B operator reset guidance wherever EH-108 touches it
      so reset RPC is not documented as a pre-034 bootstrap path.
- [x] 4.4 Change the default changelog string in
      `src/lib/biomarkers/measurement-registry-release.ts` from Registry 2.1
      to Registry 2.0.

## 5. Validation and closeout evidence

- [x] 5.1 Run `openspec validate eh-108-registry-v2-hard-cutover-adr-and-launch-checklist --strict`.
- [x] 5.2 After implementation merge, record CI evidence against the final
      `master` SHA in `QA/eh-108/checklist.md`.
- [x] 5.3 Verify no task introduced a new `033 + dirty` harness, approvals
      redesign, mass roadmap JSON sync, `/docs` repair, or EH-109…EH-120
      product work.
