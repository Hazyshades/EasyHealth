## 1. Policy

- [x] 1.1 Add the Wiki-tail / not-a-sprint rule and the `git ls-remote` Wiki probe to `docs/07-ops/registry-documentation-sync.md`.
- [x] 1.2 Mirror the same rule in `.agents/skills/registry-documentation-sync/SKILL.md` and `AGENTS.md`.
- [x] 1.3 Note in `.github/ISSUE_TEMPLATE/registry-documentation-update.md` that Wiki `PENDING` from a GraphQL `.wiki` miss is an ops tail, not a feature.

## 2. Close leftover tracking

- [x] 2.1 Close https://github.com/Hazyshades/EasyHealth/issues/150 as a Wiki ops tail (canonical docs green; GraphQL Wiki probe; not next sprint).
- [x] 2.2 Close https://github.com/Hazyshades/EasyHealth/issues/158 with the same disposition.
- [x] 2.3 Close https://github.com/Hazyshades/EasyHealth/issues/159 as leftover tracking (Wiki already `PUBLISHED`).
- [x] 2.4 Close https://github.com/Hazyshades/EasyHealth/issues/167 as leftover tracking (Wiki already `PUBLISHED`).

## 3. Verify

- [x] 3.1 `openspec validate close-registry-docs-wiki-tails --type change --strict`
- [x] 3.2 Confirm issues #150, #158, #159, and #167 are `CLOSED` and no open `[Registry Docs]` issues remain for those four numbers.
