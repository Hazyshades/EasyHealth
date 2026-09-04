## Context

Two Knowledge Base panel surfaces already exist and disagree.

The public route `src/app/knowledge/panels/[key]/page.tsx` loads a Registry `PanelDefinition` through `getKnowledgePanel` and renders `PanelArticle` (`src/components/knowledge-base/panel-article.tsx`). That view is composition-only: required/optional members, a generic composition caveat, and a link to `/app/biomarkers`. It has no sources, disclaimer, or review metadata.

The authenticated route `src/app/app/knowledge/panels/cbc/page.tsx` is a client page that loads `CBC_PANEL_ARTICLE` and `PanelArticleTemplate`. The article already carries MedlinePlus and NHLBI sources, `MEDICAL_DISCLAIMER`, subgroups, and honest `reviewStatus: "in_review"` with null `reviewedBy`/`reviewedAt`. The template always renders a “Your CBC results” block that fetches `/api/biomarkers`.

EH-138 requires public Knowledge Base pages to stay session-independent. EH-139 requires published guidance to have reviewer and `reviewedAt`. EH-140 QA (EH140-UI-03) expects sources, last-reviewed date, and a disclaimer on the public CBC page; the last-reviewed date cannot appear until clinical publish.

This change only reconnects the public route to the existing education article. It does not author new CBC copy or close the safety-review issue.

## Goals / Non-Goals

**Goals:**

- Public `/knowledge/panels/[key]` SHALL render the panel education article when `getPanelArticleBySlug(key)` returns a non-deprecated article whose `panelKey` matches the Registry panel.
- That rendering SHALL include sources, disclaimer, purpose, composition caveat, subgroups, and review chips already produced by `PanelArticleTemplate`.
- Public rendering SHALL remain a server component with no private API, cookies, or result values.
- Registry-only panels (thyroid, liver, and any future key without an article) SHALL keep the current composition page.
- `in_review` SHALL stay labeled Educational preview / Clinical review pending.

**Non-Goals:**

- Clinical publish of CBC (`reviewStatus: "published"`, reviewer, `reviewedAt`).
- Changing EH-140 safety policy, copy regexes, or GitHub #40.
- Changing authenticated `/app/knowledge/panels/cbc` behavior, including its results fetch.
- Adding education articles for other panels.
- CMS, locale switch, or new URLs.

## Decisions

### 1. Overlay the education article on the existing public key route

Keep `/knowledge/panels/[key]` and `generateStaticParams` from `listKnowledgePanels()`. After resolving the Registry panel, look up `getPanelArticleBySlug(key)`.

- Article present, `panelKey` matches, status is `in_review` or `published`, not deprecated → education template.
- Otherwise → existing `PanelArticle`.

Unknown Registry keys remain `notFound()`.

**Alternative considered:** a new `/knowledge/panels/cbc` file beside `[key]`. Rejected: it would split the public contract and leave `[key]` as a trap for the same slug.

**Alternative considered:** hide public CBC until `published`. Rejected: the URL is already live from EH-138; hiding it would 404 a linked index card. Preview chips are the honest state.

### 2. Reuse `PanelArticleTemplate`; make the results section optional

Do not copy the template. Pass the Registry `PanelDefinition` plus the education article. Make `resultState` / `resultLabel` optional (or omit the results section when they are absent) so the public server page does not invent an empty “Your CBC results” block or a fake `onRetry`.

The public page wraps the template with public breadcrumbs to `/knowledge`. It MUST NOT add `"use client"` or `fetch("/api/biomarkers")`.

**Alternative considered:** a second public-only component. Rejected: sources/disclaimer/chips would drift. One optional results prop is smaller.

**Alternative considered:** render results with `{ status: "ready", results: [], resultHref: () => null }`. Rejected: that would show “No CBC results are linked yet” and upload CTAs on a public page.

### 3. Preview is allowed; published claims are not

Public education MAY render `in_review` because EH-135 already does that on `/app`. Chips stay:

- `in_review` → “Educational preview” and “Clinical review pending”
- `published` with reviewer and `reviewedAt` → “Panel guide” and “Clinically reviewed”

Do not display a last-reviewed date when `reviewedAt` is null. Do not change `CBC_PANEL_ARTICLE` metadata in this change.

Deprecated or mismatched `panelKey` articles MUST NOT overlay the registry page.

### 4. Verify the wiring, not the clinical corpus

Add `scripts/verify-public-panel-education.ts` (package script such as `test:public-panel-education`) that asserts:

- CBC public page module imports `getPanelArticleBySlug` / `PanelArticleTemplate` and does not import `fetch` of `/api/biomarkers`.
- `CBC_PANEL_ARTICLE` still has sources and disclaimer and remains `in_review` unless a later change publishes it.
- A registry panel without an article still resolves through `getKnowledgePanel`.

QA checklist records public CBC sources/disclaimer/preview chips, a non-CBC registry fallback, and that last-reviewed remains absent until publish. Do not mark EH-140 Pass from this change alone.

## Risks / Trade-offs

- **[Risk] Public preview looks like clinical publication.** → Mitigation: keep pending chips; no invented reviewer date; EH-140 last-reviewed stays Partial/Fail until publish.
- **[Risk] Template change breaks the authenticated CBC results section.** → Mitigation: optional results only; `/app/knowledge/panels/cbc` keeps passing `resultState`.
- **[Risk] Scanning page source for `fetch` is brittle.** → Mitigation: prefer import-graph / forbidden-string checks on the public route file, plus typecheck.
- **[Trade-off] Registry-only panels still lack sources.** → Accepted until those panels have education articles. Not this change.

## Migration Plan

1. Land the route overlay and optional results prop on a branch other than EH-140 if EH-140 is already in review.
2. No database or content migration.
3. Rollback is revert of the page/template/script files; public URLs stay the same.

## Open Questions

- None for implementation. Clinical publish of CBC is a later editorial change, not a blocker for this overlay.
