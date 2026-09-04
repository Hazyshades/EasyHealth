# Proposal: wire-public-panel-education-article

Domain: **reports / Knowledge Base**

## Why

Public `/knowledge/panels/cbc` still renders the EH-138 registry composition page, so MedlinePlus/NHLBI sources, the medical disclaimer, and honest review chips from the EH-135 CBC article never appear. EH-140 release QA therefore fails on that panel even though the source-backed article already exists on `/app/knowledge/panels/cbc`. The public route needs to reuse that article without treating an `in_review` record as published clinical guidance.

## What Changes

- Resolve a panel education article on the public `/knowledge/panels/[key]` route when one exists for that Registry panel key.
- Render the existing panel article template (purpose, composition caveat, subgroups, related markers, sources, disclaimer, and review/publication chips) instead of the registry-only member list.
- Keep panels without an education article on the current registry composition page.
- Omit the authenticated “Your results” block, `/api/biomarkers` fetches, and any private identifiers from the public page.
- Keep `in_review` records labeled as educational preview with clinical review pending; do not invent reviewer or `reviewedAt` values, and do not show “Clinically reviewed”.
- Add a focused verification command and a short tester-facing QA record for the public CBC page and a registry-only panel fallback.
- Do not change CBC article copy, publication status, Registry membership, assessment, or the EH-140 safety gate. Do not close GitHub #40.

## Capabilities

### New Capabilities

- `public-panel-education`: Public Knowledge Base panel routes render a source-backed panel education article when one exists, stay session-independent, and remain honest about unpublished clinical review.

### Modified Capabilities

- None. Canonical `openspec/specs/` has no Knowledge Base capability. EH-135 `panel-knowledge-article` and EH-138 `knowledge-base-navigation` stay valid: the authenticated CBC results page is unchanged, and registry panel pages remain the fallback when no education article exists.

## Impact

- **Target domain:** reports (public Knowledge Base). Authenticated `/app/knowledge/panels/cbc` is out of scope except as the existing article source.
- **Affected code:** `src/app/knowledge/panels/[key]/page.tsx`, possibly `src/components/knowledge/panel-article-template.tsx` so the results section is optional, existing `getPanelArticleBySlug` / `CBC_PANEL_ARTICLE` readers, a focused verify script, package-script wiring, and a QA checklist.
- **Not affected:** EH-140 safety policy, publication catalog for biomarkers, Health Profile, APIs, database, and CBC `reviewStatus: "in_review"`.
- **Dependencies:** EH-135 panel article record and template; EH-138 public panel route and registry list. Clinical publish of CBC (`reviewedBy` / `reviewedAt` / `published`) remains a separate editorial task.
- **Compatibility:** no breaking API or URL change. `/knowledge/panels/cbc` stays the public URL; only the rendered body changes when an education article is present.
