## Context

EH-140 is the P0 quality gate for the Knowledge Base MVP. The roadmap dependencies (EH-134 biomarker articles, EH-135 panel/CBC education, and EH-138 index/search/cross-links) are not present in this checkout yet: there is no Knowledge Base route, component directory, or content directory to execute against. The current repository does have document-sourced reference-range handling in `src/lib/health-profile-*`, a user-data source model, shared layout primitives, and a documentation link verifier; none of those should be replaced by educational content.

The implementation therefore has two responsibilities:

1. provide deterministic, dependency-free checks that can run now against safe in-memory fixtures and against future Knowledge Base files; and
2. provide a tester-facing record that refuses to convert unavailable dependency UI into a passing result.

The gate is a review of content and presentation, not a second clinical interpretation engine.

## Goals / Non-Goals

**Goals:**

- Detect diagnostic, certainty, and treatment/test-order claims in Knowledge Base copy before publication review.
- Detect reference-range-like fields and text in educational payloads, and protect the assessment boundary so only document-sourced ranges remain eligible for assessment.
- Provide deterministic local-link and conservative JSX accessibility checks for any EH-134/EH-135/EH-138 surface added later.
- Keep source visibility and review evidence in the QA checklist, with explicit `Blocked` results when the required surface or supported assistive-technology environment is unavailable.
- Wire the automated contract into the existing pnpm/CI verification conventions without adding a runtime dependency or changing existing assessment behavior.

**Non-Goals:**

- Implementing the Knowledge Base article schema, biomarker/panel pages, index, search, or related-measurement graph from EH-133–EH-138.
- Providing external laboratory ranges, universal "normal" thresholds, diagnoses, treatment advice, test-order advice, or score inputs.
- Replacing clinical-product/editorial review with a regex scan or claiming that static checks prove accessibility.
- Changing database tables, APIs, observations, resolver behavior, Health Profile scoring, or private-data authorization.
- Marking manual mobile or screen-reader checks as passed in an environment that is not available.

## Decisions

### Keep the safety policy independent from the future article schema

Add `src/lib/knowledge-base/safety-policy.ts` with a small input boundary containing an identifier, rendered copy, and optional metadata. It returns structured findings with a stable code, rule, and excerpt. The module does not define or persist article records, so EH-133 can choose its own content schema while EH-140 remains reusable by biomarker and panel pages.

**Rationale:** EH-140 is downstream of the content schema and must not create a competing persistence model. A narrow audit boundary also makes unit fixtures deterministic and avoids coupling the review gate to Supabase.

**Alternative considered:** Duplicate the planned article type in the safety module. Rejected because it would create a second source of truth and make the gate block schema evolution.

### Fail closed on claim and range evidence, but report absent surfaces separately

The policy returns findings for prohibited claim patterns, range-like text, and forbidden range/assessment metadata keys. The CLI exits non-zero for findings. If no Knowledge Base roots exist, it prints a dependency-blocked result and exits successfully only for the baseline contract suite; a `--require-surface` option is available for a release invocation and exits non-zero until EH-134/EH-135/EH-138 provide files.

**Rationale:** The current branch must retain a runnable verification suite without pretending that unbuilt UI was audited. Release owners need a strict mode that cannot be accidentally accepted on an empty tree.

**Alternative considered:** Treat an empty scan as green. Rejected because it would satisfy the exact release gate with zero content reviewed.

### Treat document ranges as the only assessment range source

The audit checks that Knowledge Base payloads do not carry reference-range fields and adds a source-boundary regression around the existing Health Profile input path. The test fixture proves that document observation `ref_low`/`ref_high` values remain the assessment inputs while educational text is not consulted. No imported Knowledge Base module is added to Health Profile code.

**Rationale:** A source-boundary test directly protects the issue acceptance criterion without changing the established assessment implementation.

**Alternative considered:** Add a runtime fallback that ignores educational ranges. Rejected because accepting the data and discarding it later still permits accidental coupling and makes provenance unclear.

### Use static checks as a supplement, not as accessibility certification

The CLI scans future Knowledge Base JSX/TSX files for high-confidence hazards: click handlers on non-interactive elements, images without alternative text, interactive elements marked hidden, and missing focus-visible affordances on locally declared controls. The checklist remains the authority for keyboard, screen-reader, viewport, focus order, reflow, and mobile evidence.

**Rationale:** Static checks catch regressions cheaply, while the issue explicitly requires actual accessibility and mobile review. A regex-only result must never be presented as a substitute for assistive-technology execution.

**Alternative considered:** Add axe or another browser dependency. Rejected for this review gate because no Knowledge Base UI exists in the checkout and an automated scan would not prove the required authenticated, responsive interactions.

### Reuse the repository's local-link model

The EH-140 link check resolves relative Markdown links against each scanned file, recognizes anchors, mail links, and HTTP(S) links as external, and verifies only tracked local targets or tracked directories. It does not make network calls. Broken external URLs remain a manual/source-review check with the exact URL and review date recorded in `QA/eh-140/checklist.md`.

**Rationale:** This matches `scripts/verify-documentation-links.mjs`, is deterministic offline, and avoids CI flakiness or accidental requests to clinical websites.

## Risks / Trade-offs

- **[Dependencies remain absent]** → The automated fixture contract can pass, but content/UI checks are recorded as `Blocked`; `--require-surface` prevents release acceptance on an empty surface.
- **[Claim patterns produce a false positive]** → Emit the exact excerpt and rule, then require clinical/editorial disposition or a narrowly scoped rule update; never add a broad allowlist that hides a claim.
- **[Static JSX scan misses a real accessibility defect]** → Keep manual keyboard, screen-reader, mobile, and visual checks mandatory in the checklist; static output is developer evidence only.
- **[A source link is externally broken]** → Record it as a checklist failure with URL, response evidence, and replacement/review decision; the offline local-link check cannot certify remote availability.
- **[Future article schema uses a legitimate range field for document evidence]** → Keep that evidence in the private document/observation path, not in Knowledge Base payloads; update the dependency contract rather than weakening the educational boundary.

## Migration Plan

No production migration is required. Add the policy, verifier, package/CI wiring, and EH-140 checklist. When EH-134/EH-135/EH-138 land, run the verifier with `--require-surface`, execute every manual case using synthetic or de-identified data, attach accessibility/source/link evidence, and only then update the checklist and roadmap issue. Rollback is a normal code revert; no stored data changes.
