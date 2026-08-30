## ADDED Requirements

### Requirement: Repository text and binary attributes are deterministic
The repository SHALL check out text files with LF line endings and SHALL classify PDF, image, and font files as binary.

#### Scenario: Contributor checks out a text source file
- **WHEN** Git applies repository attributes
- **THEN** the text file SHALL use LF
- **AND** binary fixtures SHALL not undergo line-ending conversion.