## Context

Registry documentation sync already requires canonical `docs/`, generated-doc checks, a local Wiki render/export, and exactly one `[Registry Docs]` GitHub issue. Remote Wiki publication may be recorded `PENDING` or `BLOCKED` when the environment cannot confirm the GitHub Wiki.

Observed leftover issues:

| Issue | Source | Canonical docs | Wiki status in body | Real leftover |
| --- | --- | --- | --- | --- |
| #150 EH-128 | panel grouping consumer | green, no catalog delta | `PENDING` (`gh repo view` GraphQL miss) | ops tail |
| #158 EH-129 | comparison consumer | green, no catalog delta | `PENDING` (same probe) | ops tail |
| #159 EH-130 | archive projection | green, no catalog delta | `PUBLISHED` | leftover open issue |
| #167 EH-131 | navigation consumer | green, no catalog delta | `PUBLISHED` (matched then-HEAD `3c11859`) | leftover open issue |

`git ls-remote https://github.com/Hazyshades/EasyHealth.wiki.git` currently resolves (`refs/heads/master`). Later closed Registry Docs records (#168, #185, #188) already published the same seven-page generated mirror. `gh repo view Hazyshades/EasyHealth.wiki` still fails: Wikis are not GraphQL Repositories.

## Goals / Non-Goals

**Goals:**

- Stop treating these four issues as next-sprint features.
- Close them with an evidence-backed ops-tail disposition.
- Teach agents the Wiki probe and the “not a feature” rule so the queue does not refill.

**Non-Goals:**

- Publishing or rewriting the GitHub Wiki.
- Regenerating canonical biomarker docs.
- Changing Registry catalog, resolver, Health Profile, or EH-128/129/130/131 product behavior.
- Closing unrelated open Registry Docs issues.

## Decisions

1. **Tracking issues are not features.** A `[Registry Docs]` issue is an index. When canonical docs are green and the source change introduced no Registry semantic delta, an open issue is not a product backlog item.
2. **Wiki GraphQL 404 is expected.** Probe with `git ls-remote` on `EasyHealth.wiki.git`. Do not treat `gh repo view …wiki` failure as “Wiki does not exist” or as sprint work.
3. **Close, do not republish.** #150/#158 PENDING is superseded by later published mirrors. #159/#167 already record `PUBLISHED`. This change closes tracking; it does not copy pages into the Wiki.
4. **Policy lives with the existing sync docs**, not a new topic file: `docs/07-ops/registry-documentation-sync.md` plus the skill, `AGENTS.md`, and the issue template.

## Risks / Trade-offs

- Closing PENDING issues without a new Wiki commit leaves historical issue bodies saying PENDING. The closing comment is the disposition of record.
- A future agent might still open a duplicate `[Registry Docs]` issue for Wiki-only follow-up. The skill/template rule is the mitigation; it cannot prevent a human from filing one.
