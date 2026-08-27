## ADDED Requirements

### Requirement: Printed comparator results SHALL remain text

The laboratory value parser SHALL classify a cell whose leading token is a comparator (`<`, `>`, `≤`, `≥`, `<=`, `>=`) followed by a number as `value_kind` `text`. It SHALL store the printed cell text verbatim in `value_text` and SHALL set `value` to null. Dipstick ordinal grades such as `2+` SHALL be classified as ordinal before the comparator branch. The extraction value path SHALL NOT recover a number from such a cell via `parseLabNumber`.

#### Scenario: Less-than detection limit stays printed

- **WHEN** a laboratory cell is printed as `< 0.20`
- **THEN** the parsed result has `value_kind` `text`
- **AND** `value_text` is `< 0.20`
- **AND** `value` is null

#### Scenario: Greater-than result stays printed

- **WHEN** a laboratory cell is printed as `> 10`
- **THEN** the parsed result has `value_kind` `text`
- **AND** `value_text` is `> 10`
- **AND** `value` is null

#### Scenario: Dipstick grade remains ordinal

- **WHEN** a laboratory cell is printed as `2+`
- **THEN** the parsed result has `value_kind` `ordinal`
- **AND** `value_text` preserves `2+`
- **AND** an ordinal rank is stored

#### Scenario: Extraction does not rescue a comparator as a number

- **WHEN** pipeline extraction receives a biomarker `value` of `< 0.20`
- **THEN** the staged row is not numeric `0.2`
- **AND** `parseLabNumber` is not used to invent a magnitude for that cell

### Requirement: Comparators SHALL NOT occupy the modifier axis

Extraction SHALL place comparators on the result `value`, never on `modifier`. A modifier that is only punctuation or a spelled comparator (`<`, `>`, `less than`, `greater than`) SHALL be coerced to `none`.

#### Scenario: Prompt forbids comparator modifiers

- **WHEN** the laboratory extraction prompt is issued
- **THEN** it instructs the model to copy printed comparators onto `value` as text
- **AND** it forbids putting `<`, `>`, or `less than` on `modifier`

#### Scenario: Punctuation modifier is coerced

- **WHEN** the model emits `modifier` `<` or `less than` for a censored result
- **THEN** the stored modifier is `none`
- **AND** the comparator remains on the value text when present

### Requirement: Acceptance and correction SHALL prefer printed comparator text

When extracted evidence includes comparator text, the acceptance writer and EH-119 correction base SHALL persist `value_kind` `text` with verbatim `value_text` and null numeric `value`, even if `value_numeric` already holds a synthesised number. Restating `< 0.20` SHALL remain text.

#### Scenario: Stale numeric yields to printed comparator

- **WHEN** an extracted row has `value_numeric` `0.2` and printed text `< 0.20`
- **THEN** the measurement used for acceptance or correction has `value` null
- **AND** `value_kind` is `text`
- **AND** `value_text` is the printed comparator string

#### Scenario: Reviewer restates a comparator as printed

- **WHEN** a reviewer restates the value as `< 0.20` through EH-119
- **THEN** the stored observation remains `value_kind` `text`
- **AND** no numeric `0.2` is synthesised

### Requirement: Biomarkers SHALL label threshold results and exclude them from numeric series

The Biomarkers table SHALL show status `Threshold result` for a comparator-bearing non-numeric observation. The comparison helper SHALL drop that row from numeric trend series so `0.20` is not plotted.

#### Scenario: Table status is Threshold result

- **WHEN** an observation stores printed text `< 0.20` with non-numeric `value_kind`
- **THEN** Biomarkers displays the printed text
- **AND** the status chip is `Threshold result`
- **AND** the chip is not Normal, Attention, or Low from native bounds

#### Scenario: Trend excludes the censored point

- **WHEN** the comparison helper builds a numeric series that includes a comparator-bearing observation
- **THEN** that observation is not projected as a connected numeric point

### Requirement: Health Profile SHALL treat censored results as unusable text

Health Profile laboratory admission SHALL NOT treat a comparator-bearing result as a finite numeric assessment input. A row whose printed text includes a result comparator SHALL be excluded even if a stale numeric `value` is still present.

#### Scenario: Censored text is not admitted

- **WHEN** a laboratory observation has printed value `< 0.20`
- **THEN** `projectHealthProfileLaboratoryInput` returns null
- **AND** assessment eligibility does not treat the row as a usable numeric value

#### Scenario: Stale numeric plus comparator text is still excluded

- **WHEN** an observation still has a finite numeric `value` and comparator-bearing `value_text`
- **THEN** it is not admitted to Health Profile scores

### Requirement: Regression evidence SHALL cover parser, consumers, and existing rows

The change SHALL ship a deterministic verifier `scripts/verify-eh164-censored-results.ts` wired as `pnpm test:eh164` on the CI verify job, a read-only SQL audit of already-corrupted rows with no UPDATE, and a tester-facing `QA/eh-164/checklist.md`.

#### Scenario: Verifier rejects numeric stripping

- **WHEN** `pnpm test:eh164` runs
- **THEN** it fails if `< 0.20` parses as numeric `0.2`
- **AND** it fails if `2+` is no longer ordinal
- **AND** it fails if a comparator occupies `modifier`

#### Scenario: Audit is read-only

- **WHEN** the EH-164 audit query is executed
- **THEN** it lists candidate corrupted extracted and observation rows
- **AND** it performs no UPDATE, DELETE, or schema change
