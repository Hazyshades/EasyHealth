# Checklist: Resolver + specimen architecture review

Этот README — checklist по материалу из [architecture-review-Resolver + specimen.html](./architecture-review-Resolver%20%2B%20specimen.html).

- **Дата HTML-разбора:** 10 сентября 2026
- **Фокус:** Resolver, specimen provenance, исторические решения, Registry release identity и candidate corpus
- **Важно:** HTML содержит первичный разбор всех пяти кандидатов. Чек-лист ниже показывает, что уже оформлено отдельным решением/ТЗ, а что ещё нужно разобрать и закрыть.

## Легенда

- `[x]` — разобрано и оформлено текущими артефактами.
- `[ ]` — остаётся разобрать, согласовать или оформить.
- `Draft` — техническое ТЗ уже набросано, но пункт ещё не считается закрытым.

## Что уже сделано

- [x] Разобран главный кандидат **Make Resolver decision identity deep**.
- [x] Зафиксирована проблема: Resolver использует `specimenSource` и `capturedHeading`, а `buildInputEvidenceHash` их не учитывает.
- [x] Зафиксировано различие между stated specimen и reviewed-panel specimen даже при одинаковом effective specimen.
- [x] Определена граница `Resolver input identity`: она отдельна от `Resolution outcome`, `Decision trace`, Registry release и writer request hash.
- [x] Создан ADR: [`registry/adr/0002-resolver-input-identity.md`](../../registry/adr/0002-resolver-input-identity.md).
- [x] Создан общий tracking issue: [#248](https://github.com/Hazyshades/EasyHealth/issues/248).
- [x] Созданы два OpenSpec ТЗ:
  - [`prepare-resolver-evidence-identity`](../../openspec/changes/prepare-resolver-evidence-identity/) — основной контракт для Resolver input identity, подготовленного evidence, reprocessing и связанных writer-границ.
  - [`historical-persisted-decision-read`](../../openspec/changes/historical-persisted-decision-read/) — Draft ТЗ для соседнего кандидата с historical persisted read.
- [x] Оба OpenSpec change прошли `openspec validate --strict`.
- [x] Зафиксирован EH-164 invariant: accepted comparator/detection-limit marker остаётся factual text evidence (`value: null`, `value_kind: "text"`) и не становится числовым score/trend contribution.

## Что ещё остаётся разобрать

### 2. Collapse duplicate evidence admission

**Статус:** `[ ]` отдельный разбор не закрыт. В основном OpenSpec уже есть подготовительный evidence contract, но граница самостоятельного deep module ещё не согласована.

HTML указывает на дублирование в review builder и writer builder:

- очистка overrides;
- фильтрация unstated axes;
- построение provenance;
- применение reviewed-panel specimen policy.

Чек-лист закрытия:

- [ ] Найти все production callers, которые самостоятельно принимают evidence.
- [ ] Зафиксировать вход/выход evidence-admission module и порядок `stated-axis filtering → panel policy`.
- [ ] Разделить thin adapters для разных source-row shape и саму admission policy.
- [ ] Проверить preview, acceptance, correction, reprocessing и Health Profile на единый seam.
- [ ] Решить, достаточно ли текущего OpenSpec или нужен отдельный change.
- [ ] Добавить focused tests на policy ordering, no-match и conflict.

Источник: [`#evidence-admission`](./architecture-review-Resolver%20%2B%20specimen.html#evidence-admission).

### 3. Keep persisted decisions off the live Resolver

**Статус:** `Draft` — соседнее OpenSpec ТЗ создано, но отдельный кандидат ещё не закрыт как окончательное архитектурное решение и реализация не начата.

HTML указывает на два исторических read shape: active projection читает `resolver_evidence`, а technical details — `resolver_decision_trace`; при этом `buildNormalizationReview` сначала вызывает live Resolver даже для active revision.

Чек-лист закрытия:

- [ ] Утвердить active persisted revision как источник outcome, trace и исторического объяснения.
- [ ] Явно отделить active persisted read от pre-revision preview.
- [ ] Определить независимые оси `source` (`persisted`, `preview`, `none`) и `quality` (`available`, `unavailable`, `conflict`).
- [ ] Описать conflict/unavailable поведение без live fallback и без silent repair.
- [ ] Проверить все consumers: normalization review, incomplete outcomes, document details, Health Profile, reports и structured context.
- [ ] Проверить ownership checks, trace allowlisting и non-concrete candidate behavior.
- [ ] Перевести Draft OpenSpec в implementation-ready решение и связать его с Change A.

Источник: [`#historical-read`](./architecture-review-Resolver%20%2B%20specimen.html#historical-read).

### 4. Concentrate Registry release identity

**Статус:** `[ ]` пока только кандидат из HTML, отдельное ТЗ не оформлено.

HTML указывает, что release fields и digest provenance вручную собираются в writer, automatic verification, reprocessing diff и corpus path. `captureDeployedRelease()` централизует только reprocessing.

Чек-лист закрытия:

- [ ] Составить полный список release fields и version sources во всех callers.
- [ ] Решить границу Registry release identity module.
- [ ] Разделить live release metadata и historical source of truth.
- [ ] Проверить parity между decision, trace, reprocessing и corpus records.
- [ ] Определить, нужен ли отдельный OpenSpec change или это часть существующего контракта.
- [ ] Зафиксировать focused verification для digest/version drift.

Источник: [`#release-identity`](./architecture-review-Resolver%20%2B%20specimen.html#release-identity).

### 5. Make the release corpus a real Resolver adapter

**Статус:** `[ ]` speculative candidate, отдельное ТЗ не оформлено.

HTML указывает, что release corpus вручную восстанавливает Resolver input из source text, section context, stated axes и heading context. Production при этом имеет два других row adapter-а.

Чек-лист закрытия:

- [ ] Проверить, какие admission decisions corpus дублирует сейчас.
- [ ] Дождаться решения по shared evidence-admission seam.
- [ ] Спроектировать mutation-free adapter без переноса production persistence в corpus.
- [ ] Сравнить corpus и production prepared evidence на одинаковых fixtures.
- [ ] Проверить, что release gate ловит drift override, reference и value-kind admission.
- [ ] Решить, оправдан ли отдельный OpenSpec для speculative кандидата.

Источник: [`#corpus-adapter`](./architecture-review-Resolver%20%2B%20specimen.html#corpus-adapter).

## Текущий порядок работы

1. **Завершено как архитектурный контракт:** Resolver decision identity.
2. **Следующий отдельный разбор:** evidence admission, потому что identity должна получать уже подготовленное evidence и не дублировать policy.
3. **Параллельно уточняется Draft:** persisted-decision read; его OpenSpec уже создан, но решение нужно довести до implementation-ready состояния.
4. **После уточнения основных seam:** Registry release identity.
5. **Последним:** corpus adapter, поскольку он зависит от evidence-admission seam и остаётся speculative.

## Общие границы

- Input identity не равна outcome, trace, Registry release или writer request/idempotency hash.
- Stated specimen и policy-derived specimen не становятся одинаковыми только из-за совпадения effective specimen string.
- Persisted historical decision не должна объясняться текущим Registry/Resolver.
- Current Registry release не заменяет historical source of truth.
- Candidate corpus остаётся non-mutating и не создаёт production persistence.
- EH-164 marker не удаляется и не превращается в numeric score/trend contribution.

## Источники и артефакты

- HTML-review: [architecture-review-Resolver + specimen.html](./architecture-review-Resolver%20%2B%20specimen.html)
- ADR: [`registry/adr/0002-resolver-input-identity.md`](../../registry/adr/0002-resolver-input-identity.md)
- Issue: [Hazyshades/EasyHealth#248](https://github.com/Hazyshades/EasyHealth/issues/248)
- OpenSpec A: [`prepare-resolver-evidence-identity`](../../openspec/changes/prepare-resolver-evidence-identity/)
- OpenSpec B: [`historical-persisted-decision-read`](../../openspec/changes/historical-persisted-decision-read/)

## Финальный критерий закрытия checklist

- [ ] Для каждого оставшегося кандидата есть отдельное решение: делать, объединить с существующим change или отклонить.
- [ ] Для принятого кандидата есть implementation-ready OpenSpec с границами, callers, persistence, verification и non-goals.
- [ ] Runtime implementation и миграции выполнены только после закрытия соответствующего ТЗ.
- [ ] Документация, Registry checks и ручная QA-проверка обновлены по фактическому статусу, без описания планов как реализованного поведения.
