## ADDED Requirements

### Requirement: Resolver-ready extraction evidence
The document pipeline SHALL preserve raw label, raw value/text, raw unit, reference-range text, document/page provenance, extraction confidence, specimen, modifier, and available section context for each extracted laboratory line.

#### Scenario: Extraction proposes a biomarker key
- **WHEN** an extraction model supplies a biomarker key for a laboratory line
- **THEN** the pipeline stores the proposal as non-authoritative input evidence
- **AND** context-aware resolution determines the active measurement classification
