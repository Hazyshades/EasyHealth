# EasyHealth Documentation

Evidence-based product documentation for the **PHR (Personal Health Record)** application.
This docs tree describes what is built, where it lives in code, and how requirements trace to implementation.

## Scope

| In scope |
|----------|
| Authentication, onboarding, dashboard |
| Documents, worker, viewer, extraction |
| Health profile, biomarkers, reports |
| AI extraction, medical safety |

## Documentation model

```
OpenSpec specs (openspec/specs/)     ← requirements source of truth
        ↓
Requirement IDs (REQ-*)
        ↓
Traceability matrix                  ← proof of implementation
        ↓
Feature map + module docs            ← what & where
        ↓
Architecture + pipeline specs          ← how it works
        ↓
ADR log                              ← why decisions were made
        ↓
QA checklists (qa-tests.md)          ← verification status
```

## Diátaxis map

| Type | Folder | Purpose |
|------|--------|---------|
| **Explanation** | `00-product/`, `02-architecture/` | Why & how the system works |
| **Reference** | `04-api/`, `05-data/`, `06-ai/` | Exact routes, tables, rules |
| **How-to** | `07-ops/` | Run locally, worker, reprocess |
| **Tutorial** | `09-qa/demo-scenarios.md` | End-to-end walkthroughs |

## Quick links

### Product
- [Product overview](./00-product/product-overview.md)
- [Feature map](./00-product/feature-map.md)
- [User flows](./00-product/user-flows.md)
- [Roadmap & deferred](./00-product/roadmap.md)

### Requirements
- [Requirements index](./01-requirements/requirements.md)
- [**Traceability matrix**](./01-requirements/traceability-matrix.md) ← start here
- [Acceptance criteria](./01-requirements/acceptance-criteria.md)

### Architecture
- [Architecture overview](./02-architecture/architecture-overview.md)
- [Document processing pipeline](./02-architecture/document-processing-pipeline.md)
- [AI pipeline](./02-architecture/ai-pipeline.md)
- [Data flow](./02-architecture/data-flow.md)

### Modules
- [Auth & profile](./03-modules/auth-profile.md)
- [Onboarding](./03-modules/onboarding.md)
- [Dashboard](./03-modules/dashboard.md)
- [Documents hub](./03-modules/documents.md)
- [Document viewer](./03-modules/document-viewer.md)
- [Biomarkers](./03-modules/biomarkers.md)
- [Health profile](./03-modules/health-profile.md)
- [Reports](./03-modules/reports.md)

### Reference
- [Human-facing API](./04-api/human-api.md)
- [Database schema](./05-data/database-schema.md)
- [Migrations](./05-data/migrations.md)
- [Biomarker Registry v1.0.0 baseline](../registry/biomarker-registry/v1.0.0/AUDIT.md)
- [AI providers](./06-ai/ai-providers.md)
- [Registry 2.0 biomarker catalog](./05-data/biomarker-catalog.md)
- [Registry 2.0 biomarker aliases](./05-data/biomarker-aliases.md)
- [Registry 2.0 corpus evidence](./05-data/biomarker-corpus-evidence.md)
- [Medical safety](./06-ai/medical-safety.md)

### Operations
- [Local development](./07-ops/local-dev.md)
- [Environment variables](./07-ops/env-vars.md)
- [Worker runbook](./07-ops/worker-runbook.md)
- [Registry documentation synchronization](./07-ops/registry-documentation-sync.md)

### Decisions
- [ADR index](./08-adr/README.md)

### QA
- [Regression checklist](./09-qa/regression-checklist.md)
- [Demo scenarios](./09-qa/demo-scenarios.md)
- Full checklist: [`/qa-tests.md`](../qa-tests.md) (repo root)

<!-- generated-biomarker-docs:start -->
## Generated biomarker reference data

Registry 2.0 biomarker references are generated from the typed catalog and approval-independent technical corpus (113 definitions; 637 EN/RU/ES aliases). Do not edit generated files manually.

```text
pnpm generate:biomarker-docs
pnpm check:biomarker-docs
pnpm test:biomarker-docs
```
<!-- generated-biomarker-docs:end -->

## Status legend

| Status | Meaning |
|--------|---------|
| `LIVE` | User-facing, code complete, intended for use |
| `IMPLEMENTED` | Code exists; manual QA incomplete |
| `PARTIAL` | Subset of flow works |
| `PLACEHOLDER` | UI only, no backend |
| `DEFERRED` | Explicitly out of current scope |
| `BLOCKED` | Blocked by env / dependency |
