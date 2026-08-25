## Context

The Health Profile derives score readiness from reviewed Registry 2.0 assessment bindings. `readinessGroup` currently identifies required alternatives, while `scoreRole`, `coversConfidence`, and `contributionGroup` express independent policies. `evaluateSystemScoreReadiness` accepts a scoreable named system only when every derived group has a numeric core observation with a document-provided reference bound and matching reviewed specimen. `inflammation` is separately declared non-scoreable.

EH-141 must make that policy auditable: each named system needs explicit groups and rationale, optional/context-only measurements must remain unable to unlock readiness, and the approval boundary must not be mistaken for a diagnostic or clinical recommendation.

## Goals / Non-Goals

**Goals:**
- Publish one canonical policy table for cardiovascular, metabolic, thyroid, liver, kidney, blood, nutrients, and inflammation.
- Keep Registry 2.0 reviewed assessment bindings as the runtime source of group membership.
- Add an executable contract for group completeness, alternatives, context-only exclusions, and inflammation's factual-only state.
- Give Issue #41 a concise sign-off matrix and Registry documentation/Wiki publication evidence.

**Non-Goals:**
- Change measurement-definition identity, aliases, specimen/unit handling, reference-range behavior, persistence, or score formulas.
- Infer clinical context such as fasting status, pregnancy, age, assay interference, or diagnosis.
- Present the readiness threshold as medical advice, a diagnosis, or a request to order tests.
- Claim a clinical approver's external sign-off without evidence.

## Decisions

### 1. Preserve reviewed bindings as the runtime authority

`readinessGroup` on reviewed compatible assessment bindings remains the only source from which runtime readiness groups are derived. A separate duplicate runtime table would drift from the Registry and silently change the score gate. The new policy documentation names the resulting groups, their technical rationale, alternatives, and exclusions; the contract runner compares runtime output to the approved table.

Alternative considered: a second hard-coded `scoreRequiredGroups` registry. Rejected because it would require two edits for every binding change and create ambiguity over which source authorizes scoring.

### 2. Define context-only by absence from readiness groups

A reviewed input is context-only for readiness when it is not a member of a system's required group, regardless of whether it is `core`, `extended`, or coverage-flagged. It may remain visible, contribute only through its permitted contribution policy, or affect data confidence; it cannot satisfy a missing readiness group. This preserves the independent meanings of score role, coverage, readiness, and contribution.

### 3. Make the approval table human-readable and the runner normative

`docs/05-data/score-required-groups.md` records required groups, approved alternatives, technical rationale, exclusions, and a sign-off matrix. A focused `verify-eh141-score-required-groups.ts` imports the runtime boundary and proves the documented policy and readiness behavior. The runner is the regression guard; generated catalog pages remain derived inventory, not the rationale source.

### 4. Treat inflammation as an explicit non-scoreable system

Inflammation has no required groups and must return `non_scoreable`, never `scoreable` because an empty list is vacuously complete. The policy document labels it factual-only and records its current exception rather than inventing a minimum set.

## Risks / Trade-offs

- **Clinical policy needs external approval.** The repository can record accountable roles and technical evidence but cannot manufacture a Clinical Product decision. The sign-off matrix will state the current evidence and any pending approver explicitly.
- **Binding edits can make documentation stale.** The focused runner compares the approved table to Registry-derived groups; Registry generated-doc drift checks add a second guard.
- **A context-only marker may be useful evidence.** Keeping it displayed and potentially coverage/contribution-eligible preserves that value without weakening readiness.
- **Strict completeness can leave more systems unscored.** That is intentional: `null` is the insufficient-evidence state, not `0` or a soft fallback.
