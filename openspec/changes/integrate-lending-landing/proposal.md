## Why

The current `master` branch opens the Next.js authentication surface, while the supplied `C:/Users/leo/orca/workspaces/EasyHealth/Lending` workspace contains the intended EasyHealth static landing and its local animation assets. Integrating that landing at the site root gives visitors the supplied visual experience without carrying the source site's Function-specific acquisition, pricing, or tracking behavior.

## What Changes

- Add the supplied static landing source mirror under `landing-site/` and the runtime copy under `public/landing/`, including only assets referenced by the EasyHealth home and adapted `How it works` pages.
- Rewrite `/` to `/landing/index.html` so the new landing becomes the public root while `/landing/` remains directly addressable.
- Keep the supplied local video, Lottie, responsive layout, pause controls, reduced-motion behavior, and no-JavaScript-readable workflow content.
- Replace source-site branding, metadata, navigation, copy, CTAs, legal links, footer, and placeholder canonical/contact destinations with EasyHealth-owned content and real application routes.
- Expose the existing authentication entry at a non-root `/login` route and route landing CTAs to it; route callback errors to `/login` so authentication failures remain visible after the root landing cutover.
- Update the home landing page's `How it works` navigation and secondary CTA to use the real `/landing/how-it-works/` route.
- Remove Function-specific pricing, membership, lab collection, imaging, HSA/FSA, newsletter, checkout, affiliate, UTM, and third-party collection behavior from imported landing pages and retained runtime assets.
- Do not import the source workspace's Function-specific `/landing/what-we-test/` page or unrelated source changes such as `.papercuts.jsonl` and planning artifacts.
- Preserve product APIs, Supabase, document processing, worker behavior, and existing authenticated application routes apart from the explicit public-root and login-entry routing changes.

## Capabilities

### New Capabilities

- `easyhealth-animated-how-it-works`: A local animated information page that explains EasyHealth's supported document upload, source-linked review, organization, and record-history workflow.

### Modified Capabilities

- None. Existing application and authentication capability requirements remain unchanged; the root landing and login entry are routing composition changes.

## Impact

- Target domain: `auth-shell` public entry and conversion surface.
- Affected implementation: `next.config.ts`, `src/app/login/page.tsx`, `src/lib/auth/callback-redirect.ts`, `landing-site/**`, `public/landing/**`, and the existing root landing page navigation source where applicable.
- The transfer contains a large static asset set from the source workspace. Implementation must verify every retained HTML asset reference resolves locally and must exclude unrelated Function tracking and commercial modules.
- Verification must cover root and `/landing/` routes, desktop and mobile layout, navigation and CTA destinations, login and callback-error routing, local animation behavior, reduced motion, keyboard operation, no-JavaScript readability, absence of source-site strings and external collection requests, and no horizontal overflow.
- No new runtime dependency, API, database migration, Supabase change, or worker change is required.
