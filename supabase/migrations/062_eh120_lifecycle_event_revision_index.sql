-- EH-120: lifecycle transitions are separate ledger facts from revision capture.
-- A rejection or supersession may point at the active revision, but must not
-- collide with the revision's acceptance/verification event.

drop index if exists public.observation_change_events_revision_unique;

create unique index if not exists observation_change_events_revision_unique
  on public.observation_change_events (source_revision_id)
  where source_revision_id is not null
    and event_kind not in ('record_rejected', 'record_superseded');
