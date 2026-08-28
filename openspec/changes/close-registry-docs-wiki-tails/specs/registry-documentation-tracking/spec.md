## ADDED Requirements

### Requirement: Registry Docs tracking issues SHALL NOT be product sprint items when only a Wiki tail remains

A GitHub issue titled with the `[Registry Docs]` prefix SHALL be an index and publication record. It SHALL NOT be scheduled as product/sprint feature work when all of the following are true:

- Canonical generated Registry documentation is current (`pnpm generate:biomarker-docs`, `pnpm check:biomarker-docs`, and `pnpm test:biomarker-docs` already passed or were intentionally confirmed unchanged).
- The source change introduced no Registry definition, alias, unit, resolver, assessment, corpus, or persistence contract delta that still needs documentation.
- The only remaining gap is remote Wiki `PENDING`/`BLOCKED`, or the issue is still open after Wiki status was already recorded `PUBLISHED`.

#### Scenario: Canonical-green Wiki PENDING issues are ops tails

- **WHEN** #150 (EH-128) or #158 (EH-129) has green canonical docs and Wiki status `PENDING` only because `gh repo view Hazyshades/EasyHealth.wiki` cannot resolve a Repository
- **THEN** the issues SHALL be classified as Wiki ops tails
- **AND** they SHALL NOT be taken as the next sprint
- **AND** they SHALL be closed with that disposition rather than implemented as features

#### Scenario: Already-published leftover tracking issues are closed

- **WHEN** #159 (EH-130) or #167 (EH-131) already records Wiki `PUBLISHED` and green canonical docs
- **THEN** the open issues SHALL be closed as leftover tracking
- **AND** they SHALL NOT be scheduled as sprint work

### Requirement: Wiki existence SHALL be probed with git, not GraphQL repository view

Agents and maintainers SHALL treat `gh repo view owner/repo.wiki` GraphQL failure as expected for GitHub Wikis. Confirmation that the Wiki git remote exists SHALL use `git ls-remote https://github.com/Hazyshades/EasyHealth.wiki.git` (or the equivalent git URL). A GraphQL miss alone SHALL NOT be recorded as “the Wiki repository does not exist” and SHALL NOT create product work.

#### Scenario: GraphQL miss with live git remote

- **WHEN** `gh repo view Hazyshades/EasyHealth.wiki` returns that the Repository cannot be resolved
- **AND** `git ls-remote https://github.com/Hazyshades/EasyHealth.wiki.git` returns `refs/heads/master`
- **THEN** the Wiki remote SHALL be treated as present
- **AND** a `[Registry Docs]` issue SHALL NOT be kept open as sprint work solely because of the GraphQL miss
