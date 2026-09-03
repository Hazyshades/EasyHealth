# Proposal: eh-140-safety-accessibility-review

Domain: **reports / Knowledge Base**

## Why

EH-134, EH-135, and EH-138 define the user-facing Knowledge Base surfaces that must be safe to publish, but the repository currently has no release-gate audit for their copy, source links, accessibility, mobile behavior, or separation from assessment inputs. Issue #40 is the P0 gate before the educational layer can be accepted: a reviewer needs deterministic checks for prohibited diagnostic or prescriptive language and external reference-range leakage, plus honest manual evidence for the rendered pages.

## What Changes

- Add a `knowledge-base-safety-review` capability describing a fail-closed EH-140 release gate for biomarker articles, panel articles, the Knowledge Base index/search, and their cross-links.
- Add a small, dependency-free safety policy module and verification command that detects prohibited diagnostic/prescriptive claims and external reference-range fields or copy in Knowledge Base payloads without changing article or assessment behavior.
- Add a deterministic local-link and JSX accessibility contract check for the Knowledge Base surface when EH-134/EH-135/EH-138 files are present. The check must report an absent dependency surface as blocked evidence rather than silently passing it.
- Wire the deterministic EH-140 contract suite into package scripts and the repository verification workflow so a future Knowledge Base change cannot bypass the gate.
- Create `QA/eh-140/checklist.md` with synthetic/de-identified test data, executable manual checks for copy/source separation, keyboard and screen-reader operation, responsive layouts, and broken links, plus separate developer evidence and explicit dependency-blocked cases.
- Record that external source ranges are educational references only: assessment continues to consume document-sourced ranges through the existing Health Profile path, never Knowledge Base content.
- Do not add Knowledge Base article content, alter score logic, add external range feeds, or invent unavailable UI for EH-134/EH-135/EH-138.

## Capabilities

### New Capabilities

- `knowledge-base-safety-review`: Defines the deterministic safety, source-separation, accessibility, link-integrity, responsive-review, and release-evidence requirements for the Knowledge Base MVP.

### Modified Capabilities

- None. The current repository has no published Knowledge Base capability spec; this change adds the review gate without changing assessment or document contracts.

## Impact

- **Issue:** GitHub #40 / roadmap EH-140.
- **Affected domain:** `reports` (educational surfaces) and Knowledge Base implementation delivered by EH-134, EH-135, and EH-138.
- **Affected files:** new `src/lib/knowledge-base/` safety policy, new `scripts/verify-eh140-knowledge-base.ts`, package/CI verification wiring, and `QA/eh-140/checklist.md`.
- **Dependencies:** EH-134 biomarker article template, EH-135 panel/CBC page, EH-138 index/search/cross-links, and the publication metadata contract from EH-139. Until those surfaces exist in this checkout, their manual cases remain `Blocked` and no release acceptance is claimed.
- **Compatibility:** No database, API, observation, normalization, assessment, or user-data changes. Existing document reference ranges remain the only ranges eligible for assessment.
