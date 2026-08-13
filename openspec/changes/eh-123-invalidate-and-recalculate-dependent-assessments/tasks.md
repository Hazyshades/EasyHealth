## 1. Assessment persistence and event admission

- [x] 1.1 Add the EH-123 migration for private dependency events, recalculation jobs, immutable assessment versions, and event receipts.
- [x] 1.2 Capture only live EH-121 events transactionally, enqueue/coalesce Health Profile work, and bootstrap current eligible profiles without replaying backfill history.
- [x] 1.3 Add atomic database RPCs to claim, complete, fail, retry, and reclaim assessment jobs while enforcing lease, receipt, and immutable-version invariants.
- [x] 1.4 Replace mutable synthesis-cache persistence with immutable synthesis versions and stale-state projection.

## 2. Shared Health Profile calculation

- [x] 2.1 Extract a server-safe, deterministic Health Profile snapshot builder shared by the API and worker.
- [x] 2.2 Canonicalize document and observation ordering before deriving the snapshot input hash.
- [x] 2.3 Update the Health Profile API to serve latest successful assessment version, pending fallback, synthesis state, and no-store responses without GET-time generation.
- [x] 2.4 Update Biomarkers responses with explicit no-store behavior while retaining active-revision projection.

## 3. Recalculation worker and synthesis refresh

- [x] 3.1 Extend the existing worker poll/claim loop to process and complete Health Profile recalculation jobs.
- [x] 3.2 Add bounded retry, stale-claim reclamation, and safe failure recording for assessment jobs.
- [x] 3.3 Change explicit synthesis refresh to append an immutable current-input version and clear stale state only after commit.
- [x] 3.4 Surface recalculation/synthesis pending and failure status in the Health Profile UI, including an authorized retry action when available.

## 4. Regression coverage and delivery evidence

- [x] 4.1 Add pgTAP coverage for transactional event admission, backfill exclusion, coalescing, claims, retries, immutable versions, and synthesis stale/version invariants.
- [x] 4.2 Add focused TypeScript/worker/API contracts for canonical snapshots, version selection, no-store responses, retries, and no GET-time synthesis generation.
- [x] 4.3 Register focused EH-123 test commands in package scripts and disposable-database CI.
- [x] 4.4 Create `QA/eh-123/checklist.md` with manual Health Profile refresh/status checks and developer-only database/concurrency evidence.
- [x] 4.5 Run focused tests, typecheck, strict OpenSpec validation, and record unavailable manual-environment evidence.