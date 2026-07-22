## 1. Fix dependency cycles in GitHub issues

- [x] 1.1 Update EH-118 Dependencies to `EH-103`
- [x] 1.2 Update EH-117 Dependencies to `EH-112, EH-113, EH-118`
- [x] 1.3 Update EH-120 Dependencies to `EH-104, EH-112`
- [x] 1.4 Update EH-119 Dependencies to `EH-118, EH-120`
- [x] 1.5 Update EH-121 Dependencies to `EH-119, EH-120`
- [x] 1.6 Update EH-150 Dependencies to `EH-149`
- [x] 1.7 Update EH-151 Dependencies to `EH-148, EH-149`
- [x] 1.8 Update EH-152 Dependencies to `EH-151`
- [x] 1.9 Update EH-154 Dependencies to `EH-152, EH-153`
- [x] 1.10 Update EH-157 Dependencies to `None`
- [x] 1.11 Update EH-158 Dependencies to `EH-155, EH-156, EH-157`
- [x] 1.12 Update EH-159 Dependencies to `EH-155, EH-156, EH-157`
- [x] 1.13 Update EH-160 Dependencies to `EH-124, EH-147, EH-155, EH-157`
- [x] 1.14 Update EH-161 Dependencies to `EH-154, EH-158, EH-159, EH-160`
- [x] 1.15 Run dependency-cycle validation and confirm zero cycles

## 2. Separate verification and lifecycle status in EH-120

- [x] 2.1 Rewrite EH-120 goal to define three independent fields
- [x] 2.2 Update EH-120 checklist around `resolution_status`, `verification_status` and `record_status`
- [x] 2.3 Remove `rejected` and `superseded` from `verification_status`
- [x] 2.4 Reference EH-104 for resolver↔verification separation

## 3. Resolve EH-102 and reparent #63

- [x] 3.1 Close EH-102 as completed
- [x] 3.2 Add `Related roadmap items` block to #63 naming EH-109 primary and EH-112 secondary
- [x] 3.3 Verify EH-102 checklist and OpenSpec change status are both complete

## 4. Rebalance early sprints

- [x] 4.1 Assign Sprint 1 issues to Sprint 1A/1B conceptually
- [x] 4.2 Assign Sprint 2 issues to Sprint 2A/2B conceptually
- [x] 4.3 Validate each half-sprint is ≤28 story points
- [x] 4.4 Update issue labels/milestones/title prefixes to reflect half-sprints if possible

## 5. Swap Sprint 5 and Sprint 6

- [x] 5.1 Move Health Profile/Assessment issues (EH-141–EH-147) to Sprint 5
- [x] 5.2 Move Knowledge Base issues (EH-133–EH-140) to Sprint 6
- [x] 5.3 Update sprint labels and due dates
- [x] 5.4 Re-run cycle validation to ensure no new cycles

## 6. Clarify Sprints 7–8 as release phases

- [x] 6.1 Add a note to Sprint 7 and Sprint 8 descriptions that they are release-phase roadmaps
- [x] 6.2 Optionally split into 7A/7B and 8A/8B with reduced scope per phase
- [x] 6.3 Validate combined Sprint 7 and Sprint 8 scope is realistic as phase planning

## 7. Update JSON roadmap source of truth

- [x] 7.1 Export all GitHub issues to JSON after all edits are done
- [x] 7.2 Validate JSON dependencies match the target graph
- [x] 7.3 Commit the updated JSON roadmap file to the repository
- [x] 7.4 OpenSpec archive this change after implementation is complete
