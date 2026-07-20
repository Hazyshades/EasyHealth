## ADDED Requirements

### Requirement: Selected acceptance reports complete or partial per-row results

The document review UI SHALL render the result of every selected `POST /api/documents/:id/biomarkers/accept` row. It SHALL distinguish full success from partial success and display stable row-level failure codes without representing an incomplete result as a failed raw source observation. After a successful row result, the viewer SHALL refresh its bootstrap data and show the resulting active observation state.

#### Scenario: Selected acceptance partially succeeds

- **WHEN** a user accepts several selected extracted rows and one row returns `stale_revision_conflict`
- **THEN** the UI identifies the successful rows and the conflicting row separately
- **AND** it does not display a blanket “all accepted” success message

### Requirement: Incomplete raw acceptance remains visible as pending mapping

When a user accepts a partial, ambiguous, or unmapped row, the review UI SHALL preserve the raw result and communicate that it was accepted without a verified concrete mapping. It SHALL allow later compatible manual review without forcing a specimen, method, or other absent context.

#### Scenario: User accepts partial ALT without specimen

- **WHEN** a user accepts an ALT result whose specimen remains absent and resolver outcome is `partial`
- **THEN** the refreshed review state shows the raw accepted result with pending mapping status
- **AND** it does not claim serum/plasma identity or user verification

### Requirement: Single correction and undo expose CAS conflicts safely

The correction/undo UI SHALL submit one extracted biomarker per request and handle HTTP 409 `stale_revision_conflict` by refreshing current review state rather than retrying a stale mutation automatically. It SHALL surface compatible-definition validation errors without changing prior manual history.

#### Scenario: User undoes a superseded correction

- **WHEN** the undo request receives HTTP 409 because a newer revision is active
- **THEN** the UI informs the user that review state changed and reloads it
- **AND** it does not overwrite the newer correction
