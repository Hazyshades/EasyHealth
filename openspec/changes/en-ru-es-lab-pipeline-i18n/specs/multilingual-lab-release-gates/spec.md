## ADDED Requirements

### Requirement: Fixture language authenticity

Every corpus document or row fixture that declares `language` as `en`, `ru`, or `es` SHALL contain operative measurement labels that authentically represent that language. A fixture MUST NOT be accepted as RU coverage when its labels are English-only, nor as ES coverage when its labels are English-only. Mixed labels that combine a localized name with an international code (for example `Гемоглобин (HGB)` or `Hemoglobina (HGB)`) are valid bilingual wording but DO NOT replace the requirement for pure-language coverage classes in the multilingual launch slice.

#### Scenario: English-labeled RU document fails authenticity

- **WHEN** a fixture declares `language: "ru"` and all `rawLabel` values are English clinical phrases without Russian content
- **THEN** corpus validation fails authenticity for that fixture
- **AND** the candidate cannot count that fixture toward RU coverage

#### Scenario: Pure Cyrillic fixture counts as RU

- **WHEN** a de-identified fixture declares `language: "ru"` and includes pure-Cyrillic labels such as `Глюкоза` and `ТТГ`
- **THEN** validation accepts the fixture as RU text coverage for those rows

#### Scenario: Spanish diacritic fixture counts as ES

- **WHEN** a fixture declares `language: "es"` and includes labels with Spanish wording and diacritics where applicable
- **THEN** validation accepts the fixture as ES text coverage

### Requirement: Multilingual corpus classes

The candidate-release corpus SHALL include genuine fixtures for EN, RU, and ES that collectively cover:

- pure localized labels (Cyrillic for RU; Spanish for ES);
- mixed localized name + international abbreviation forms;
- OCR noise variants appropriate to each language pack;
- unknown biomarkers that must remain `unmapped`;
- ambiguous cases where similar labels could refer to different measurements.

#### Scenario: Unknown biomarker stays unmapped in each language

- **WHEN** a fixture row in EN, RU, or ES uses a label with no authorized alias
- **THEN** the expected and actual resolver result is `unmapped`
- **AND** no new measurement definition is created

#### Scenario: Ambiguous fixture is not auto-resolved

- **WHEN** a language-specific fixture is authored as ambiguous
- **THEN** the corpus expects `ambiguous` (or another non-`resolved` outcome per fixture)
- **AND** a `resolved` actual result counts as a false concrete resolution

### Requirement: Language-segmented metrics and thresholds

Candidate-release reports SHALL compute recognition, resolution outcomes, false concrete resolutions, alias/normalize failures, and threshold checks **separately** for `en`, `ru`, and `es`. A high aggregate score MUST NOT mark the candidate launchable when any required language segment fails its thresholds or authenticity checks. The existing English corpus SHALL remain a non-regressable segment.

#### Scenario: RU segment failure blocks release despite strong EN

- **WHEN** EN segment metrics pass and RU segment false-resolution or authenticity checks fail
- **THEN** the candidate report records a failed RU threshold or gate
- **AND** CI rejects launch approval

#### Scenario: Aggregate cannot hide ES failure

- **WHEN** combined EN+RU+ES aggregate recognition looks high but ES diacritic alias matching fails its gate
- **THEN** the candidate is not launchable

#### Scenario: English non-regression

- **WHEN** multilingual changes are introduced
- **THEN** the EN segment remains within configured non-regression thresholds for locked English fixtures

### Requirement: Hard multilingual normalize gates

Release validation SHALL include automated checks that:

- a pure-Cyrillic alias does not normalize to an empty string;
- Spanish aliases with diacritics match under the primary label normalizer;
- extraction fixtures assert verbatim raw label preservation for non-English rows;
- unknown rows remain unmapped without catalog mutation;
- ambiguous rows are not auto-accepted as concrete measurements.

#### Scenario: Pure-Cyrillic empty-normalize gate

- **WHEN** any active RU alias in the candidate catalog normalizes to empty
- **THEN** the multilingual release gate fails

#### Scenario: Verbatim raw label gate on RU extraction fixture

- **WHEN** an extraction contract fixture supplies a Russian printed label
- **THEN** the expected stored raw label equals the printed label
- **AND** an English-only substitution without the raw field fails the fixture
