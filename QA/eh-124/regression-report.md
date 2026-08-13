# EH-124 Regression and Triage Report

**Status:** Release gate blocked
**Evidence date:** 2026-08-13
**Branch:** `eh-124-run-accessibility-and-review-workflow-qa @ ecff24f`

## Scope

EH-124 validates the available Documents review workflow: source provenance, corrections, history, accessible operation, resilient evidence presentation, and retry/recovery behavior. It does not certify the unavailable EH-120 full verification-state workflow.

## Automated regression evidence

| Command | Result | Observed evidence |
| --- | --- | --- |
| `pnpm typecheck` | Pass | TypeScript completed with no diagnostics. |
| `pnpm check:ci-suite-coverage-contract` | Pass | CI suite contract checks passed. |
| `pnpm check:ci-suite-coverage` | Pass | 55 covered suites; 0 local-only, 0 orphaned, 0 partial, and 0 invalid. |
| `pnpm test:document-review` | Pass | Document review static contract checks passed with CI placeholder environment variables. |
| `pnpm test:document-worker` | Pass | Document worker reliability checks passed. |
| `pnpm test:document-persistence-boundaries` | Pass | Laboratory persistence boundary checks passed. |
| `pnpm test:health-profile-lab-input` | Pass | Health Profile laboratory projection checks passed. |
| `pnpm verify:registry` | Pass | Registry, resolver, provenance, corpus, and CBC regression checks passed. |
| `pnpm test:eh111` | Pass | Clinical compatibility runner passed its unit, value-kind, specimen, and corpus cases. |
| `pnpm test:eh112` | Pass | Incomplete-outcome checks passed. |
| `pnpm test:eh113` | Pass | CBC launch catalog checks passed. |
| `pnpm test:eh116` | Pass | Registry reprocess batch checks passed. |
| `pnpm test:reason-class` | Pass | Incomplete reason-class checks passed. |
| `pnpm test:stated-axis` | Pass | Stated-axis evidence checks passed. |
| `pnpm test:eh118` | Pass | Source-region contract and provenance-adapter checks passed. |
| `pnpm test:eh119` | Pass | Observation correction, measurement override, and correction-flow checks passed. |
| `pnpm test:eh120` | Pass | Verification-transition static checks passed. |
| `pnpm test:eh121` | Pass | Observation change-history checks passed. |
| `pnpm test:eh122` | Pass | Batch-verification and batch-service checks passed. |
| `pnpm test:eh123` | Pass | Health Profile input and assessment-recalculation checks passed. |

## Manual QA evidence

All manual checks `EH124-UI-01` through `EH124-UI-10` are **Blocked**. The workspace has no configured local Supabase credentials, authenticated QA account, deployed QA URL, release-owner-provisioned recovery environment, or documented supported browser/screen-reader pairing. Only `.env.example` is present locally.

The checklist records the blocker beside every affected case. Synthetic long-evidence and missing-range PDFs were added under `lab_data/`; their text layer was verified with `pdftotext`. The text-layer PDF fixture already in the repository is ready for a provisioned run. The scan/image and instrumental fixtures must be supplied by the QA environment.

The database verification subset passed against the existing local schema for EH-104, EH-105, EH-106, PostgREST alias, EH-111, EH-114, alias order, stated axis, EH-118, EH-119, EH-120, EH-121, EH-122, EH-113, EH-116, PR2, resolver trace v2, and writer seam. EH-123 DB was not runnable because `public.assessment_dependency_events` is absent from the existing local schema; `supabase migration up --local` also stops at migration `058_eh123_complete_job_status.sql` against that stale schema. This is an environment/schema refresh limitation, not a product-pass claim.
## Defect triage

No automated regression failed. No manual case reached product execution, so this run found no confirmed accessibility or review-workflow defect to file. The unavailable manual environment is a release-evidence blocker, not evidence of a product defect.

## Dependency boundary

EH-120 remains an explicit blocked dependency for verification transitions, record rejection, supersession, and batch/retry controls that are not present in the product. EH-124 can certify neither those unavailable controls nor the complete verification-state workflow.

## Release decision

**Not accepted.** The available code-contract baseline is green, but the P0 release gate remains blocked until a release owner supplies an authenticated QA environment, a dedicated test account, recovery fixtures, and a supported browser/screen-reader baseline; then all blocked manual cases must be executed and any confirmed P0 defect triaged and retested.
