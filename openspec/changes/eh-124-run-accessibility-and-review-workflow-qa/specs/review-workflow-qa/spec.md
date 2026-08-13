## ADDED Requirements

### Requirement: The release has an executable review-workflow QA record

The release SHALL maintain `QA/eh-124/checklist.md` as the tester-facing source of manual QA evidence for the Documents review workspace. The checklist SHALL use only synthetic or de-identified data, state environment and tester preconditions, provide numbered product-interface actions, name observable expected results, and record each case only as Pass, Fail, Blocked, or N/A with supporting evidence.

#### Scenario: A tester prepares a QA run

- **WHEN** a tester begins an EH-124 review-workflow run
- **THEN** the checklist identifies the safe test data, required account access, build/environment, browser, and assistive technology where applicable
- **AND** the tester can execute every manual case without repository, database, or developer-tool access

#### Scenario: A manual check cannot be executed

- **WHEN** an authenticated interface, supported assistive technology, or required safe fixture is unavailable
- **THEN** the check is recorded as Blocked with the missing prerequisite and required evidence
- **AND** it is not reported as passing based on static inspection or unrelated automated coverage

### Requirement: QA covers representative source-document review states

EH-124 SHALL verify the available review workflow with a text-layer PDF, a page-only scan or image fallback, a multi-page document, an instrumental report where supported, and an older/reprocessed document. The checks SHALL verify source-page navigation, source-region highlighting where available, and explicit degradation when a precise region or a page preview is unavailable.

#### Scenario: A source region is available

- **WHEN** a tester selects an observation grounded to a source region in a text-layer PDF
- **THEN** the review workspace shows the correct page and visibly aligns the highlight with the quoted source
- **AND** the source remains aligned after supported zoom and page-navigation actions

#### Scenario: A precise source region is unavailable

- **WHEN** a tester selects an observation from a scan, image, ambiguous match, or other page-only fallback
- **THEN** the workspace identifies the result as page-only or document-only as applicable
- **AND** it does not draw an invented source-region highlight

### Requirement: QA verifies accessible available review controls

EH-124 SHALL verify keyboard-only operation and screen-reader output for all available blocking review controls: document navigation, zoom, row activation, selection, technical details, correction and undo controls when exposed, change history, acceptance or confirmation, and recovery actions. The evidence SHALL identify the browser and screen-reader pairing used.

#### Scenario: A keyboard-only reviewer completes an available action

- **WHEN** a tester navigates the current review workflow without a pointer
- **THEN** focus reaches every available blocking control in a logical order with a visible focus indicator
- **AND** Enter or Space activates the control without losing the reviewer's context unexpectedly

#### Scenario: A screen-reader user receives a state change

- **WHEN** a selected row changes page/source context, a recovery state appears, or an action fails
- **THEN** the tester can identify the affected result or control and the resulting state through its accessible name, role, or announcement
- **AND** no blocking control depends on visual-only information

### Requirement: QA verifies resilient evidence and correction presentation

EH-124 SHALL verify that long filenames, analyte names, raw values, reference text, source snippets, correction reasons, and history entries remain readable and operable at supported viewport sizes. It SHALL also verify that absent ranges or incomplete measurement axes remain explicit and do not fabricate clinical evidence or force an incompatible mapping.

#### Scenario: A review row contains long evidence

- **WHEN** a tester opens a review row with deliberately long synthetic evidence
- **THEN** its controls remain reachable and distinguishable without clipped or overlapping critical content
- **AND** the row retains its source and correction affordances

#### Scenario: A range or clinical axis is absent

- **WHEN** a tester reviews a synthetic result with no printed reference range or with an incomplete measurement identity
- **THEN** the workspace presents the absence plainly and preserves the raw or partial result
- **AND** it does not require the reviewer to select an unsupported concrete mapping

### Requirement: QA verifies distinct recovery and retry paths

EH-124 SHALL verify initial review-workspace loading failure, page-preview loading failure, worker-offline or stuck-processing recovery, and failed review writes as distinct conditions. Each case SHALL verify an actionable retry or reprocess path and the absence of a false success state.

#### Scenario: A page preview cannot be loaded

- **WHEN** the current page preview request fails
- **THEN** the workspace identifies the page-preview failure and offers a retry action
- **AND** retrying does not lose the selected document or incorrectly mark review as complete

#### Scenario: Processing is unavailable

- **WHEN** processing is reported as unavailable or stuck
- **THEN** the workspace provides the available status-retry and reprocess actions with understandable state text
- **AND** the tester can distinguish retrying status from starting a new processing attempt

### Requirement: Release evidence preserves dependency and defect truthfulness

EH-124 SHALL publish a regression and triage report containing the results of the existing EH-118, EH-119, and EH-121 automated suites, every manual QA result, and a link to each discovered defect. A P0 defect or inaccessible blocking control SHALL be triaged before release acceptance. A case requiring an unavailable EH-120 verification transition SHALL be recorded as Blocked with EH-120 named as the dependency.

#### Scenario: Existing automated contracts regress

- **WHEN** the EH-118, EH-119, or EH-121 regression suite fails during the QA run
- **THEN** the report records the exact failing command and output reference
- **AND** the release gate is not accepted until the regression is resolved or explicitly dispositioned by the release owner

#### Scenario: EH-120 workflow controls are unavailable

- **WHEN** a planned state-transition case requires EH-120 controls not present in the product
- **THEN** the QA record marks the case Blocked and names EH-120
- **AND** the report does not claim certification of the complete verification-state workflow
