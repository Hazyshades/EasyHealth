# Health Profile Architecture

Главный документ для учёта архитектурных идей и фактического состояния реализации.

## Артефакты обзора

1. [Общий обзор Health Profile](<./architecture-review-Health Profile only.html>)
   — исходный широкий review. В нём зафиксировано, **что можно сделать**.
2. [Уточнённый review laboratory admission](<./architecture-review-laboratory-admission-revised.html>)
   — отдельное углубление по выбранному пункту и его контракту.

## Связь шагов

Разобран пункт 1 из общего обзора `architecture-review-Health Profile only.html`:

1. По пункту 1 подготовлен более детальный HTML-review
   `architecture-review-laboratory-admission-revised.html`.
2. Уточнённый review был отдельно разобран и подтверждён.
3. На его основании создано ТЗ/OpenSpec
   `health-profile-admission-decision-contract`.

Таким образом, `proposal.md` — формализация второго, уточнённого плана,
а не отдельная первоначальная инициатива.

## Что можно сделать

| Пункт из общего обзора | Статус | Примечание |
| --- | --- | --- |
| Углубить laboratory assessment admission | **Сделано** | Реализован отдельный admission decision после Resolver/Registry 2.0. |
| Сконцентрировать score/readiness policy | **Сделано** | Добавлен отдельный `src/lib/health-profile-score-policy.ts`; `buildHealthProfile` только готовит candidates и собирает внешний `HealthProfileResult`. |
| Углубить assessment snapshot seam | **Частично** | Реализовано кэширование admission decisions в snapshot; полный redesign snapshot не выполнялся. |

## Что уже сделано

- Добавлен `projectHealthProfileLaboratoryAdmission` с решениями `accepted` / `excluded`.
- Сохранены outcome, exclusion reason, binding, verification, resolver evidence, candidates и версии.
- Snapshot переиспользует одно решение для Health Profile input, score exclusions и linked reported rows.
- Reported visibility и counts не зависят от admission policy.
- EH-164 censored values остаются text markers с `value: null` и не становятся числовыми score contributors.
- Добавлен fixed before/after baseline с проверкой inputs, exclusions, reported rows, counts и snapshot hash.
- Score/readiness policy централизует Registry-группы, latest-by-identity selection, freshness, readiness, scoring, confidence, provenance, exclusions и overall threshold; lifecycle job state остаётся отдельной осью EH-146.
- Добавлен термин `Assessment candidate` в `CONTEXT.md`; builder передаёт в policy все подготовленные факты, а policy возвращает выбранные наблюдения по системам.
- Создан формальный [OpenSpec / ТЗ](<../../../openspec/changes/health-profile-admission-decision-contract/>):
  - [proposal](<../../../openspec/changes/health-profile-admission-decision-contract/proposal.md>)
  - [design](<../../../openspec/changes/health-profile-admission-decision-contract/design.md>)
  - [behavior spec](<../../../openspec/changes/health-profile-admission-decision-contract/specs/health-profile-admission/spec.md>)
  - [tasks](<../../../openspec/changes/health-profile-admission-decision-contract/tasks.md>)
- Обновлён tracking issue [#247](https://github.com/Hazyshades/EasyHealth/issues/247).
- Wiki mirror опубликован коммитом [`0502d5c`](https://github.com/Hazyshades/EasyHealth.wiki/commit/0502d5c).

## Проверка текущего состояния

- `pnpm exec tsc --noEmit` — блокируется существующими ошибками `DocumentType` в document/timeline consumers и declarations в `src/lib/health-systems.ts`; ошибок score-policy в выводе нет.
- `pnpm test:eh141`, `pnpm test:eh143`, `pnpm test:eh144`, `pnpm test:eh145`, `pnpm test:eh146`, `pnpm test:eh147`, `pnpm test:eh164` — пройдены.
- `pnpm test:health-profile-drawer-status`, `pnpm test:health-profile-lab-input`, `pnpm test:biomarkers` — пройдены.
- Registry documentation synchronization — завершена: canonical docs сгенерированы и проверены, Wiki mirror опубликован, issue `#247` обновлён текущими ссылками и evidence.

Основной кодовый diff находится в рабочем дереве и пока не закоммичен в основном репозитории.
