# OpenSpec — EasyHealth

Specs are grouped by product domain. **CLI source of truth** stays flat under `specs/` (OpenSpec 1.5 does not yet discover nested `spec.md` paths). Browse by domain via `domains/` junctions.

## Layout

```
openspec/
├── config.yaml
├── README.md                 ← you are here
├── specs/                    ← flat capabilities (openspec validate --specs)
├── domains/                  ← browse by feature (junctions → specs/)
└── changes/
    └── archive/<domain>/     ← completed changes grouped by feature
```

## Domains

| Domain | Specs | Archived changes |
|--------|-------|------------------|
| [auth-shell](domains/auth-shell/) | App shell, onboarding, account, dashboard widgets | user-onboarding, wizard-legal, user-account-menu |
| [documents](domains/documents/) | Upload, processing, viewer, typed pipelines, extraction | document-intelligence, typed-document-pipelines (×2) |
| [health-profile](domains/health-profile/) | Health profile UI/API, biomarkers, holistic synthesis | health-profile-factual-drawer |
| [reports](domains/reports/) | Reports UI/API, multi-source context | reports-phase-1, reports-phase-2 |
| [ai-config](domains/ai-config/) | Per-profile LLM provider preference | — |

## Quick commands

```bash
openspec list --specs          # all 33 capabilities
openspec validate --specs      # validate main specs
openspec list                  # active changes (empty when none in flight)
```

## When hierarchical specs ship

OpenSpec [PR #839](https://github.com/Fission-AI/OpenSpec/pull/839) will allow moving `specs/<capability>/` into `specs/<domain>/<capability>/` with IDs like `documents/documents-hub`. Until then, use `domains/` for navigation only.
