-- EH-159 follow-up: align deployed feedback checks with the assistant contract.

alter table public.assistant_feedback
  drop constraint if exists assistant_feedback_rating_check,
  drop constraint if exists assistant_feedback_category_check,
  add constraint assistant_feedback_rating_check
    check (rating in ('positive', 'negative')),
  add constraint assistant_feedback_category_check
    check (category is null or category in ('answer_quality', 'missing_evidence', 'safety', 'latency', 'other'));

create or replace function public.record_assistant_feedback(
  p_profile_id uuid,
  p_request_id uuid,
  p_rating text,
  p_category text,
  p_comment text
)
returns public.assistant_feedback
language plpgsql
security definer
set search_path = public
as $$
declare
  v_feedback public.assistant_feedback;
begin
  if p_rating not in ('positive', 'negative') then
    raise exception using message = 'assistant_feedback_rating_invalid';
  end if;
  if p_category is not null and p_category not in ('answer_quality', 'missing_evidence', 'safety', 'latency', 'other') then
    raise exception using message = 'assistant_feedback_category_invalid';
  end if;
  if not exists (
    select 1
    from public.assistant_request_events
    where request_id = p_request_id
      and profile_id = p_profile_id
  ) then
    raise exception using message = 'assistant_feedback_request_not_found';
  end if;

  insert into public.assistant_feedback (profile_id, request_id, rating, category, comment)
  values (p_profile_id, p_request_id, p_rating, p_category, nullif(btrim(p_comment), ''))
  on conflict (request_id, profile_id)
  do update set rating = excluded.rating,
                category = excluded.category,
                comment = excluded.comment,
                created_at = now()
  returning * into v_feedback;

  return v_feedback;
end;
$$;

revoke all on function public.record_assistant_feedback(uuid, uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.record_assistant_feedback(uuid, uuid, text, text, text)
  to service_role;
