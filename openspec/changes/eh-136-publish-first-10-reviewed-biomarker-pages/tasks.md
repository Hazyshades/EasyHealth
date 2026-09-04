## 1. Knowledge content contract

- [x] 1.1 Add the typed Knowledge Base article/source model and server-only loader for the versioned biomarker manifest and Markdown bodies.
- [x] 1.2 Add the EH-136 manifest with ten unique English published articles, reviewed metadata, source references, Registry definition keys, panel keys, and related measurement keys.

## 2. Reviewed biomarker content

- [x] 2.1 Author the blood article bodies for hemoglobin, hematocrit, WBC, platelets, and MCV using the approved safe section structure.
- [x] 2.2 Author the metabolic and thyroid article bodies for glucose, HbA1c, and TSH with contextual interpretation and no universal ranges or treatment instructions.
- [x] 2.3 Author the liver and kidney article bodies for ALT and combined creatinine/eGFR, preserving distinct Registry definitions and source context.

## 3. Public article template

- [x] 3.1 Implement the reusable accessible biomarker article template with Registry metadata cards, educational sections, source/review metadata, disclaimer, and private-data boundary.
- [x] 3.2 Add the public `/knowledge/biomarkers/[slug]` static route, metadata generation, static params, and not-found behavior for unpublished or unknown slugs.

## 4. Publication safety checks

- [x] 4.1 Add deterministic EH-136 validation for the exact roster, body sections, sources, review metadata, Registry/panel grounding, and unsafe-copy constraints.
- [x] 4.2 Expose the focused validation through `pnpm test:eh136` without changing resolver, assessment, or observation behavior.

## 5. QA and release evidence

- [x] 5.1 Add `QA/eh-136/checklist.md` with tester-executable public-page checks, synthetic-data preconditions, developer evidence, and explicit human-review limitations.
- [x] 5.2 Record that Registry canonical docs and Wiki outputs are intentionally unchanged because this change consumes reviewed definitions without changing Registry data or runtime behavior.
- [x] 5.3 Run focused validation, typecheck, build, and public-route smoke checks; record actual results in the QA checklist and change status.
