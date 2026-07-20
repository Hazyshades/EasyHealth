---
name: roadmap-qa-checklists
description: Create and maintain tester-friendly QA checklists for EasyHealth roadmap OpenSpec changes. Use whenever implementing, applying, completing, or materially changing an EH-xxx roadmap proposal, or when asked to create or update manual QA coverage for a roadmap item.
---

# Roadmap QA Checklists

## Overview

Make the roadmap's acceptance criteria testable through the product interface.
Keep internal contracts visible as developer evidence rather than pretending a
tester can verify them in the UI.

## Required workflow

1. Identify the roadmap id and read its OpenSpec proposal, design, tasks, and
   the affected interface before drafting the checklist.
2. Create or update `QA/eh-xxx/checklist.md`. Start from
   `QA/_templates/roadmap-checklist.md` when the checklist does not exist.
3. Preserve useful completed checks. Add or revise checks when implementation
   scope, deferred work, or visible behavior changes.
4. Keep the manual section executable by a non-developer. Every test must have
   safe preconditions, synthetic or de-identified data, numbered actions, and
   an observable expected result.
5. Put migration, DB constraints, race conditions, static scans, and API-only
   behavior under **Developer evidence required**. State who supplies the
   evidence and what proves the contract.
6. Before declaring the roadmap work complete, verify the checklist exists,
   matches the delivered scope, and explicitly names deferred or unavailable
   UI. Do not mark unexecuted checks as passed.

## Interface-first rules

- Describe screens and controls as the tester sees them, for example
  **Documents**, **Extracted biomarkers**, **Study findings**, **Reprocess**,
  **Biomarkers**, and **Health Profile**.
- Use plain language in the manual path. Explain a technical term once if it is
  unavoidable; never require SQL, logs, or browser developer tools there.
- Include the normal flow, a meaningful negative or incomplete-data flow, a
  retry/reprocess flow when the change writes data, and regression checks for
  affected downstream screens.
- For a feature without a user interface, add a clear **Not manually testable
  yet** note and a developer-evidence item. Never invent a screen or expected
  user action.
- Mark deferred roadmap work as **Out of scope** so it cannot create false
  failures for the current item.

## Completion gate

Before marking an EH roadmap item complete, confirm all of the following:

- [ ] `QA/eh-xxx/checklist.md` exists and identifies the roadmap scope.
- [ ] The manual checks are understandable without repository knowledge.
- [ ] Required test fixtures contain no real patient data.
- [ ] Non-UI contracts have an evidence request or automated test reference.
- [ ] Deferred work and unavailable UI are named explicitly.
- [ ] Results are recorded only after execution as pass, fail, blocked, or not
  applicable with a reason.

Follow the repository-wide `AGENTS.md` Roadmap QA checklists rule as the
enforcement point for this workflow.
