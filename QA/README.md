# QA checklist package

This folder contains manual QA checklists for EasyHealth roadmap work. Each
`eh-xxx` folder belongs to one roadmap item and is kept even after the item is
delivered, so regression coverage remains easy to find.

## How to use a checklist

1. Open the checklist for the roadmap item being tested.
2. Prepare only the listed synthetic or de-identified documents and test
   account.
3. Run each interface check in order and record `Pass`, `Fail`, `Blocked`, or
   `N/A` with a short reason.
4. Treat **Developer evidence required** as a hand-off request, not a manual
   test. Ask the developer or QA lead for the named automated-test or release
   evidence.

## Rules for authors

- Write for a tester, not for a database administrator. State what to click,
  what to see, and what makes the result correct.
- Never use real patient documents or identifiers as test data.
- Do not claim an internal migration, constraint, or concurrency guarantee was
  checked through the UI. Put it in the evidence section.
- If a roadmap deliberately defers a screen, say so under **Out of scope**.
- For every implemented `EH-xxx` OpenSpec roadmap change, create or update its
  checklist before the change is declared complete. This is also enforced in
  `AGENTS.md`.

Start a new checklist from
[`_templates/roadmap-checklist.md`](_templates/roadmap-checklist.md).
