-- Document worker reliability: expose liveness and clean up duplicate active jobs
-- before the partial unique index in migration 030 is created.

create table if not exists public.worker_heartbeats (
  instance_id text primary key,
  last_seen timestamptz not null default now()
);

comment on table public.worker_heartbeats is
  'Latest liveness heartbeat for each document-processing worker instance.';
comment on column public.worker_heartbeats.last_seen is
  'Last successful worker tick, used to surface unavailable document processing.';

alter table public.worker_heartbeats enable row level security;

create policy "service_all_worker_heartbeats"
  on public.worker_heartbeats
  for all
  to service_role
  using (true)
  with check (true);

with ranked_active_jobs as (
  select
    id,
    row_number() over (
      partition by document_id
      order by created_at desc, id desc
    ) as active_rank
  from public.document_processing_jobs
  where status in ('queued', 'processing')
)
update public.document_processing_jobs as jobs
set
  status = 'failed',
  error = coalesce(
    jobs.error,
    'Superseded by a newer active job during document worker reliability migration'
  ),
  finished_at = coalesce(jobs.finished_at, now())
from ranked_active_jobs
where jobs.id = ranked_active_jobs.id
  and ranked_active_jobs.active_rank > 1;
