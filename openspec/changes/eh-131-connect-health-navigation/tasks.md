## 1. Navigation contract

- [x] 1.1 Add the shared internal health-navigation URL builder/parser, stable context keys, route labels, and same-origin return-path validation.
- [x] 1.2 Add the accessible reusable context breadcrumb component used by deep-linked health surfaces.

## 2. Health Profile entry points

- [x] 2.1 Make Health Profile system selection addressable through the `system` query parameter while preserving normal body-map and drawer behavior.
- [x] 2.2 Add marker links to the selected Biomarkers series and exact profile-owned source document, carrying measurement/system/return context and safe fallbacks for incomplete markers.

## 3. Biomarker measurement context

- [x] 3.1 Initialize and synchronize selected measurement/observation state from the URL, including selected-row highlighting and context breadcrumbs.
- [x] 3.2 Add context-preserving source-document links to Biomarker table rows and historical series points without fabricating targets for source-less observations.
- [x] 3.3 Extend the trend chart's accessible point/source presentation so each historical point can return to the selected series and source document.

## 4. Timeline and Document Review navigation

- [x] 4.1 Carry active timeline filters and page state into event source links, and preserve observation context when a measurement source is opened.
- [x] 4.2 Add validated origin breadcrumbs/back navigation to Document Review while retaining the existing Documents fallback and page/review behavior.
- [x] 4.3 Confirm page metadata/navigation behavior remains correct for direct context URLs and does not introduce a new data-access path.

## 5. Verification and QA

- [x] 5.1 Add deterministic EH-131 URL, selection, source-link, breadcrumb, and ownership-seam verification and expose it through `pnpm test:eh131`.
- [x] 5.2 Create `QA/eh-131/checklist.md` with synthetic tester flows, developer evidence requirements, permission coverage, and explicit unavailable/deferred behavior.
- [x] 5.3 Run focused typecheck, EH-127/EH-131 verification, relevant database checks, and authenticated UI smoke; record results in the QA evidence. The smoke used a copied local environment and synthetic fixtures; cross-profile runtime authorization remains an explicit evidence gap.
