## 1. Freeze the source landing and asset boundary

- [x] 1.1 Record the source workspace commit and inspect its working-tree diff, keeping only the EasyHealth landing changes and excluding `.papercuts.jsonl`, planning artifacts, and unrelated pages.
- [x] 1.2 Inventory local references from the EasyHealth home and `how-it-works` HTML, CSS, JavaScript, JSON, media, and font files; copy the verified dependency closure into `landing-site/` and `public/landing/`.
- [x] 1.3 Exclude the source `what-we-test` page, Function-specific bundles, tracking SDKs, newsletter and checkout modules, external CDN assets, and unused hashed asset trees; verify no retained file contains source branding or collection markers.
- [x] 1.4 Compare shared files in `landing-site/` and `public/landing/` and make the authored and runtime mirrors byte-equivalent.

## 2. Adapt the public landing content

- [x] 2.1 Update home-page metadata, canonical and Open Graph URLs, visible copy, CTA labels, and footer links for the current EasyHealth deployment and supported document workflow.
- [x] 2.2 Remove unsupported testing, disease-monitoring, diagnostic, treatment, pricing, population, placeholder contact, and source-site claims while keeping clearly labeled illustrative record values.
- [x] 2.3 Replace the supplied `how-it-works` page with the EasyHealth-owned document upload, source review, organization, and record-history narrative while retaining local animation and responsive behavior.
- [x] 2.4 Configure landing destinations so authentication uses `/login`, legal links use `/legal/privacy` and `/legal/terms`, and workflow navigation uses `/landing/how-it-works/`.

## 3. Wire root and authentication routes
- [x] 3.1 Rewrite `/` and the two direct landing index paths to their static HTML entries in `next.config.ts` while preserving the existing Turbopack root configuration and leaving application routes untouched.
- [x] 3.2 Extract the existing authentication entry into a reusable component and expose it at `/login` without changing Google, magic-link, profile-retry, or existing authenticated redirects.
- [x] 3.3 Route callback failures to `/login?signin=error&reason=<reason>` while preserving success redirects to `/app` and onboarding gates.
- [x] 3.4 Verify legal pages, login check-email return navigation, and authenticated application links remain reachable after the root rewrite.

## 4. Verify and release the landing

- [x] 4.1 Run static reference, mirror-drift, source-string, unsupported-claim, and external-URL audits over the retained landing closure.
- [x] 4.2 Run typecheck and production build with the landing files present, and confirm the Next.js root rewrite does not create build or route errors.
- [x] 4.3 Browser-smoke `/`, `/landing/`, `/landing/how-it-works/`, `/login`, `/legal/privacy`, and `/legal/terms` at desktop and mobile widths, recording every CTA, menu, accordion, pause, and navigation result.
- [x] 4.4 Verify keyboard-only use, visible focus, reduced-motion behavior, no-JavaScript readability, no horizontal overflow, and absence of external collection requests.
- [x] 4.5 Deploy the web service through the existing Railway path and verify the public root and direct landing routes; record rollback evidence if deployment fails.
