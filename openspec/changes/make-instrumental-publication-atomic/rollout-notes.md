# PR2 rollout notes (make-instrumental-publication-atomic)

## Pause / drain

1. Pause instrumental worker instances that still call
   `replace_document_instrumental_observations`.
2. Drain `document_processing_jobs` in `processing` for instrumental documents.
3. Migration `037` preflight aborts if processing jobs remain.

## Retained vs disposable

- Retained environments: run migrations `036` then `037`. Preflight aborts on
  ambiguous rows; do not invent repairs.
- Disposable environments only: after process flags
  `EH105_PR2_DISPOSABLE=1` and `EH105_PR2_ALLOW_RESET=1`, run
  `pnpm reset:eh105-pr2`, then reprocess instrumental documents.

## Deploy order

1. Apply DB migrations 036/037.
2. Deploy attempt-aware worker + API purge-on-delete.
3. Verify legacy findings view + document projections equal current pointer.
4. Resume jobs.
5. Record smoke: unchanged retry, changed reprocess, `A → B → A`, stale
   attempt rejection, forced finalize failure.

## Evidence gates

- `pnpm test:eh105`
- `pnpm test:eh105-db`
- `pnpm test:pr2-db`
- QA checklist `QA/eh-105/checklist.md` (manual unmarked until executed)
- Production / Sprint 1 closure remains pending until all mandatory gates pass.
