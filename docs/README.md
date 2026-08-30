# EasyHealth Documentation

Evidence-based documentation for the EasyHealth personal health record platform. This index lists only tracked, maintained documentation targets.

## Documentation model

OpenSpec specifications define requirements; operations and data documentation explain the current implementation and verification paths.

## Available documentation

### Operations

- [Local pgTAP against Docker](./07-ops/local-pgtap.md)
- [Registry documentation synchronization](./07-ops/registry-documentation-sync.md)

### Data and Registry

- [Biomarker module](./03-modules/biomarkers.md)
- [Medical-event model](./05-data/medical-event-model.md)
- [Registry 2.0 biomarker catalog](./05-data/biomarker-catalog.md)
- [Health Profile score-readiness policy](./05-data/score-required-groups.md)
- [Registry 2.0 biomarker aliases](./05-data/biomarker-aliases.md)
- [Registry 2.0 corpus evidence](./05-data/biomarker-corpus-evidence.md)

### Agent guidance

- [Domain documentation workflow](./agents/domain.md)
- [Issue tracker workflow](./agents/issue-tracker.md)

<!-- generated-biomarker-docs:start -->
## Generated biomarker reference data

Registry 2.0 biomarker references are generated from the typed catalog and approval-independent technical corpus (113 definitions; 637 EN/RU/ES aliases). Do not edit generated files manually.

```text
pnpm generate:biomarker-docs
pnpm check:biomarker-docs
pnpm test:biomarker-docs
```
<!-- generated-biomarker-docs:end -->
