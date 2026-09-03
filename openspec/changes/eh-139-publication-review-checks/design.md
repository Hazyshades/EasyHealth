## Context

The current checkout contains no Knowledge Base content model, public article route, or publication validator. The only file-backed content is legal Markdown, while the Registry and assessment surfaces are deliberately separated from educational copy. EH-133 is listed as a dependency, so this change adopts its required metadata shape rather than inventing a second content contract: article type, slug, locale, content version, review state, reviewer metadata, source list, and deprecation metadata.

The change is intentionally file-backed. A Knowledge Base article is general educational content, not user-owned health data, and does not need a Supabase row or a profile session. The public route must never read or write private profile data or feed content into Registry resolution, assessment eligibility, scores, or reports.

## Goals / Non-Goals

**Goals:**

- Make the four lifecycle states explicit: `draft`, `review`, `published`, and `deprecated`.
- Centralize publication eligibility so build checks and public reads use the same fail-closed rules.
- Require reviewer identity, review timestamp, and at least one HTTPS source before publication.
- Treat a published article older than one year since review as stale; produce a deterministic stale report and fail the release check until it is re-reviewed or deprecated.
- Render every public article's last reviewed date, source list, and medical disclaimer.
- Redirect deprecated slugs only to a valid internal replacement article or the Knowledge Base index.
- Keep the implementation independently testable without a running database.

**Non-Goals:**

- An editorial/admin UI, CMS, database persistence, or authentication for content authors.
- The first ten reviewed biomarker pages, panel pages, index search, or relationship graph from EH-134 through EH-138.
- External range data, diagnosis, treatment advice, scoring logic, assessment bindings, or changes to Registry 2.0.
- Automatic source crawling or clinical review; sources and reviewer metadata remain curated input.

## Decisions

### 1. Use a typed, version-controlled content registry

Articles live in `content/knowledge-base/articles.ts` and satisfy a shared `KnowledgeBaseArticle` type. The body remains Markdown text so editorial content can be authored without changing runtime code, while metadata is checked by TypeScript and the publication validator. The registry is imported by the server-only Knowledge Base library and is the only runtime content source.

A database-backed CMS was rejected because it would add private data access, migrations, runtime availability failure, and a second publication authority for content that is version-controlled by the repository. A custom frontmatter parser was rejected because it would add parsing ambiguity without an existing parser dependency.

### 2. Make freshness part of public eligibility

`published` is a declared lifecycle state, not proof that an article is safe to serve. A single policy function checks state, review metadata, source evidence, and the versioned freshness window. The default window is 365 days and every function accepts an explicit `asOf` date for deterministic tests and reports. Stale published entries are included in the stale report and are not returned as public articles.

A warning-only stale check was rejected because the stated goal is to prevent stale guidance from being presented as published content. The report remains separate from structural validation so maintainers receive actionable slugs and review dates.

### 3. Use an internal-only deprecation redirect

The canonical public route is `/knowledge-base/[slug]`. Draft, review, stale, and unknown slugs resolve to `notFound()` and therefore cannot leak content. A deprecated slug uses `permanentRedirect()` only when its replacement exists and is currently public; otherwise it permanently redirects to `/knowledge-base`. Redirect targets are constructed from validated slugs and never taken from request query parameters or arbitrary URLs.

A soft 404 was rejected because existing inbound links need a safe destination. External redirects were rejected because they could turn editorial metadata into an open redirect.

### 4. Render governance metadata in one server component

`KnowledgeBaseArticle` owns the article header, `Last reviewed` `<time>`, source list, Markdown body, and mandatory medical disclaimer. The route passes only a policy-approved article to this component. This keeps the visible metadata invariant beside the renderer rather than relying on each article page to remember it.

### 5. Put the gate in local verification and production build preflight

`scripts/check-knowledge-base.ts` validates the real registry and prints the stale report; it exits non-zero for invalid or stale published content. `scripts/verify-knowledge-base.ts` exercises lifecycle, publication, staleness, deprecation, and rendered metadata with deterministic fixtures. The package scripts expose both commands, `prebuild` runs the real content gate, and the CI suite policy/workflow run the behavioral verifier.

## Risks / Trade-offs

- **No published content in this change:** EH-136 owns reviewed article coverage. The route and gate are complete but the current registry may intentionally contain no public article until clinical review evidence is available; the index exposes an explicit empty state rather than fabricated guidance.
- **Annual freshness is a policy choice:** 365 days is explicit and testable, but clinical owners may later choose a shorter window. That change must update the policy and renew affected review evidence.
- **Repository rebuild required:** Content updates take effect on the next build/deployment. This is acceptable for version-controlled content and makes the release artifact auditable.
- **External links can become unavailable:** The gate validates HTTPS shape and presence, not remote uptime or clinical quality. EH-140 remains responsible for link and language review.
- **Deprecated replacements can later become stale:** Runtime resolution re-checks the replacement at request time and falls back to the index, while the build validator reports the invalid replacement so it cannot silently pass release review.
