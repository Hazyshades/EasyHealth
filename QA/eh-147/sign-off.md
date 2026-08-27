# EH-147 Health Profile v1 sign-off

Pack version: `eh147-golden-v1`
Algorithm version: `eh145-score-v1`
Technical pack hash: `6fcbe8567c0173062bfbfce6a9c9f9469843ff49d02faba60369f51be506a7ed`

| Accountable role | Decision | Current state | Evidence |
| --- | --- | --- | --- |
| Engineering | Golden cases match production admission, readiness, scores, and SI/US presentation | `IMPLEMENTED` | `pnpm test:eh147` |
| Clinical Product | Approve expected outputs as Health Profile v1 current-state assessments | `PENDING` | `QA/eh-147/approvals.json` is empty; `pnpm check:eh147` fails closed |
| Clinical safety / release owner | Accept Health Profile v1 only after Clinical Product hash-bound approval | `PENDING` | Issue #47 |

Do not record Health Profile v1 as accepted while Clinical Product approval is pending or bound to a different pack hash.
