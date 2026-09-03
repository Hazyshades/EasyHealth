## Context

EasyHealth has a typed Registry 2.0 runtime (`src/lib/biomarkers`) and curated panel membership, but it has no public Knowledge Base content layer or biomarker article route. The existing authenticated `/app/biomarkers` surface is a private observation view; it is not suitable for general educational copy. The repository already uses version-controlled Markdown content and `react-markdown` for legal pages, while the Registry exposes reviewed measurement definitions, unit policies, and panel lookups that can ground article metadata.

EH-136 is the first content slice after the planned article-template work in EH-134. The implementation must remain safe even while later Knowledge Base index/search, relationship-graph, and publication-review work are separate roadmap items. No Supabase reads are needed for public content, and no article may become an input to normalization, assessment, or Health Profile scoring.

## Goals / Non-Goals

**Goals:**

- Publish exactly ten English biomarker article records with stable slugs and explicit review/version/source metadata.
- Keep article prose in version-controlled content files, separate from Registry and assessment code.
- Render every article through one reusable, accessible public template.
- Ground visible definition keys, aliases, units, specimen, and panel membership in reviewed Registry 2.0 data.
- Include a clearly separated link to the signed-in user's private Biomarkers view without fetching or embedding observations in the public page.
- Make publication failures deterministic and visible during typecheck/build or the focused EH-136 verification command.

**Non-Goals:**

- No database table, migration, CMS, authoring UI, API, personalized observation query, or user-data embedding.
- No Knowledge Base index, alias search, panel article, relationship graph, or deep-link integration from private biomarker rows; those belong to EH-135, EH-137, and EH-138.
- No universal reference ranges, scoring ranges, diagnostic conclusions, treatment advice, test-order prompts, or external range feed.
- No changes to Registry definitions, aliases, panels, resolver outcomes, assessment bindings, readiness, scores, or Health Profile projections.
- No locale other than `en` and no deprecated-page redirect behavior beyond rejecting non-published records; publication governance is covered by EH-139.

## Decisions

### 1. Use a JSON manifest plus Markdown body files

Article metadata and source records will live in a checked-in JSON manifest under `content/knowledge/biomarkers/`; each article body will live in a sibling Markdown file. A server-only loader will validate the manifest shape, resolve the body path within that directory, and expose read-only article records to the route. This keeps content edits independent from scoring code and avoids adding a CMS or a new runtime dependency.

**Alternative considered:** TypeScript constants containing prose. Rejected because content reviewers would have to edit application code and prose would be coupled to the module graph.

### 2. Derive technical metadata from the reviewed Registry at render time

The manifest stores the reviewed `measurementDefinitionKeys` and curated `panelKeys` as editorial references. The loader resolves those keys with `getMeasurementDefinition` and `getPanelDefinition`, rejects missing or non-reviewed definitions, and derives aliases, accepted units, specimen labels, and panel membership from the runtime catalog. Article prose never defines a score role, assessment binding, reference range, or numeric threshold.

**Alternative considered:** Copy Registry fields into each article file. Rejected because copied identity metadata would drift and could imply that educational content controls the runtime Registry.

### 3. Publish one static dynamic route

The public route will be `/knowledge/biomarkers/[slug]`. `generateStaticParams` will enumerate only published manifest records, and `generateMetadata` will use the validated article title/summary. Unknown, draft, review, or deprecated slugs will return `notFound()`. No authenticated layout or Supabase client is mounted around this route.

**Alternative considered:** Put pages under `/app/biomarkers`. Rejected because that route is private, observation-focused, and would blur general education with personal data.

### 4. Treat the kidney item as one article with two definitions

The tenth checklist item is `creatinine/eGFR`, so the article slug `creatinine-egfr` references both `creatinine_serum` and `egfr`. The page explains their relationship at a high level and links each definition to the private Biomarkers view. This preserves the issue's ten-page roster without inventing a separate eleventh page.

**Alternative considered:** Publish separate creatinine and eGFR pages. Rejected because it would no longer match the requested ten-page slice and would make the issue checklist ambiguous.

### 5. Use a server-rendered template with a private-data boundary

`BiomarkerArticleTemplate` will render a header, Registry metadata cards, Markdown sections, related article links, source links, review metadata, disclaimer, and a separate “Your EasyHealth data” card. It will use semantic headings, lists, visible focus states, and responsive layout. The data card contains links only; it does not receive a profile id or observation payload.

**Alternative considered:** Client-fetch article data and observations together. Rejected because it adds an unnecessary client boundary and risks mixing public content with private data.

### 6. Validate safety and completeness in a focused script

`test:eh136` will load the manifest, assert the exact ten slugs and expected Registry keys, verify reviewed concrete definitions and valid panel membership, require every article section/source/review field, enforce unique slugs/source IDs, and scan body content for universal-range or diagnostic/prescriptive prompts. The script will also verify that the generated page paths are deterministic. It tests the content contract without changing the Registry test suite.

**Alternative considered:** Rely on manual review or a full browser test only. Rejected because missing metadata and accidental unsafe phrasing should fail quickly in CI before a page is rendered.

## Risks / Trade-offs

- External source URLs can change or become unavailable. The manifest records the source title, publisher, URL, and access date; link availability remains a release-review concern rather than a runtime dependency.
- The repository cannot provide a real clinical sign-off through code. The content contract records reviewer metadata and the QA checklist keeps human medical review as explicit evidence instead of claiming that static validation is clinical approval.
- Registry releases can change display metadata. Resolving keys at render time prevents stale copies, while the focused validator catches missing keys or panel references before publication.
- A single combined kidney page is less granular than separate articles, but it is faithful to the ten-item issue scope and makes the creatinine/eGFR relationship explicit without adding a graph model.
