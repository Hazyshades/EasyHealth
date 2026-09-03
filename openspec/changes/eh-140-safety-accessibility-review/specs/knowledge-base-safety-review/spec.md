## ADDED Requirements

### Requirement: Knowledge Base copy SHALL not make prohibited clinical claims

Every biomarker or panel article presented for EH-140 review SHALL be auditable as rendered copy. The safety audit MUST fail when copy diagnoses a person, states diagnostic certainty, prescribes or changes treatment/medication, directs a person to order a test, or presents a universal normal/abnormal interpretation as a personal conclusion. Findings MUST include a stable rule code and a human-readable excerpt.

#### Scenario: Educational copy is safe

- **WHEN** a reviewed article explains what a measurement represents, lists aliases or units, describes factors that can affect a result, links to sources, and separates the user's own results from general education
- **THEN** the safety audit reports no prohibited-claim finding
- **AND** the article remains eligible for the editorial/accessibility review path

#### Scenario: Copy makes a diagnostic or prescriptive claim

- **WHEN** article copy says that the reader has or does not have a condition, that a result proves or rules out a diagnosis, or that the reader should start, stop, change, or order treatment or testing
- **THEN** the safety audit fails with a `prohibited_claim` finding and the matching excerpt
- **AND** the page is not accepted as an EH-140 release-gate pass

### Requirement: Knowledge Base content SHALL not provide assessment ranges or assessment inputs

Knowledge Base payloads and rendered education SHALL not contain external reference-range fields, universal range thresholds, or score/assessment inputs. External sources MAY be shown as citations, but their ranges MUST remain informational and MUST NOT be read by Health Profile assessment, scoring, readiness, or eligibility code. Assessment range values SHALL continue to originate from the user's document-sourced observation path.

#### Scenario: An article contains a range field or universal threshold

- **WHEN** a Knowledge Base payload includes a reference-range/normal-range field or its copy presents a numeric laboratory interval as a universal interpretation
- **THEN** the audit fails with an `external_reference_range` finding
- **AND** the payload cannot be accepted as safe educational content

#### Scenario: Assessment is built from a user document

- **WHEN** Health Profile assessment evaluates an eligible laboratory observation
- **THEN** it uses the observation's document-sourced range and eligibility metadata
- **AND** it does not import or query Knowledge Base copy, source citations, or external educational ranges

### Requirement: Knowledge Base source links SHALL be visible and locally verifiable

Each published article and panel page SHALL expose its source list and last-review metadata in the user-facing interface. Relative links in Knowledge Base Markdown/MDX SHALL resolve to tracked files or tracked directories; external links SHALL be recorded for manual review with URL and review-date evidence. A broken link MUST block the relevant page from EH-140 acceptance.

#### Scenario: A source is displayed

- **WHEN** a user opens a published article or panel page
- **THEN** the page visibly identifies its sources and review date without requiring developer tools
- **AND** source links have descriptive accessible names and open the declared destination

#### Scenario: A local link is broken

- **WHEN** the deterministic link check resolves a relative Knowledge Base link to a missing tracked target
- **THEN** the check fails with the source file, link, and target
- **AND** the affected page remains unaccepted until the link is repaired or removed

### Requirement: Knowledge Base controls SHALL satisfy the accessible interaction contract

The Knowledge Base index, search, filters, article breadcrumbs, panel links, and user-result deep links SHALL use semantic controls with accessible names, visible keyboard focus, logical focus order, and state announcements where content changes. Responsive layouts SHALL preserve readable content and reachable controls at supported mobile widths. Static checks MAY detect high-confidence JSX hazards, but actual keyboard, screen-reader, and mobile execution SHALL remain required evidence.

#### Scenario: A keyboard-only user navigates the Knowledge Base

- **WHEN** a tester uses only keyboard input on the index, search, panel filters, breadcrumbs, and article links
- **THEN** every interactive control receives a visible focus indicator in logical order and activates with Enter or Space as appropriate
- **AND** no action depends on hover, color alone, or pointer-only behavior

#### Scenario: Search or filter state changes

- **WHEN** a user submits a search or changes a panel filter
- **THEN** the result count and selected state are conveyed through visible text and an accessible name or announcement
- **AND** focus remains understandable and does not move unexpectedly to an unrelated page

#### Scenario: Narrow viewport is used

- **WHEN** a tester opens the index and an article at supported mobile viewport widths with long aliases, source titles, or result labels
- **THEN** text reflows without horizontal clipping or overlap and all source, navigation, and deep-link controls remain reachable

### Requirement: EH-140 evidence SHALL preserve dependency and release truthfulness

`QA/eh-140/checklist.md` SHALL be the tester-facing release record. It MUST use synthetic or de-identified data, include preconditions, numbered interface actions, observable expected results, environment/tester fields, and one of `Pass`, `Fail`, `Blocked`, or `N/A` for every case. Unavailable EH-134, EH-135, or EH-138 surfaces, unsupported assistive technology, and unavailable deployed environments MUST be recorded as `Blocked`, never inferred as passing from static inspection. The deterministic contract suite SHALL be runnable in CI, while strict release mode SHALL fail when required Knowledge Base files are absent or contain any audit finding.

#### Scenario: A dependency surface is not available

- **WHEN** EH-140 is run before the dependent biomarker article, panel, or index/search surface exists
- **THEN** the checklist records the affected manual checks as `Blocked` and names the missing dependency and required evidence
- **AND** the release gate does not claim that the Knowledge Base MVP was accepted

#### Scenario: A P0 issue is found

- **WHEN** a prohibited claim, external range coupling, inaccessible blocking control, or broken required source link is found
- **THEN** the finding is triaged as a release-blocking defect with reproduction evidence
- **AND** EH-140 is not accepted until the defect is fixed and the affected automated/manual check is rerun
