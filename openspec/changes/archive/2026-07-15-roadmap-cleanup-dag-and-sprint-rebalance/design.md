## Context

The roadmap issues live in GitHub and are mirrored/exported to a JSON source of truth. The current graph contains dependency cycles, overloaded sprints and confusing status semantics. This design describes the exact edits needed to produce a clean DAG and consistent sprint assignments.

## Goals / Non-Goals

**Goals:**
- Break all dependency cycles in the roadmap issue graph.
- Separate resolver outcome, verification trust and record lifecycle in EH-120.
- Close EH-102 as completed and attach the ALT-without-specimen regression (#63) to EH-109.
- Rebalance Sprint 1 and Sprint 2 into half-sprints with realistic loads.
- Swap Sprint 5 and Sprint 6 ordering so Health Profile/Assessment precedes Knowledge Base.
- Treat Sprints 7 and 8 as release phases, not strict two-week sprints.
- Update the JSON roadmap artifact to match GitHub issues.

**Non-Goals:**
- Changing application source code or behavior.
- Adding new product features.
- Modifying OpenSpec changes other than this roadmap cleanup.

## Decisions

### Dependency notation

Use `EH-X -> EH-Y` to mean **EH-X depends on EH-Y**. This matches the GitHub issue `Dependencies:` field semantics.

### Final dependency targets

The target graph is:

- EH-117 -> EH-112, EH-113, EH-118
- EH-118 -> EH-103
- EH-119 -> EH-118, EH-120
- EH-120 -> EH-104, EH-112
- EH-121 -> EH-119, EH-120
- EH-150 -> EH-149
- EH-151 -> EH-148, EH-149
- EH-152 -> EH-151
- EH-154 -> EH-152, EH-153
- EH-157 -> Dependencies: None
- EH-158 -> EH-155, EH-156, EH-157
- EH-159 -> EH-155, EH-156, EH-157
- EH-160 -> EH-124, EH-147, EH-155, EH-157
- EH-161 -> EH-154, EH-158, EH-159, EH-160

All other issue dependencies remain unchanged.

### EH-120 status model

Replace the flat list with three independent fields:

- `resolution_status`: `resolved | partial | ambiguous | unmapped`
- `verification_status`: `pending | user_verified | manually_corrected`
- `record_status`: `active | rejected | superseded`

### EH-102 and #63

EH-102 is closed as `completed` because all checklist items are done and the matching OpenSpec change is complete. Issue #63 remains open as a focused regression task under EH-109 (resolver rule for missing specimen → partial) with EH-112 as the secondary consumer (persist/display partial outcomes).

### Sprint rebalancing

- Sprint 1: split into **Sprint 1A** (catalog, schema, identity cutover) and **Sprint 1B** (runtime removal, fixtures, ADR).
- Sprint 2: split into **Sprint 2A** (resolver core and safety states) and **Sprint 2B** (CBC/glucose cases, trace, reprocessing).
- Each half-sprint targets ≤28 story points.
- Original Sprint 5 and Sprint 6 are swapped; labels and due dates move with the issues.

### JSON roadmap update

The JSON file is regenerated/exported from GitHub issues after all issue edits are complete. It becomes the authoritative snapshot once validated.

## Risks / Trade-offs

- Closing EH-102 may surprise team members who were using it as a parent issue. The new parent/child links in #63 and related items must be updated to compensate.
- Half-sprint labels may not be supported natively by GitHub milestones; use labels or title prefixes if milestones cannot represent half-sprints.
- Reordering Sprints 5 and 6 changes external communication; release notes and milestone names must be updated.
