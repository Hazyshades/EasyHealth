## MODIFIED Requirements

### Requirement: Extract qualitative laboratory lines

Document lab extraction SHALL emit structured biomarker candidates for qualitative and semi-quantitative laboratory results, not only quantitative numbers. For qualitative results the pipeline SHALL preserve the laboratory’s verbatim value text in the source language and MAY derive a separate normalized qualitative interpretation for kind/ordinal handling.

#### Scenario: Pipeline returns qualitative biomarker

- **WHEN** the lab PDF contains a dipstick result such as Leukocyte esterase Negative
- **THEN** the extraction pipeline produces a structured biomarker with text value and extractable label fields
- **AND** does not drop the line solely because it is non-numeric

#### Scenario: Russian qualitative value preserved

- **WHEN** the lab report prints a qualitative result such as `Отрицательно`
- **THEN** the extracted raw value text retains `Отрицательно`
- **AND** any normalized Positive/Negative token is stored separately rather than replacing the verbatim text

### Requirement: Emit provenance on extraction

The extraction pipeline SHALL populate provenance fields on extracted biomarkers when the model or OCR context provides them (page, snippet, confidence) and SHALL write page OCR artifacts using the versioned schema. The pipeline SHALL also populate a verbatim source label field (`raw_name` or equivalent) copied from the document without requiring translation into English.

#### Scenario: Extracted row includes confidence and page

- **WHEN** extraction succeeds for a lab page with OCR context
- **THEN** extracted biomarkers include confidence when available
- **AND** include source_page when page context is known

#### Scenario: Verbatim non-English label stored

- **WHEN** extraction reads a printed label `Глюкоза` or `Hemoglobina`
- **THEN** the stored verbatim label field equals that printed label
- **AND** an English canonical key or translated name, if present, is stored only as a non-authoritative parallel field

## ADDED Requirements

### Requirement: Extraction treats canonical English as soft assist only

Laboratory extraction MAY emit an English snake_case key and an English-oriented display name as hints. Those hints MUST NOT be the sole identity used for Registry 2.0 concrete resolution. Downstream resolution SHALL prefer the verbatim label against reviewed multilingual aliases. If the document is clearly not a laboratory report, extraction SHALL return an empty biomarkers array and MUST NOT invent catalog entries.

#### Scenario: English key hint without alias remains non-concrete

- **WHEN** extraction emits `key: "glucose"` but the verbatim label does not match any authorized alias and no other authoritative evidence exists
- **THEN** resolution MUST NOT become `resolved` solely from that key

#### Scenario: Non-lab document yields empty extract

- **WHEN** the document is clearly not a laboratory report
- **THEN** the biomarkers array is empty
- **AND** no measurement definitions are created
