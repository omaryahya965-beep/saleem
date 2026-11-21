-- V2 completion §17 — SALEEM Fix notifications (D199). A proposal that becomes ready asynchronously (the Edge Function
-- finishing a text correction) notifies the user who started it; an accepted correction notifies the assigned
-- reviewer that a corrected version now exists (it must be analysed and resubmitted before any decision).
create or replace function public.correction_job_notify()
returns trigger language plpgsql security definer set search_path = '' as $$
declare p public.promotions;
begin
  if new.status is not distinct from old.status then return new; end if;
  select * into p from public.promotions where id = new.promotion_id;
  if new.status = 'ready' and old.status = 'generating' then
    perform public.notify_user(new.created_by, 'correction_ready', new.source_submission_id,
      jsonb_build_object('promotion_id', new.promotion_id, 'title', p.title, 'job_id', new.id, 'method', new.method));
  elsif new.status = 'accepted' and p.assigned_reviewer_id is not null then
    perform public.notify_user(p.assigned_reviewer_id, 'correction_ready', new.result_submission_id,
      jsonb_build_object('promotion_id', new.promotion_id, 'title', p.title, 'job_id', new.id, 'method', new.method, 'accepted', true));
  end if;
  return new;
end $$;
revoke all on function public.correction_job_notify() from public, anon, authenticated;
drop trigger if exists correction_job_notify on public.correction_jobs;
create trigger correction_job_notify after update of status on public.correction_jobs
  for each row execute function public.correction_job_notify();
