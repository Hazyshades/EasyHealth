## Context

The target `master` branch is a Next.js application whose root route currently renders the authentication entry. The supplied `C:/Users/leo/orca/workspaces/EasyHealth/Lending` workspace contains a static EasyHealth landing export in two forms: an authoring mirror under `landing-site/` and a runtime mirror under `public/landing/`. The source workspace also contains unrelated Function-specific pages, tracking bundles, planning files, and local changes that must not be imported.

The landing is compiled static HTML rather than a React surface. Its visual value is in the supplied local CSS, video, Lottie, Flutie hero, responsive composition, and interaction scripts. The target application already has `/app`, `/onboarding`, `/login/check-email`, and `/legal/*` routes, but it has no `/sign-in` or `/sign-up` route. The root rewrite and CTA destinations therefore need to be integrated with the current auth flow rather than copied verbatim.

## Goals / Non-Goals

**Goals:**

- Serve the supplied EasyHealth landing at `/` and `/landing/`.
- Preserve the supplied visual language, local motion, responsive layout, pause controls, and reduced-motion behavior.
- Serve an EasyHealth-owned `/landing/how-it-works/` page that explains document upload, source-linked review, organization, and record history.
- Keep every landing CTA and legal link pointed at a real target route.
- Keep the authentication entry reachable at `/login`, including visible callback errors after the root landing cutover.
- Import only local assets required by the retained landing pages and audit the copied static closure for source branding, tracking, and external requests.
- Use copy that matches the supported product and labels illustrative sample data honestly.

**Non-Goals:**

- Rebuilding the static landing as React components.
- Importing or exposing the source workspace's Function-specific `what-we-test` page, pricing, lab collection, imaging, newsletter, checkout, affiliate, or tracking modules.
- Changing document processing, worker behavior, Supabase schema, authentication semantics, or authenticated application screens.
- Adding new marketing analytics, forms, customer claims, statistics, testimonials, or contact channels.

## Decisions

### Serve the static landing through a root rewrite

Add a `beforeFiles` rewrite from `/` to `/landing/index.html` in `next.config.ts`. Keep `/landing/` directly addressable for asset-relative navigation and deployment smoke tests. This is preferred over rewriting the landing into React because it preserves the supplied compiled animation and avoids a second implementation of the same page.

Alternative rejected: replace `src/app/page.tsx` with a React recreation. That would discard the supplied visual and motion system and create unnecessary maintenance surface.

### Maintain source and runtime mirrors

Keep the authored copy under `landing-site/` and the served copy under `public/landing/`. Transfer the dependency closure for the EasyHealth home and `how-it-works` pages, then make shared files byte-equivalent between the mirrors. Do not copy the entire source workspace or its unrelated pages.

Alternative rejected: serve directly from the external workspace. Railway and repository builds must be reproducible from the EasyHealth repository without a local filesystem dependency.

### Use the current login flow behind a non-root route

Extract the current root authentication UI into a reusable client component, render it from `src/app/login/page.tsx`, and leave the root page as a thin fallback or shared render while the rewrite owns `/`. Set landing `start` and `signIn` destinations to `/login`. Update callback failure destinations in `src/lib/auth/callback-redirect.ts` from `/` to `/login` so invalid or failed auth links still show the existing error state. Successful callbacks continue to use `/app` and onboarding routes.

Alternative rejected: point CTAs to the source `/sign-in` and `/sign-up` paths. Those routes do not exist in the target application and would create dead navigation.

### Map legal links to existing routes and remove unverified contact

Map `privacy` and `terms` to `/legal/privacy` and `/legal/terms`. Remove the source `hello@example.com` contact link because the target repository contains no verified public support address or contact route. Do not replace it with a fabricated address.

Alternative rejected: retain the placeholder email or point a Contact label at a legal page. Both would mislead visitors.

### Copy only the required asset closure

Start from the source pages and collect local `href`, `src`, stylesheet, module-import, video, poster, font, and Lottie references. Copy those files into both mirrors. Exclude Function-specific page files, tracking runtimes, newsletter code, external CDN references, and unused asset trees. Run a source-string and URL audit over the retained closure before serving it.

Alternative rejected: copy all 826 tracked landing files. That would import the source site's unrelated pages and compiled tracking code, increase the deploy artifact without product value, and make the no-external-collection requirement unverifiable.

### Keep product claims document-centered

Retain the supplied composition but audit visible copy against the current product contract. Remove unsupported testing, disease-monitoring, diagnostic, treatment, pricing, and population claims. Keep fictional chart/document values only when the surrounding label clearly says they are illustrative examples. CTAs describe the action they perform, such as starting a record or opening login, rather than promising tests or diagnosis.

Alternative rejected: preserve every source phrase for visual fidelity. Visual fidelity does not justify claims the product cannot support.

### Preserve accessibility and motion controls

Retain skip links, semantic headings, keyboard-operable navigation, focus styles, the mobile menu state, the hero pause control, and reduced-motion handling. Verify the page remains readable when JavaScript is disabled. Do not add a new animation layer or patch compiled CSS through a rewrite script.

## Risks / Trade-offs

- [Risk] The static export contains a large compiled asset set and references hashed files. → Build the local reference closure before copying, verify every reference exists, and smoke-test both desktop and mobile paths.
- [Risk] Source-derived bundles can retain hidden Function strings or tracking code even when the visible page is rewritten. → Scan retained HTML, CSS, JS, and JSON for source branding, collection SDKs, external URLs, newsletter, checkout, and affiliate markers; inspect network requests in the browser.
- [Risk] Rewriting `/` hides the current authentication page and can make callback errors invisible. → Provide `/login`, update failure redirects, and exercise OAuth/magic-link entry and failure paths before deployment.
- [Risk] Relative links can resolve differently at `/` and `/landing/`. → Use the runtime page's `/landing/` base path, test both entry URLs, and verify every navigation target.
- [Risk] The static page uses a visual language distinct from the authenticated app's Figtree/indigo system. → Treat the landing as a deliberate public marketing surface, keep the supplied warm palette and typography coherent within that surface, and avoid mixing app-shell components into the static export.
- [Risk] A hard-coded canonical origin can become stale if a custom domain is introduced. → Use the current production origin as the default and record any custom-domain override in the deployment configuration before release.

## Migration Plan

1. Freeze the source workspace as the input snapshot and exclude its unrelated working-tree changes.
2. Copy the landing source/runtime mirrors and required local asset closure into the target repository.
3. Adapt page metadata, copy, CTAs, legal links, route configuration, canonical origin, and footer to the target product.
4. Add the root rewrite and `/login` auth entry; update callback failure paths.
5. Run static audits for missing references, source branding, external requests, unsupported claims, and duplicate mirror drift.
6. Run typecheck and production build, then exercise `/`, `/landing/`, `/landing/how-it-works/`, `/login`, legal links, mobile navigation, pause controls, reduced motion, and callback error rendering in a browser.
7. Deploy through the existing Railway web service and verify the public root plus direct landing paths.

Rollback removes the root rewrite, restores the previous auth-root route behavior and callback failure paths, and leaves the static landing files unreachable. The copied static files can then be removed in the same change or retained for a later retry; no database or external service rollback is required.

## Open Questions

- If a custom public domain exists before implementation, use it for the canonical and Open Graph URLs; otherwise use the current Railway production origin.
- The source workspace's landing export may contain duplicated hashed assets. The implementation should retain only the closure proven necessary for the two EasyHealth pages, with the final file list recorded in the implementation diff.
