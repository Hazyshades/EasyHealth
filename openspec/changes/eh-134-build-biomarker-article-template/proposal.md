## Why

EasyHealth currently exposes Registry measurement definitions and personal observations, but it has no reusable, safe presentation layer that explains one measurement without mixing educational copy with assessment output. EH-134 adds that boundary now so reviewed Knowledge Base content can describe a measurement and give the user a direct path to their own profile-scoped results without implying a universal range, diagnosis, or test order.

## What Changes

- Add the template-facing Knowledge Base article contract for versioned measurement content: measurement-definition key, slug, locale, content version, review metadata, structured educational sections, sources, related measurement keys, and deprecation metadata.
- Add a published-article lookup and validation boundary; drafts, incomplete records, and deprecated records must not render through the user route.
- Add a reusable authenticated measurement-article page at `/app/knowledge/measurements/[slug]` with separate general education and **Your results** sections.
- Render the required measurement sections: what it measures, aliases, common units, specimen, panel membership, related measurements, interpretation factors, sources, and disclaimer.
- Derive Registry-owned identity metadata (aliases, unit policy, specimen, and panel membership) from the existing measurement and panel registries rather than duplicating score or resolver data.
- Load the signed-in user's observations through the existing profile-scoped Biomarkers API, filter to the article's concrete measurement definition, and link each owned source document back with validated measurement/observation context.
- Add deterministic EH-134 contract verification and a tester-facing `QA/eh-134/checklist.md`; record the unavailable manual path until a later content issue publishes reviewed articles.
- Do not change observation normalization, resolver outcomes, assessment scoring, reference-range policy, database schema, or Registry definitions.

## Capabilities

### New Capabilities

- `measurement-education`: Versioned, review-gated measurement education pages with explicit separation between general content and the authenticated user's own observations.

### Modified Capabilities

<!-- No existing capability requirements change. The page consumes existing Registry and Biomarkers contracts without modifying them. -->

## Impact

- **Target domains:** `health-profile` and the Knowledge Base content layer.
- **Frontend:** New measurement article route and reusable renderer under `src/components/knowledge-base/`; context-preserving links to Biomarkers and profile-owned source documents.
- **Content/runtime:** New typed article contract and lookup/validation helpers under `src/lib/knowledge-base/`; no published article corpus is introduced by EH-134 because reviewed content belongs to EH-136.
- **Verification:** New `pnpm test:eh134` contract checks, focused typecheck, and `QA/eh-134/checklist.md`.
- **Security boundary:** General content is version-controlled and review-gated; personal results continue through the existing authenticated `/api/biomarkers` profile boundary and existing document ownership checks. Query parameters only select already-returned profile data.
