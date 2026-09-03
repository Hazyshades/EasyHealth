## 1. Knowledge Base content and catalog

- [x] 1.1 Add typed, versioned, review-gated static article records for the initial reviewed measurement set, including safe copy, sources, related keys, categories, and stable slugs.
- [x] 1.2 Add catalog helpers that join published records to reviewed Registry definitions and static panel membership, expose canonical/alias search matches, and filter by category or panel without private data access.

## 2. Public Knowledge Base routes

- [x] 2.1 Add the standalone public Knowledge Base layout/header with links to EasyHealth and the authenticated app.
- [x] 2.2 Add the `/knowledge` index with category groups, panel cards, GET search, shareable category/panel filters, empty states, and accessible controls.
- [x] 2.3 Add published measurement article routes with safe educational sections, Registry-backed metadata, sources, related links, disclaimer, breadcrumbs, and a private results CTA.
- [x] 2.4 Add panel detail routes backed by the static panel registry with ordered required/optional members, composition-variation guidance, published article links, and breadcrumbs.

## 3. Health Profile navigation entry points

- [x] 3.1 Add published-article links to desktop and mobile Observation rows without exposing values, profile ids, observation ids, or document ids.
- [x] 3.2 Add discoverable Knowledge Base entry points to the public landing/app navigation while preserving existing authenticated navigation behavior.

## 4. Verification and QA

- [x] 4.1 Add deterministic EH-138 catalog, search, alias, panel, route, and public/private-boundary verification and expose it as `pnpm test:eh138`.
- [x] 4.2 Create `QA/eh-138/checklist.md` with synthetic tester flows, developer evidence requirements, unavailable UI notes, and deferred coverage.
- [x] 4.3 Run focused EH-138 verification, typecheck, documentation/link checks, and authenticated/public browser smoke coverage; record the observed evidence. `pnpm test:eh138`, `pnpm test:app-navigation-hot-path`, `pnpm typecheck`, `pnpm build`, Prettier checks, documentation/link checks, anonymous public smoke, and authenticated CTA-to-Biomarkers smoke all passed; `QA/eh-138/checklist.md` records the synthetic fixture and evidence.
