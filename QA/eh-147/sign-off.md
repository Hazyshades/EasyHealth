# EH-147 Health Profile v1 sign-off

Pack version: `eh147-golden-v1`
Algorithm version: `eh145-score-v1`
Technical pack hash: `6fcbe8567c0173062bfbfce6a9c9f9469843ff49d02faba60369f51be506a7ed`

| Accountable role | Decision | Current state | Evidence |
| --- | --- | --- | --- |
| Engineering | Golden cases match production admission, readiness, scores, and SI/US presentation | `IMPLEMENTED` | `pnpm test:eh147` |
| Clinical Product | Approve expected outputs as Health Profile v1 current-state assessments | `APPROVED` | Hash-bound record in `QA/eh-147/approvals.json` for pack `6fcbe8567c0173062bfbfce6a9c9f9469843ff49d02faba60369f51be506a7ed`; Project Owner performing Clinical Product on `2026-08-27`; `pnpm check:eh147` |
| Clinical safety / release owner | Accept Health Profile v1 only after Clinical Product hash-bound approval | `APPROVED` | Clinical Product approval bound to the current pack hash; Issue #47 |

Health Profile v1 is accepted only for this pack hash. A later pack change requires a new hash-bound Clinical Product approval.
