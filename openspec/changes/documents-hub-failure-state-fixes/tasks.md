## 1. Documents Hub failure handling

- [x] 1.1 Preserve a failed server initial Lab results payload as an immediately visible error state; prevent the initial effect from automatically fetching until Retry or a tab change.
- [x] 1.2 Make failed soft periodic list refreshes set the recoverable error state without turning the refresh into a hard loading state.
- [x] 1.3 Keep successful Retry and successful periodic refresh behavior clearing errors and preserving the existing no-loading-flash contract.

## 2. Regression evidence

- [x] 2.1 Extend the Documents Hub/navigation regression coverage for server-initial failure, failed client tab fetch, failed periodic refresh, and successful Retry recovery.
- [x] 2.2 Update `QA/app-navigation-hot-path/checklist.md` with separate reproducible server-wrapper and browser client-fetch failure procedures, safe preconditions, expected generic copy, Retry recovery, and genuine empty-state checks.
- [x] 2.3 Run `pnpm typecheck`, `pnpm test:app-navigation-hot-path`, and `openspec validate documents-hub-failure-state-fixes --strict`.
