---
name: pre-push-review
description: "Landing workflow for finished changes: verify locally, commit, run code-review against the base point, fix findings, then push/PR — with EasyHealth roadmap gates (QA checklist, registry docs sync) before an EH-xxx item is called done. Use when the user finishes work and wants to review before pushing, says 'review before push', 'готов к пушу', 'заревьюй и запушь', 'open PR', 'can I ship this', or asks about the order of commit/review/push."
---

# Pre-Push Review Workflow

Fixed order for landing changes. Never reorder: review sees only **committed** work, so committing first is what makes review possible.

## 1. Verify locally

Smoke-test the changed path (run the thing, exercise the change) before committing. A failing change must not enter review.

## 2. Commit locally

`git commit` — do NOT push yet. Uncommitted working-tree changes are invisible to `git diff <point>...HEAD` and would silently skip review.

## 3. Pin the review base

The fixed point = where this work started:

- feature branch → its merge-base with `main` (or the repo's default branch)
- stacked work → the parent commit
- explicit user instruction wins

Confirm it resolves (`git rev-parse`) and the diff is non-empty before invoking review.

## 4. Review — invoke the `code-review` skill

Run it with the pinned point ("review since <point>"). It produces two separate reports — **Standards** and **Spec** — and they stay separate: never merge or rerank across axes.

## 5. Fix findings

- Hard violations of documented standards and missing/wrong spec behaviour: fix now, extra commit.
- Judgement-call smells (Fowler baseline): fix if cheap and clearly better; otherwise note and move on. Do not relitigate taste endlessly before a push.
- If fixes were substantial, re-run `code-review` on the delta.

## 6. Deep quality pass (conditional)

Invoke `thermo-nuclear-code-quality-review` ONLY when: the diff is large (>~500 lines), it introduces new abstractions/modules, or it touched known-tangle areas. Small mechanical changes do not earn this pass.

## 7. Push / PR

Push the branch and open the PR. Link the spec/issue in the description; paste the one-line per-axis summary from step 4 into the PR body.

## EasyHealth roadmap gates (EH-xxx items)

An EH-xxx item is NOT done after step 7. Before updating the roadmap to done or closing its GitHub issue:

1. `QA/eh-xxx/checklist.md` exists and matches the implemented scope — invoke `roadmap-qa-checklists`; manual section for testers, developer-evidence section for DB/migration/concurrency assertions.
2. If the change touches Registry/biomarkers/resolver/corpus/assessment: full `registry-documentation-sync` completion gate (canonical docs, generated docs checks, Wiki render + publication status, tracking issue).
3. Record progress via `update-roadmap-progress`; archive the OpenSpec change via `openspec-archive-change` when the workflow requires it.

Skipping a gate because tooling/remote access is unavailable: finish all local work, record `PENDING`/`BLOCKED` with evidence in the tracking record — never claim completion.
