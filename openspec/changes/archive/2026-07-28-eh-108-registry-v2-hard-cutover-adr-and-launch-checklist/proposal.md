## Why

Sprint 1 Registry 2.0 runtime cutover is already implemented (EH-102…EH-107),
but the canonical decision record and reproducible launch/ops path are still
scattered across OpenSpec designs, QA folders, and a stale
`measurement-registry-rollout.md` that still teaches shadow/dual-runtime
rollback. Without EH-108, a new engineer cannot explain the single-runtime
model, run Fresh vs Retained cutover correctly, or interpret launch evidence.
Three hygiene gaps also make cutover unverifiable on `master`: CI listens to
`main`, Phase B disposable reset is documented before migration 034 creates
the RPC, and a changelog string still says “Registry 2.1”.

## What Changes

- Publish a stable Registry 2.0 hard-cutover ADR under `registry/adr/` that
  records the single-runtime decision, rejected dual-runtime alternative,
  maturity/resolver policy, ownership boundaries, version axes, and explicit
  non-goals for EH-109…EH-120.
- Add a Mermaid logical/physical schema and ownership diagram covering
  `Analyte → MeasurementDefinition` and
  `ExtractedBiomarker → NormalizationRevision → Observation`, stating that the
  catalog lives in TypeScript while the database stores keys, versions,
  digests, and provenance without catalog FK tables.
- Add `registry/README.md` as the registry documentation index and a fully
  procedural `registry/launch-cutover-checklist.md` with separate **Fresh /
  disposable** and **Retained** scenarios.
- Replace `registry/measurement-registry-rollout.md` with a superseded stub
  that points at the ADR and launch checklist and forbids shadow/promote /
  v1 rollback instructions.
- Add `QA/eh-108/checklist.md` so an engineer can explain states, execute a
  clean cutover, and correctly interpret candidate evidence
  (2 concrete resolved / 42 intentional partial).
- Fix Measurement Registry CI push trigger from `main` to `master` and add
  `workflow_dispatch`.
- Correct the circular Phase B reset path in operator docs: Fresh uses
  `supabase db reset`; Retained uses preflight abort; Phase B reset RPC is
  only valid after migration 034 exists, and only on disposable envs with
  explicit flags.
- Correct the default catalog changelog string from “Registry 2.1 …” to
  “Registry 2.0 …”.
- Record CI evidence against the **final post-EH-108 `master` SHA**, not
  baseline `291087a`.

## Capabilities

### New Capabilities

- `registry-v2-hard-cutover-adr`: Canonical hard-cutover architecture decision
  record, entity/ownership Mermaid model, maturity and resolver policy,
  dependency/evidence ownership, and version-axis documentation.
- `registry-v2-launch-cutover-ops`: Procedural Fresh/Retained launch checklist,
  registry index, superseded rollout stub, QA/eh-108 acceptance evidence, CI
  `master` trigger hygiene, Phase B reset-path correction, and Registry 2.0
  changelog string alignment.

### Modified Capabilities

- None. This repository has no primary `openspec/specs/` capability baseline
  for Registry cutover docs; EH-108 records its contracts as change-local
  specifications.

## Impact

- **Domain:** documentation / release-safety for documents + health-profile
  Registry 2.0 cutover; not a product runtime behavior change beyond tiny
  hygiene fixes.
- **Dependencies:** EH-102, EH-103, **EH-104** (direct), EH-105, EH-106
  (corpus/manifest/approvals source), EH-107 (separate CBC evidence).
- **Files:** `registry/adr/0001-registry-v2-hard-cutover.md`,
  `registry/README.md`, `registry/launch-cutover-checklist.md`,
  `registry/measurement-registry-rollout.md`, `QA/eh-108/checklist.md`,
  `.github/workflows/measurement-registry.yml`,
  Phase B / operator reset documentation,
  `src/lib/biomarkers/measurement-registry-release.ts` changelog default.
- **Out of scope:** new `033 + dirty` DB harness, approvals redesign, mass
  roadmap JSON sync, `/docs` tree repair (#75), and EH-109…EH-120 product work.
