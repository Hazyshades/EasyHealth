# EH-134: Build biomarker article template

**Roadmap status:** In progress
**Build / environment:** Local EasyHealth workspace; `pnpm test:eh134`, `pnpm typecheck:projects`
**Test run date:** 2026-09-01
**Tester:** Engineering verification

## What this checklist covers

This checklist covers the reusable measurement-education page contract. A published article must present general education separately from the signed-in user's own uploaded results, show Registry-backed identity metadata and sources, preserve source-document navigation, and avoid universal ranges, scores, diagnoses, treatment advice, and test-order prompts.

EH-134 delivers the reviewed-content boundary and page template. It does not publish a biomarker article; EH-136 owns the first reviewed article records. No test data contains real patient information.

## Before you start

- [x] Use a dedicated synthetic test account (`rsc-perf@example.com`).
- [x] Use only synthetic or de-identified documents and payloads.
- [ ] Confirm a reviewed published article record is available for the target measurement. This is intentionally unavailable until EH-136.
- [ ] Confirm the synthetic profile has at least one matching observation and one source document before exercising **Your results**.

## Test data

| ID                 | Test document or setup                                                                                                                 | Purpose                                  |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `EH134-ARTICLE-01` | Synthetic in-memory Hemoglobin article and Hematocrit related article declared in `scripts/verify-eh134-knowledge-base.ts`             | Contract and Registry projection         |
| `EH134-OBS-01`     | Synthetic Biomarkers response with two Hemoglobin observations, one source-linked and one source-less, plus one Hematocrit observation | Exact filtering and source-link boundary |
| `EH134-DRAFT-01`   | Same synthetic article with `reviewStatus=draft` and no review metadata                                                                | Published lookup withholding             |
| `EH134-UNKNOWN-01` | `/app/knowledge/measurements/not-published` or a nonexistent slug                                                                      | Not-found and no-content state           |

## Interface checks

### EH134-UI-01: Render the complete education structure

**Precondition:** A reviewed published article based on `EH134-ARTICLE-01` is available in the Knowledge Base catalog. This precondition is not available in EH-134 because EH-136 owns publication of the first content.

1. Sign in with the dedicated synthetic account.
2. Go to `/app/knowledge/measurements/<published-slug>`.
3. Confirm the page title and summary are visible.
4. Review the **What it measures**, **Aliases**, **Common units**, **Specimen**, **Panel membership**, **Related measurements**, **Interpretation factors**, and **Sources** sections.
5. Confirm the medical disclaimer is visible.

**Expected result:** Every required section is present. Aliases, units, specimen, and panel membership reflect the Registry definition. Sources are explicit HTTPS links. No universal range, score, diagnosis, treatment recommendation, or test-order prompt is shown.

**Result:** `Blocked` — no reviewed published article is intentionally shipped by EH-134; repeat after EH-136 adds content.

**Notes / evidence link:** `scripts/verify-eh134-knowledge-base.ts` covers the synthetic view-model contract.

### EH134-UI-02: Separate education from Your results

**Precondition:** The published article from EH134-UI-01 is available and the synthetic account has matching observations like `EH134-OBS-01`.

1. Open the published measurement article.
2. Confirm the education copy appears in the main **Measurement education** region.
3. Find the separate **Your results** region.
4. Confirm each matching result shows its reported value, unit, and observed date.
5. Confirm a result with a source document offers a source-document action.
6. Confirm the source-less result has no fabricated source link.

**Expected result:** Personal values are labeled as coming from uploaded documents and are not shown as universal ranges, scores, diagnoses, or recommendations. Other measurement definitions are absent from **Your results**.

**Result:** `Blocked` — no reviewed published article or authenticated UI fixture is available in EH-134; automated filtering and link contracts are covered below.

**Notes / evidence link:** `scripts/verify-eh134-knowledge-base.ts` uses only synthetic payloads and asserts exact definition filtering.

### EH134-UI-03: Withhold unpublished content

**Precondition:** The local app is running and the signed-in account can open the app shell.

1. Open `/app/knowledge/measurements/not-published`.
2. Wait for the page response.
3. If a draft fixture is provisioned locally, open its slug as well.

**Expected result:** The route shows the normal not-found/unavailable state. Draft, deprecated, incomplete, and unknown content is not rendered as an article, and no personal results are exposed for the missing page.

**Result:** `Pass` — In the authenticated Chromium session, `/app/knowledge/measurements/not-published` rendered the normal Next.js `404: This page could not be found.` state with no article content or personal results. A second nonexistent slug produced the same 404. Draft-specific coverage remains unavailable because no draft fixture is provisioned.

**Notes / evidence link:** The server route uses `getPublishedMeasurementArticleBySlug` and calls `notFound()` for every non-published or invalid record.

