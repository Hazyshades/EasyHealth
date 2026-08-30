## ADDED Requirements

### Requirement: Report document selection uses an accessible dialog
The report document selector SHALL render in a portalled dialog with modal semantics, focus management, and Escape dismissal.

#### Scenario: User closes document selection with Escape
- **WHEN** the report document selector is open and the user presses Escape
- **THEN** the dialog SHALL close
- **AND** focus SHALL return to its trigger.

#### Scenario: User selects documents
- **WHEN** the dialog is open
- **THEN** Select all, Clear selection, additional settings, Cancel, and Add selected SHALL remain available.