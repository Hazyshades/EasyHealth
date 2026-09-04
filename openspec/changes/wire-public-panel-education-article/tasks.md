## 1. Public route overlay

- [x] 1.1 Make `PanelArticleTemplate` omit the “Your results” section when result state is not provided, without changing authenticated CBC result rendering.
- [x] 1.2 Update `src/app/knowledge/panels/[key]/page.tsx` to load `getPanelArticleBySlug(key)` after the Registry panel, render the education template for matching non-deprecated `in_review` or `published` articles, and keep `PanelArticle` as the fallback.
- [x] 1.3 Keep the public page a server component: public breadcrumbs to `/knowledge`, no `"use client"`, and no `/api/biomarkers` fetch.

## 2. Verification and QA

- [x] 2.1 Add `scripts/verify-public-panel-education.ts` and a package script that proves CBC public wiring, sources/disclaimer presence, preview metadata, forbidden private fetch on the public route, and registry fallback for a panel without an article.
- [x] 2.2 Create `QA/wire-public-panel-education-article/checklist.md` with public CBC preview/sources/disclaimer checks and a non-CBC composition fallback; do not mark last-reviewed as Pass while `reviewedAt` is null.
- [x] 2.3 Run the new verifier, `pnpm typecheck`, and `openspec validate wire-public-panel-education-article --strict`.

## 3. Boundaries

- [x] 3.1 Leave `CBC_PANEL_ARTICLE` review fields, EH-140 files, authenticated `/app/knowledge/panels/cbc`, APIs, and Registry catalog unchanged.
