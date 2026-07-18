# Roadmap Cleanup: Fix Dependency Cycles, Rebalance Sprints and Align Status Model

## Why

The EasyHealth GitHub roadmap currently contains dependency cycles between roadmap issues (EH-117 ↔ EH-118, EH-119 ↔ EH-120, EH-121 → EH-121), mingles verification status with record lifecycle status in EH-120, leaves EH-102 open despite completed work, and overloads early/late sprints. This makes the roadmap unreliable as a planning source of truth and risks miscommunicating state semantics to implementers.

## What Changes

- Fix dependency cycles in Sprint 3 and Sprints 7–8 issues so the roadmap becomes a strict DAG.
- Separate resolver outcome, verification status and record lifecycle in EH-120.
- Close EH-102 as completed and reparent the ALT partial-resolution regression (#63) under EH-109 with EH-112 as downstream consumer.
- Rebalance Sprint 1 and Sprint 2 into conceptual half-sprints (1A/1B, 2A/2B) with reduced story-point loads.
- Swap Sprint 5 (Knowledge Base) and Sprint 6 (Health Profile/Assessment) so Health Profile/Assessment precedes Knowledge Base.
- Treat Sprints 7–8 as release-phase roadmaps rather than committed two-week sprints.
- Update the roadmap JSON/source-of-truth file to match the final dependency graph and sprint assignments.

## Capabilities

### New Capabilities

- `roadmap-governance`: defines ownership, validation and change workflow for roadmap issue dependencies, sprint assignments and lifecycle status hygiene.

### Modified Capabilities

- `biomarker-catalog`: clarifies resolver outcome semantics (`partial` for missing specimen/context) and ownership of the ALT-without-specimen regression case.
- `observation-identity`: separates `resolution_status`, `verification_status` and `record_status` in EH-120 implementation guidance.

## Risks

- **BREAKING**: Closing EH-102 and moving #63 may break existing links or comments that assume EH-102 is still open. All related issues will be relinked.
- Reordering sprints changes due dates and milestone labels; external documents referencing old sprint dates must be updated separately.

## Acceptance Criteria

- Roadmap issue dependency graph has zero cycles.
- EH-120 describes three independent status fields.
- EH-102 is closed as completed.
- #63 references EH-109 as primary owner and EH-112 as secondary consumer.
- Sprint 1 and Sprint 2 are rebalanced to ≤28 story points per half.
- Sprints 5 and 6 are swapped without introducing new dependency cycles.
