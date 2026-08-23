## Why

EH-141 requires an approved, auditable minimum evidence policy for current-state scores across the eight named body systems. The reviewed Registry currently encodes readiness groups, but the policy has no single rationale/sign-off surface and lacks an executable contract proving that context-only measurements cannot make a system scoreable.

## What Changes

- Add a canonical Health Profile score-readiness policy documenting the required group alternatives, technical rationale, context-only exclusions, and sign-off ownership for all eight named body systems.
- Make score-readiness evaluation consume an explicit approved system policy, rather than inferring a scoreable configuration from a possibly empty group list.
- Add a focused EH-141 contract runner that proves each scoreable system needs every required group, accepted alternatives satisfy only their own group, context-only inputs cannot satisfy readiness, and inflammation remains factual-only.
- Integrate the contract runner into the project verification scripts and create tester/developer evidence for the roadmap item.
- Regenerate Registry documentation and track local Wiki-render evidence on Issue #41; no assessment binding identity, observation persistence, scoring formula, or clinical recommendation changes.

## Capabilities

### New Capabilities
- `score-required-groups`: Approved technical readiness policy and enforced protection against context-only measurements satisfying a Health Profile score.

### Modified Capabilities
- None; no current main OpenSpec capability specifies this contract.

## Impact

- `src/lib/biomarkers/registry-v2-runtime.ts` and `src/lib/biomarkers/measurement-resolution.ts`: reviewed assessment-binding readiness policy source.
- `src/lib/health-systems.ts`: Health Profile readiness evaluation.
- `scripts/` and `package.json`: executable policy contract and command.
- `docs/` and generated Registry documentation: canonical policy and catalog projection.
- `QA/eh-141/checklist.md` and GitHub Issue #41: roadmap QA and Registry documentation tracking.
