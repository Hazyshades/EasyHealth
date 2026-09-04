## 1. Typed panel knowledge content

- [x] 1.1 Add the `PanelArticle` and source/member/subgroup result types with explicit preview and clinical-review metadata.
- [x] 1.2 Add the CBC article record with purpose, composition caveat, red-cell/white-cell/platelet subgroups, optional members, related markers, authoritative sources, and disclaimer.
- [x] 1.3 Add article lookup/validation helpers that reject unknown or duplicate Registry keys and role drift without importing assessment logic.

## 2. Exact-key result projection and article presentation

- [x] 2.1 Add the pure CBC result selector with deterministic ordering and source/document metadata preservation.
- [x] 2.2 Add the reusable panel article template with purpose, composition note, subgroup/member cards, neutral role labels, related markers, sources, disclaimer, and separate result-state rendering.
- [x] 2.3 Add loading, error/retry, empty, and populated user-result states without exposing status, reference-range interpretation, or diagnosis.

- [x] 3.1 Add the authenticated Knowledge index and CBC panel route under `/app/knowledge/panels/cbc`.
- [x] 3.2 Add the Knowledge navigation item, Library icon wiring, and breadcrumb route label while preserving existing navigation behavior.
- [x] 3.3 Link exact user CBC results to `/app/biomarkers` with safe measurement/observation context and a return path to the article.

## 4. Verification, QA, and release evidence

- [x] 4.1 Add deterministic EH-135 content/result/wiring fixtures and expose `pnpm test:eh135`.
- [x] 4.2 Create `QA/eh-135/checklist.md` with synthetic interface checks, developer evidence, and explicit EH-133/deferred limitations.
- [x] 4.3 Run focused verification, typecheck, build/smoke checks, OpenSpec validation, and required Registry documentation/Wiki tracking checks; record truthful blockers.
