# Playwright E2E coverage map

`pnpm test:e2e` maps each browser test to the corresponding manual **Interface check**. All data is synthetic, scoped to one remote non-production run, and cleaned via the ownership ledger.

| Browser test | Fixture | Manual Interface check |
| --- | --- | --- |
| `EH101-UI-01` | `LAB-BASELINE` | [EH101-UI-01](eh-101/checklist.md#eh101-ui-01-existing-laboratory-document-remains-readable) |
| `EH101-UI-02` | `LAB-BASELINE` | [EH101-UI-02](eh-101/checklist.md#eh101-ui-02-source-navigation-still-works) |
| `EH101-UI-03` | `LAB-BASELINE` | [EH101-UI-03](eh-101/checklist.md#eh101-ui-03-biomarker-history-is-unchanged) |
| `EH102-UI-01` | `LAB-RESOLVED` | [EH102-UI-01](eh-102/checklist.md#eh102-ui-01-recognized-laboratory-value-is-shown-with-its-source) |
| `EH102-UI-02` | `LAB-RESOLVED` | [EH102-UI-02](eh-102/checklist.md#eh102-ui-02-reviewed-result-reaches-the-normal-biomarker-view) |
| `EH102-UI-03` | `LAB-PARTIAL` | [EH102-UI-03](eh-102/checklist.md#eh102-ui-03-incomplete-source-data-is-not-guessed) |
| `EH102-UI-04` | `LAB-AMBIGUOUS` | [EH102-UI-04](eh-102/checklist.md#eh102-ui-04-ambiguous-source-data-is-not-silently-merged) |
| `EH102-UI-05` | incomplete-only safety account | [EH102-UI-05](eh-102/checklist.md#eh102-ui-05-empty-resolved-trend-is-explained-safely) |
| `EH103-UI-01` | `LAB-PROVENANCE` | [EH103-UI-01](eh-103/checklist.md#eh103-ui-01-a-result-can-be-traced-back-to-the-document) |
| `EH103-UI-02` | `LAB-PROVENANCE` | [EH103-UI-02](eh-103/checklist.md#eh103-ui-02-accepted-result-keeps-its-raw-evidence-after-refresh) |
| `EH103-UI-03` | `LAB-PROVENANCE` | [EH103-UI-03](eh-103/checklist.md#eh103-ui-03-reprocessing-does-not-silently-rewrite-the-source-result) |
| `EH103-UI-04` | `LAB-PROVENANCE-PARTIAL` | [EH103-UI-04](eh-103/checklist.md#eh103-ui-04-unresolved-data-remains-visible-without-false-identity) |
| `EH104-UI-01` | `LAB-RESOLVED` | [EH104-UI-01](eh-104/checklist.md#eh104-ui-01-recognized-result-remains-consistent-after-a-normal-review) |
| `EH104-UI-02` | `LAB-NOT-RESOLVED` | [EH104-UI-02](eh-104/checklist.md#eh104-ui-02-a-non-resolved-source-does-not-become-a-trusted-trend) |
| `EH104-UI-03` | `LAB-RESOLVED` | [EH104-UI-03](eh-104/checklist.md#eh104-ui-03-reprocess-does-not-create-contradictory-visible-state) |
| `EH105-UI-01` | `INST-NORMAL` | [EH105-UI-01](eh-105/checklist.md#eh105-ui-01-instrumental-report-displays-its-source-findings) |
| `EH105-UI-02` | `INST-NORMAL` | [EH105-UI-02](eh-105/checklist.md#eh105-ui-02-normal-reprocessing-preserves-visible-findings) |
| `EH105-UI-03` | `INST-REPEAT` | [EH105-UI-03](eh-105/checklist.md#eh105-ui-03-similar-source-findings-are-not-visibly-collapsed) |
| `EH105-UI-04` | `INST-NORMAL` + `LAB-BASELINE` | [EH105-UI-04](eh-105/checklist.md#eh105-ui-04-instrumental-only-data-does-not-become-laboratory-assessment) |
| `EH105-UI-05` | `INST-FAILURE` | [EH105-UI-05](eh-105/checklist.md#eh105-ui-05-failed-write-is-visible-and-recoverable) |

## Developer evidence remains separate

These browser checks do not replace the **Developer evidence required** sections in the roadmap checklists. Keep using the existing static, registry, worker, migration, and local-Supabase commands for those claims, including:

- `pnpm verify:registry`
- `pnpm test:document-worker`
- `pnpm test:eh104-db` (requires local Supabase)
- `pnpm test:eh105`

When a local database prerequisite is unavailable, record that limitation separately; it is not browser coverage.
