# EH-105 Instrumental Observation Lineage Runbook

EH-105 makes an instrumental numeric measurement a source-backed observation,
not a Registry 2.0 laboratory marker. Each current `observations` row with
`observation_kind = 'instrumental'` points to exactly one immutable
`document_extracted_instrumental_measures` row. Its identity is the source
locator plus occurrence index within a canonical extraction snapshot.

The extraction-model key is stored only as `key_hint`; it is not a database,
semantic, or replay identity.

## Deployment order

1. Pause or drain instrumental document jobs. Do not let an older worker pick
   up an `instrumental_report` after the schema migration.
2. Apply migration `032_eh105_instrumental_observation_lineage.sql`.
3. Deploy the compatible worker and web application together. The worker calls
   `replace_document_instrumental_observations` and treats its error as a
   failed job.
4. Resume instrumental jobs and verify one duplicate-looking report, an
   unchanged retry, a changed reprocess, and a forced write failure.

The RPC is service-role only. Browser/API clients must not insert or replace
instrumental source rows directly.

## Disposable development reset and reprocess

EH-105 does not backfill pre-existing instrumental observations. They lack
trustworthy source occurrence identity and must not be synthesized from an old
measure key.

For a disposable environment:

1. Stop the worker and run `supabase db reset`.
2. Start the compatible worker.
3. Requeue/reprocess the original instrumental documents.
4. Confirm that every current instrumental observation joins to a current
   source row and has no laboratory source, revision, analyte, or definition
   linkage.

For a persistent environment, stop instrumental processing and apply a
forward corrective migration if needed. Do not resurrect the removed legacy
observation identity column or fabricate source lineage.

## Failure and rollback policy

`replace_document_instrumental_observations` materializes source rows and
observations before it supersedes the prior current snapshot. A failed RPC
rolls back as one transaction, so the prior current snapshot remains visible.
The worker checks every relevant mutation result and changes document/job
status to failed if final completion cannot be written.

Rollback is forward-only: pause jobs, deploy a corrective worker/migration, or
reset an explicitly disposable environment. There is no rollback to legacy
measure-key persistence.

## Roadmap handoffs

- EH-106 owns acceptance/correction CAS cutover and full Registry 2.0 consumer
  migration: trends, reports, structured context, biomarker APIs/UI,
  conversion, and assessment presentation.
- EH-104 Phase B begins only after EH-106-compatible laboratory writers are
  deployed. It owns final laboratory guards, `MATCH FULL`, controlled purge
  enforcement, and removal of the legacy promotion RPC.
- EH-105 intentionally leaves instrumental observations outside laboratory
  Health Profile mappings and assessment inputs.
