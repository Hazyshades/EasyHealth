## MODIFIED Requirements

### Requirement: Unusable present alternatives expose invalid readiness reasons

The Health Profile SHALL distinguish a missing required group from a group with present but unusable alternatives. A present alternative that is nonnumeric, is a printed comparator or detection-limit result, lacks usable document-native reference bounds, has a mismatching reviewed specimen, or otherwise fails the usability predicate SHALL not unlock a score.

#### Scenario: Required alternative lacks a usable reference range

- **WHEN** a required alternative is present but has neither document-native reference bound
- **THEN** that group is not satisfied
- **AND** the system includes exactly one readiness reason with code `invalid`
- **AND** the reason identifies the group and the present alternative keys
- **AND** the system's score is `null`

#### Scenario: Context-only measurement is present

- **WHEN** an admitted context-only or contribution-only measurement is present while a required group is missing
- **THEN** that measurement does not satisfy the missing group
- **AND** the readiness reason remains `missing`

#### Scenario: Censored threshold result is present

- **WHEN** a required alternative is present as printed comparator text such as `< 0.20`
- **THEN** that alternative is not usable
- **AND** that group is not satisfied by the censored result
- **AND** the system's score is not unlocked by inventing a magnitude from the comparator
