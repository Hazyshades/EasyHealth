## Why

Four open `[Registry Docs]` issues (#150, #158, #159, #167) look like leftover product work. They are not. Canonical Registry docs for those source changes are already green. The remaining gap is either a GitHub Wiki GraphQL probe that cannot resolve `Hazyshades/EasyHealth.wiki` as a Repository, or a tracking issue left open after the Wiki was already recorded `PUBLISHED`. Planning them as the next sprint wastes a feature slot on an ops tail.

## What Changes

- Classify `[Registry Docs]` issues whose only remaining gap is remote Wiki `PENDING`/`BLOCKED` (canonical docs green; no catalog/resolver/product delta) as ops Wiki tails, not roadmap features.
- Record that `gh repo view owner/repo.wiki` is not a Wiki-existence probe: GitHub Wikis are not GraphQL Repositories. Use `git ls-remote https://github.com/Hazyshades/EasyHealth.wiki.git`.
- Close #150, #158, #159, and #167 with that disposition. Do not schedule them as sprint work. Do not republish the Wiki as part of this change.
- Encode the classification in the Registry documentation sync policy, agent skill, `AGENTS.md`, and issue template.

## Capabilities

### New Capabilities

- `registry-documentation-tracking`: How `[Registry Docs]` tracking issues relate to product sprints, Wiki publication status, and GraphQL vs git Wiki probes.

### Modified Capabilities

- (none)

## Impact

- GitHub issues #150, #158, #159, #167 close as ops tails.
- `docs/07-ops/registry-documentation-sync.md`, `.agents/skills/registry-documentation-sync/SKILL.md`, `AGENTS.md`, and `.github/ISSUE_TEMPLATE/registry-documentation-update.md` gain the Wiki-tail rule.
- No Registry catalog, resolver, Health Profile, or generated-doc content change.
- Remote Wiki is not mutated.
