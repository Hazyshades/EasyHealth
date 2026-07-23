## ADDED Requirements

### Requirement: Registry documentation index exists
The project SHALL provide `registry/README.md` that links the ADR, launch
cutover checklist, candidate-release package, CBC evidence, superseded rollout
stub, and relevant QA folders.

#### Scenario: Registry docs are discoverable
- **WHEN** an engineer opens `registry/README.md`
- **THEN** they can navigate to the ADR and the procedural launch checklist
  without searching OpenSpec archives

### Requirement: Procedural Fresh and Retained launch checklist
The project SHALL provide `registry/launch-cutover-checklist.md` as a purely
procedural operator guide with separate Fresh/disposable and Retained
scenarios, exact commands, smoke checks, evidence blanks, and forward-only
rollback steps. The checklist SHALL NOT restate ADR rationale.

#### Scenario: Fresh disposable cutover
- **WHEN** the environment is declared Fresh/disposable
- **THEN** the checklist orders stop jobs → `supabase db reset` → deploy web
  and worker → clean preflight → smoke → evidence capture
- **AND** it forbids calling the Phase B reset RPC before migration 034 exists

#### Scenario: Retained cutover aborts on dirty preflight
- **WHEN** the environment is Retained and `pnpm preflight:eh104` is dirty
- **THEN** the checklist requires ABORT with no destructive reset and no forced
  enforcement apply

### Requirement: Phase B reset path is non-circular
Operator documentation updated by this change SHALL state that
`eh104_phase_b_reset_document_derived_laboratory_lineage` /
`pnpm reset:eh104-phase-b` is valid only after migration 034 exists, only on an
explicitly disposable environment, and only with
`EH104_PHASE_B_DISPOSABLE=1` and `EH104_PHASE_B_ALLOW_RESET=1`.

#### Scenario: Reset RPC is not a pre-034 bootstrap
- **WHEN** an operator reads the launch checklist or Phase B operator notes
  updated by EH-108
- **THEN** Fresh bootstrap uses full database reset rather than the Phase B
  reset RPC to create 034

### Requirement: Shadow dual-runtime rollout doc is superseded
`registry/measurement-registry-rollout.md` SHALL be replaced by a superseded
stub that points to the ADR and launch checklist and MUST NOT present
`off/shadow/promote` or Registry v1 feature-flag rollback as active guidance.

#### Scenario: Stale shadow instructions are inactive
- **WHEN** an engineer opens `registry/measurement-registry-rollout.md`
- **THEN** the page identifies itself as superseded and directs readers to the
  ADR and launch checklist
- **AND** it does not instruct enabling shadow or promote modes

### Requirement: QA/eh-108 acceptance checklist exists
The project SHALL provide `QA/eh-108/checklist.md` that verifies an engineer
can explain the state/version model, execute a clean cutover path, and
correctly interpret candidate evidence as 2 concrete resolved and 42
intentional partial rows.

#### Scenario: Evidence interpretation is correct
- **WHEN** a tester reviews candidate corpus output for the launch package
- **THEN** `QA/eh-108/checklist.md` treats 2 resolved / 42 partial as the
  expected recognition-safe pattern rather than a coverage failure

### Requirement: CI listens to master and supports dispatch
`.github/workflows/measurement-registry.yml` SHALL trigger on push to
`master` and SHALL support `workflow_dispatch`. It MUST NOT use `main` as the
push branch while `master` is the default branch.

#### Scenario: Post-merge tip can be verified
- **WHEN** EH-108 merges to `master`
- **THEN** Measurement Registry CI can run against that merge SHA through push
  or workflow dispatch

### Requirement: Final master SHA evidence is recorded
`QA/eh-108/checklist.md` SHALL record CI verify and database evidence against
the final post-EH-108 `master` SHA, including run URLs and current candidate
input/manifest/report hashes. Baseline commit `291087a` MUST NOT be used as
the acceptance evidence SHA.

#### Scenario: Acceptance uses post-change tip
- **WHEN** EH-108 acceptance evidence is completed
- **THEN** the recorded SHA is the merged EH-108 `master` tip rather than
  `291087a`

### Requirement: Catalog changelog label matches Registry 2.0
The default catalog manifest changelog string in
`src/lib/biomarkers/measurement-registry-release.ts` SHALL say Registry 2.0,
not Registry 2.1.

#### Scenario: Changelog string is aligned
- **WHEN** `buildMeasurementCatalogManifestRelease()` uses the default
  changelog
- **THEN** the text refers to Registry 2.0 measurement governance baseline

### Requirement: Out-of-scope work remains excluded
EH-108 implementation SHALL NOT add a new `033 + dirty` DB harness, redesign
candidate approvals, perform mass roadmap JSON synchronization, repair the
`/docs` tree, or implement EH-109…EH-120 product behavior.

#### Scenario: Scope stays bounded
- **WHEN** the EH-108 change is reviewed for scope
- **THEN** those deferred items are absent from delivered files and tasks
  marked complete