### EH134-UI-04: Return to Biomarkers and source evidence

**Precondition:** A published article and one source-linked synthetic observation are available.

1. Open the measurement article.
2. Activate **View your results** or the **Biomarkers** breadcrumb.
3. Return to the article and activate **View <source document>** for the matching result.
4. In Document Review, activate the breadcrumb/back action.

**Expected result:** Biomarkers opens with the concrete measurement context. The source link opens only the selected profile-owned document and carries the measurement, observation, and article return path. Returning restores the article context; no external origin is used.

**Result:** `Blocked` — requires a published article and authenticated source fixture owned by the test account.

**Notes / evidence link:** `buildMeasurementBiomarkersHref` and `buildMeasurementObservationSourceHref` are covered by the deterministic contract checks; existing Document Review ownership remains the authorization boundary.

## Developer evidence required

- [x] `pnpm test:eh134` passes publication gating, HTTPS-source validation, Registry metadata projection, related-link withholding, exact observation filtering, source-less behavior, and same-origin navigation assertions. Evidence: `scripts/verify-eh134-knowledge-base.ts`.
- [x] `pnpm typecheck:projects` passes both the Next.js application and document-worker TypeScript projects for the new article schema, view model, route, renderer, and result parsing modules.
- [x] `pnpm build` succeeds with `/app/knowledge/measurements/[slug]` in the production route manifest.
- [x] Scoped Prettier checks pass for the EH-134 source, script, OpenSpec, QA, and package files.
- [x] The production article catalog is empty by design, so no unreviewed or fabricated clinical content can render. Evidence: `MEASUREMENT_ARTICLES` in `src/lib/knowledge-base/measurement-articles.ts` and EH-136 dependency.
- [x] The personal-results renderer calls the existing profile-scoped `/api/biomarkers` route and filters its parsed response by exact `measurement_definition_key`. Evidence: `src/components/knowledge-base/measurement-article.tsx` and `src/lib/knowledge-base/measurement-results.ts`.
- [x] The article route renders only a valid published record and delegates source authorization to the existing document route. Evidence: `src/app/app/knowledge/measurements/[slug]/page.tsx`; cross-profile runtime authorization remains covered by the existing document boundary tests, not this checklist.
- [x] Registry documentation sync reviewed this consumer-only read of existing Registry metadata. The article model reads existing definitions, aliases, units, specimen, panel membership, and related-link state; it changes no definition, alias, unit, resolver, assessment, persistence, or Health Profile projection source. `pnpm generate:biomarker-docs`, `pnpm check:biomarker-docs`, and `pnpm test:biomarker-docs` all passed; canonical `docs/` files were intentionally unchanged.
- [x] `pnpm render:biomarker-wiki` and the explicit local staging export completed, and the generated Home/Architecture pages were reviewed. `git ls-remote https://github.com/Hazyshades/EasyHealth.wiki.git` resolved remote `master` at `66b60b9441a3d2b652b008d2cca4f7588a2d9d52`; no generated Wiki delta existed to publish.
- [x] Registry documentation tracking issue [#223](https://github.com/Hazyshades/EasyHealth/issues/223) records the consumer-only Registry surface, unchanged canonical docs, existing Wiki revision, regeneration commands, verification evidence, and EH-136 follow-up.
- [x] Browser smoke preflight was retried after the user launched `next dev --turbopack` against `http://localhost:3000`. The root page returned `HTTP 200`; the protected route redirected unauthenticated access to `/?signin=required`; the standalone Chromium shell rendered; a synthetic magic link was delivered through Mailpit; onboarding profile and consent were completed; and the authenticated app shell opened. The authenticated unknown/unpublished route and a second nonexistent slug both rendered 404. The browser relay had no matching localhost tab, so standalone Chromium was used; no published-article result is claimed.
- [x] Supabase preflight was completed with `supabase start`, which reported the local development setup running. Host probes returned `200` for `/rest/v1/`, `/auth/v1/health`, and Mailpit on `54324`; no credentials were exposed. The authenticated magic-link flow completed through the local Mailpit inbox.

## Out of scope or not manually testable yet

- EH-136 publication of the first reviewed biomarker pages is required before the article route has user-visible content; it is **Out of scope** for EH-134.
- EH-135 panel article/CBC content, EH-137 related-measurement graph, EH-138 Knowledge Base index/search, EH-139 publication workflow, and EH-140 safety/accessibility review are **Out of scope**.
- No database migration, CMS, editor, or public unauthenticated route is introduced, so there is no database migration UI flow to test.
- Manual article and source-navigation flows remain `Blocked` or `Not run`; this checklist does not mark unavailable UI as passed.
