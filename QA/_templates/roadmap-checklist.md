# EH-XXX: Short user-facing title

**Roadmap status:** Planned | In progress | Delivered  
**Build / environment:** `________`  
**Test run date:** `________`  
**Tester:** `________`

## What this checklist covers

Describe the user-visible behavior in two or three sentences. State any
important boundary in plain language.

## Before you start

- [ ] Use a dedicated test account.
- [ ] Use only synthetic or de-identified documents.
- [ ] Confirm the listed test data has finished processing, unless the check
  intentionally tests processing.

## Test data

| ID | Test document or setup | Purpose |
| --- | --- | --- |
| `EXAMPLE-01` | Describe a safe test document | Normal path |
| `EXAMPLE-02` | Describe incomplete or negative data | Safe failure path |

## Interface checks

### EHXXX-UI-01: Short outcome name

**Precondition:** State the exact starting state.

1. Go to **Screen name**.
2. Select or upload **test data ID**.
3. Click **control name**.

**Expected result:** Describe the visible result and what must not happen.

**Result:** `Pass | Fail | Blocked | N/A`  
**Notes / evidence link:** `________`

## Developer evidence required

Use this section for contracts that cannot be proven by a tester through the
interface.

- [ ] Name the automated test, CI job, migration check, or review evidence.
- [ ] State the condition it proves and who provides it.

## Out of scope or not manually testable yet

- State deferred roadmap work and unavailable UI explicitly.
- State the alternative evidence required for any internal-only behavior.
