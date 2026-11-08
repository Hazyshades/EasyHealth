## ADDED Requirements

### Requirement: EasyHealth landing is served at the public root

The application SHALL serve the EasyHealth static landing at `/` and SHALL keep `/landing/` as a directly addressable equivalent entry. The runtime page SHALL resolve its relative styles, scripts, media, fonts, and nested page links from the repository-local `/landing/` asset base.

#### Scenario: Visitor opens the public root

- **WHEN** a visitor opens `/`
- **THEN** the response renders the EasyHealth landing rather than the authenticated application entry, and all first-screen assets load from local `/landing/` paths

#### Scenario: Visitor opens the direct static path

- **WHEN** a visitor opens `/landing/`
- **THEN** the same EasyHealth home content is rendered without missing assets or a redirect to an unavailable path

### Requirement: Landing explains the supported EasyHealth workflow

The application SHALL serve `/landing/how-it-works/` as an EasyHealth-owned page explaining supported document upload, source-linked review, organization, and record history. Visible product statements SHALL remain limited to behavior the application supports, and illustrative sample values SHALL be labeled as examples.

#### Scenario: Visitor reads the workflow page

- **WHEN** a visitor opens `/landing/how-it-works/`
- **THEN** the page describes the EasyHealth document workflow, retains the authored EasyHealth visual composition and local motion affordances, and uses the supplied repository-local Flutie and Lottie assets with readable CSS/SVG fallbacks. It contains no Function branding or unsupported testing, diagnosis, treatment, or disease-monitoring claim

#### Scenario: Visitor reads sample record content

- **WHEN** a visitor sees a chart, document, or biomarker value on the landing
- **THEN** the surrounding copy identifies it as illustrative or example content rather than presenting it as a real user's medical result

### Requirement: Landing navigation uses live EasyHealth destinations

All landing navigation, calls to action, legal links, and nested page links SHALL point to existing EasyHealth routes or real local sections. Authentication CTAs SHALL use `/login`; legal links SHALL use `/legal/privacy` and `/legal/terms`; the `How it works` links SHALL use `/landing/how-it-works/`. The landing SHALL NOT expose source `/sign-in`, `/sign-up`, placeholder contact, or placeholder canonical destinations.

#### Scenario: Visitor activates an authentication CTA

- **WHEN** a visitor activates `Log in`, `Start your record`, `Begin with a document`, or the closing primary CTA
- **THEN** the browser navigates to `/login`, where the existing Google and magic-link authentication controls remain available

#### Scenario: Visitor activates a legal link

- **WHEN** a visitor activates `Privacy` or `Terms`
- **THEN** the browser navigates to the corresponding existing `/legal/privacy` or `/legal/terms` page

#### Scenario: Visitor opens the workflow page from home

- **WHEN** a visitor activates a `How it works` navigation or secondary CTA
- **THEN** the browser opens `/landing/how-it-works/` and does not produce a 404 or external navigation

### Requirement: Authentication failures remain visible after root cutover

The existing authentication entry SHALL be reachable at `/login`, and authentication callback failures SHALL redirect to `/login` with the existing error query so the error state remains visible after `/` is rewritten to the static landing. Successful callback routing to `/app` and onboarding SHALL remain unchanged.

#### Scenario: Visitor opens the login entry

- **WHEN** a visitor opens `/login`
- **THEN** the current authentication entry renders with Google and magic-link controls and the route does not depend on the root landing rewrite

#### Scenario: Authentication callback fails

- **WHEN** the auth callback receives a missing code, exchange failure, profile setup failure, or missing user
- **THEN** it redirects to `/login?signin=error&reason=<reason>` and the login entry shows the existing human-readable error state

#### Scenario: Authentication succeeds

- **WHEN** the auth callback exchanges a valid session and profile state
- **THEN** it continues to route the user to the existing `/app` or onboarding destination according to profile and consent gates

### Requirement: Imported landing has no source commercial or collection behavior

The retained landing HTML, CSS, JavaScript, JSON, and referenced local assets SHALL exclude Function branding, pricing, membership purchase, lab collection, imaging, HSA/FSA, newsletter capture, checkout, affiliate or UTM persistence, tracking SDKs, and external data-collection requests. The source workspace's Function-specific `what-we-test` page SHALL NOT be exposed by this change.

#### Scenario: Visitor loads the retained landing pages

- **WHEN** a visitor loads `/` or `/landing/how-it-works/`
- **THEN** the page makes no request to a source-site, analytics, checkout, newsletter, or other external collection endpoint and renders no removed commercial module

#### Scenario: Visitor requests the excluded source page

- **WHEN** a visitor requests `/landing/what-we-test/`
- **THEN** this change does not expose the source workspace's Function page or import its source-specific content as part of the EasyHealth landing

### Requirement: Landing preserves motion and accessibility behavior

The landing SHALL preserve keyboard-operable navigation, visible focus indicators, skip navigation, responsive mobile layout without horizontal overflow, hero and monitor pause controls, and local `prefers-reduced-motion` behavior. Core workflow content SHALL remain readable when JavaScript is disabled. Optional motion SHALL use repository-local CSS/SVG fallbacks or other tracked local assets, including the supplied Flutie and Lottie compositions, and SHALL never require an external media request.

#### Scenario: Visitor uses the mobile navigation by keyboard

- **WHEN** a keyboard user focuses and activates the mobile menu button, then uses `Tab`, `Enter`, or `Escape`
- **THEN** the menu opens and closes predictably, focus remains visible, and every exposed link is reachable

#### Scenario: Visitor requests reduced motion

- **WHEN** the browser reports `prefers-reduced-motion: reduce`
- **THEN** workflow content remains visible and nonessential hero, video, Lottie, and marquee motion does not autoplay or create an inaccessible moving-only state

#### Scenario: Visitor disables JavaScript

- **WHEN** JavaScript is disabled
- **THEN** headings, explanatory copy, navigation links, CTAs, and the workflow page remain readable and usable even though optional animation is unavailable

### Requirement: Source and runtime landing mirrors remain complete

The repository SHALL keep the authored `landing-site/` mirror and served `public/landing/` mirror synchronized for every retained page and asset. Every local HTML reference SHALL resolve to a tracked repository file, and the root entry SHALL not depend on the external source workspace at runtime.

#### Scenario: Build checks retained references

- **WHEN** the landing verification command scans HTML, CSS, JavaScript, JSON, media, and font references
- **THEN** every retained local reference exists in the runtime mirror and no missing hashed asset is reported

#### Scenario: Mirrors are compared

- **WHEN** the implementation compares files shared by `landing-site/` and `public/landing/`
- **THEN** each shared file has identical content, with no source-only drift that changes the served landing
