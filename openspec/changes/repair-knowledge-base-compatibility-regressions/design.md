## Context

EH-135 added a panel Knowledge Base route and a `Knowledge` breadcrumb label on top of the EH-133/EH-134 baseline. A comparison with `origin/master` found two implementation regressions: `src/lib/knowledge-base/index.ts` no longer re-exports the existing `measurementEducationArticleSchema`, and `src/lib/health-navigation.ts` no longer maps `/app/biomarkers` to `Biomarkers`. The current EH-131/EH-133/EH-134/EH-135 checks pass, but none asserts those exact boundaries. The repair must be independently reviewable and must not reopen the panel-content scope.

## Goals / Non-Goals

**Goals:**

- Restore the EH-134 measurement schema's existing public module export exactly as it existed in the master baseline.
- Restore the existing Biomarkers route label while retaining labels for the new Knowledge index and nested panel routes.
- Add focused regression assertions at the owning verification boundaries so future Knowledge changes cannot silently remove either contract.
- Preserve all EH-135 panel behavior, including its explicit `in_review` preview state and exact-key result projection.

**Non-Goals:**

- Do not redesign or duplicate the canonical article schemas.
- Do not add an export alias, adapter, barrel module, or new public API name.
- Do not change Knowledge Base catalog behavior, panel content, result parsing, Registry data, resolver or assessment behavior, persistence, API routes, or UI styling.
- Do not add a database regression suite or regenerate Registry documentation; this repair changes neither Registry semantics nor generated Registry sources.

## Decisions

### 1. Restore the original public export instead of introducing a compatibility alias

Add `measurementEducationArticleSchema` back to the existing value export list in `src/lib/knowledge-base/index.ts`, next to the other shared article schemas. The canonical implementation remains `src/lib/knowledge-base/types.ts`; the repair only restores the public barrel surface. A new alias or second schema would create competing names and violate the EH-133 shared-contract boundary.

### 2. Preserve both route-label branches in the existing helper

Restore the exact `/app/biomarkers` branch in `healthRouteLabel` and keep the EH-135 Knowledge branch for `/app/knowledge` and its descendants. The Biomarkers check remains before the generic fallback; no callsite or breadcrumb component changes are needed because `DocumentViewer` already consumes this helper.

### 3. Put regression assertions in the existing owning verifiers

Extend `scripts/verify-eh134-knowledge-base.ts` to import the schema through `../src/lib/knowledge-base` and validate a synthetic published measurement article with it. Extend `scripts/verify-eh131-health-navigation.ts` to assert both the Biomarkers label and the nested Knowledge label. This tests the public boundaries directly while keeping EH-133/EH-134 and navigation ownership clear; a source-text assertion alone would not detect a broken export or returned label.

### 4. Keep verification pure and scoped

Run the focused EH-131, EH-133, EH-134, and EH-135 verifiers, typecheck, production build, and strict OpenSpec validation. No Supabase fixture, migration, Registry documentation generation, or external service is required because the changed contracts are local pure modules.

## Risks / Trade-offs

- A public export regression may only affect downstream consumers, so the new EH-134 assertion intentionally imports through the barrel rather than directly from `types.ts`.
- A route-label regression is visible only on context-aware navigation such as Biomarkers → document viewer; the EH-131 assertion uses a Biomarkers path with query context and also protects the new Knowledge label.
- The repair remains separate from EH-135 so the functional change's completed artifacts stay intact; this means the two changes must be validated together before final release.
- The broader EH-135 manual authenticated UI checks remain subject to the existing fixture/session limitation; this repair does not remove that QA blocker.
