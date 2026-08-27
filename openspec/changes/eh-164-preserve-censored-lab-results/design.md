## Context

`parseLabValueCell` currently strips a leading `[<>≤≥]` and returns `value_kind: "numeric"`. `parsePipelineExtraction` then persists that number; if the parser returns null, `parseLabNumber` repeats the same strip. Extraction may also put the comparator on `modifier`, which is a clinical identity axis. EH-119 already refuses to restated a comparator as numeric (`isCensoredValueText` / `censored_value_requires_text`) but still rebuilds a number from comparator text when `value_numeric` is present and `value_text` is parsed through the same cell parser.

Live defect (#108): CRP `< 0.20 mg/L` stored as `raw_value_text: "0.2"` with `modifier: "<"` / `"less than"`.

Consumers already treat non-numeric `value_kind` as non-plottable and assessment-ineligible. The production fix is to stop classifying censored cells as numeric, not to add a new value-relation schema.

## Goals / Non-Goals

**Goals:**

- Preserve printed comparator + number as text through extraction, staging, acceptance, and correction.
- Keep comparators off `modifier`.
- Surface `Threshold result` on Biomarkers and exclude the row from numeric trends.
- Fail closed for Health Profile: censored text is unusable, including stale numeric-plus-comparator rows.
- Provide a verifier on the CI verify job and a read-only audit of already-corrupted rows.
- Keep `2+` / `++` ordinal dipstick grades unchanged.

**Non-Goals:**

- `value_relation` / `threshold_value` columns or special chart glyphs.
- Silent UPDATE of already-accepted observations.
- Interval values (`3.5–4.0`).
- EH-165 dates, rotation OCR, durable deletion.

## Decisions

1. **Text kind, not a new enum.** Censored results use existing `value_kind = "text"` so Health Profile and comparison already fail closed. A dedicated `censored` kind would require catalog/resolver/DB churn for no extra safety. A row with a valid reviewed assessment binding remains a text marker with a null numeric value in Health Profile input so readiness reports it as present-but-invalid; it never enters numeric contributors.

2. **Shared detector in `qualitative.ts`.** One leading-comparator test (`<`, `>`, `≤`, `≥`, `<=`, `>=` plus a number) is used by the cell parser, extraction rescue, modifier coercion, correction base, UI status, and Health Profile projection. `parseLabNumber` keeps stripping comparators only for reference-range bounds.

3. **Ordinal first.** Existing `ORDINAL_MAP` (`2+`, `Negative`, …) runs before the comparator branch so dipstick grades never become text.

4. **Prefer printed text over stale numeric.** `baseMeasurementFromExtractedRow` treats comparator-bearing `value_text` / `raw_value_text` as text with `value = null` even when `value_numeric` is finite. That is the EH-119 restatement path and the acceptance writer path.

5. **Modifier coercion, not a new axis.** After `inferModifier`, punctuation-only and spelled comparator tokens (`<`, `less than`, …) become `none`. The extraction prompt states that comparators belong on `value`.

6. **No schema migration.** Audit is a read-only SQL script. Repair is reprocess/correction only.

7. **DB tests not applicable.** No new table, constraint, RLS, or writer RPC. Persistence contract is covered by the TypeScript verifier plus the existing EH-119 correction tests.

## Risks / Trade-offs

- [Already-accepted 0.2 rows without comparator text cannot be recovered automatically] → audit query; no silent UPDATE; operators reprocess or correct.
- [Resolver `value_kind_conflict` if a numeric definition meets a text row] → acceptable: incomplete/partial is safer than a fake magnitude.
- [Reference ranges printed as `< 5` still parse as a high bound] → intentional; bounds are not result values.
- [Model still emits a number in JSON] → parser sees a number with no comparator; source_text/raw may still carry `< 0.20`; prompt + audit mitigate; follow-up schema is out of scope.

## Migration Plan

Ship parser/prompt/writer/UI together. Existing observations stay until reprocess or EH-119 correction. Rollback is revert of the application change; no DB rollback.

## Open Questions

None blocking. Interval parsing remains deferred.
