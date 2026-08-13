-- EH-120: enum-backed event uniqueness must be created after migration 055
-- commits the new observation_change_event_kind values.

create unique index if not exists observation_change_events_rejection_unique
  on public.observation_change_events (extracted_biomarker_id)
  where event_kind = 'record_rejected';

create unique index if not exists observation_change_events_record_supersession_unique
  on public.observation_change_events (extracted_biomarker_id)
  where event_kind = 'record_superseded';
