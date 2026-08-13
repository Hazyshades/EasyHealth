# EH-124 Regression and Triage Report

**Status:** Release gate blocked
**Evidence date:** 2026-08-12
**Branch:** `eh-124-run-accessibility-and-review-workflow-qa`

## Scope

EH-124 validates the available Documents review workflow: source provenance, corrections, history, accessible operation, resilient evidence presentation, and retry/recovery behavior. It does not certify the unavailable EH-120 full verification-state workflow.

## Automated regression evidence

| Command | Result | Observed evidence |
| --- | --- | --- |
| `pnpm test:eh118` | Pass | Source-region contract and provenance-adapter checks passed. |
| `pnpm test:eh119` | Pass | Observation correction, measurement override, and correction-flow checks passed. |
| `pnpm test:eh121` | Pass | Observation change-history checks passed. |

## Manual QA evidence

All manual checks `EH124-UI-01` through `EH124-UI-10` are **Blocked**. The workspace has no configured local Supabase credentials, authenticated QA account, deployed QA URL, release-owner-provisioned recovery environment, or documented supported browser/screen-reader pairing. Only `.env.example` is present locally.

The checklist records the blocker beside every affected case. Synthetic long-evidence and missing-range PDFs were added under `lab_data/`; their text layer was verified with `pdftotext`. The text-layer PDF fixture already in the repository is ready for a provisioned run. The scan/image and instrumental fixtures must be supplied by the QA environment.

## Defect triage

No automated regression failed. No manual case reached product execution, so this run found no confirmed accessibility or review-workflow defect to file. The unavailable manual environment is a release-evidence blocker, not evidence of a product defect.

## Dependency boundary

EH-120 remains an explicit blocked dependency for verification transitions, record rejection, supersession, and batch/retry controls that are not present in the product. EH-124 can certify neither those unavailable controls nor the complete verification-state workflow.

## Release decision

**Not accepted.** The available code-contract baseline is green, but the P0 release gate remains blocked until a release owner supplies an authenticated QA environment, a dedicated test account, recovery fixtures, and a supported browser/screen-reader baseline; then all blocked manual cases must be executed and any confirmed P0 defect triaged and retested.
