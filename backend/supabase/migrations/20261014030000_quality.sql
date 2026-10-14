-- Phase 6: audit log, stuck-job watchdog, admin metrics.

-- ============================================================================
-- 1. Audit log (append-only; admins read; written by triggers)
-- ============================================================================
create table if not exists public.audit_events (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor uuid,
  action text not null,
  target_table text not null,
  target_id text,
  meta jsonb not null default '{}'
);
create index if not exists audit_events_at_idx on public.audit_events (at desc);
grant select on public.audit_events to authenticated;
grant all on public.audit_events to service_role;
alter table public.audit_events enable row level security;
drop policy if exists "admin read audit" on public.audit_events;
create policy "admin read audit" on public.audit_events for select to authenticated using (public.has_role(auth.uid(), 'admin'));

create or replace function public.audit_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
declare _row jsonb := to_jsonb(coalesce(new, old));
begin
  insert into public.audit_events (actor, action, target_table, target_id, meta)
  values (
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    coalesce(_row->>'id', _row->>'submission_id', concat_ws(':', _row->>'org_id', _row->>'user_id')),
    case tg_table_name
      when 'submissions' then jsonb_build_object('status', _row->>'status', 'media_deleted_at', _row->>'media_deleted_at')
      when 'org_members' then jsonb_build_object('org_id', _row->>'org_id', 'role', _row->>'role')
      when 'share_links' then jsonb_build_object('submission_id', _row->>'submission_id', 'revoked_at', _row->>'revoked_at')
      when 'rulebook_versions' then jsonb_build_object('status', _row->>'status', 'label', _row->>'version_label')
      when 'org_invites' then jsonb_build_object('org_id', _row->>'org_id', 'role', _row->>'role')
      else '{}'::jsonb end
  );
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['share_links', 'org_members', 'org_invites', 'rulebook_versions', 'user_roles', 'organizations'] loop
    execute format('drop trigger if exists audit_%1$s on public.%1$s', t);
    execute format('create trigger audit_%1$s after insert or update or delete on public.%1$s for each row execute function public.audit_trigger()', t);
  end loop;
end $$;
-- Submissions: only deletions and media deletion (status churn would flood the log).
drop trigger if exists audit_submissions on public.submissions;
create trigger audit_submissions after delete or update of media_deleted_at on public.submissions
  for each row execute function public.audit_trigger();

-- ============================================================================
-- 2. Watchdog: fail checks whose worker stopped (stale heartbeat) so users can retry
-- ============================================================================
create or replace function public.fail_stuck_submissions()
returns int language plpgsql security definer set search_path = public as $$
declare _n int;
begin
  update public.submissions
  set status = 'failed',
      error_message = 'توقف الفحص دون استجابة. أعد المحاولة. (worker timeout)'
  where status in ('queued', 'extracting', 'transcribing', 'analyzing')
    and coalesce(heartbeat_at, created_at) < now() - interval '10 minutes'
    and not is_demo;
  get diagnostics _n = row_count;
  return _n;
end $$;
revoke all on function public.fail_stuck_submissions() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'saleem-fail-stuck';
select cron.schedule('saleem-fail-stuck', '*/5 * * * *', 'select public.fail_stuck_submissions()');

-- ============================================================================
-- 3. Admin metrics (last N days): runs, failures, durations, cost, statuses
-- ============================================================================
create or replace function public.admin_metrics(_days int default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare _since timestamptz := now() - make_interval(days => greatest(1, least(_days, 365)));
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object(
    'since', _since,
    'submissions', (select count(*) from public.submissions where created_at >= _since and not is_demo),
    'users', (select count(distinct user_id) from public.submissions where created_at >= _since and not is_demo),
    'runs', (select count(*) from public.analysis_runs r join public.submissions s on s.id = r.submission_id where r.started_at >= _since and not s.is_demo),
    'failed', (select count(*) from public.submissions where created_at >= _since and status = 'failed' and error_message is distinct from 'cancelled_by_user' and not is_demo),
    'cancelled', (select count(*) from public.submissions where created_at >= _since and error_message = 'cancelled_by_user'),
    'status', (select coalesce(jsonb_object_agg(k, n), '{}') from (select coalesce(overall_status::text, status::text) k, count(*) n from public.submissions where created_at >= _since and not is_demo group by 1) x),
    'cost_usd', (select coalesce(sum(cost_usd), 0) from public.analysis_runs where started_at >= _since),
    'avg_cost_usd', (select avg(cost_usd) from public.analysis_runs where started_at >= _since and status = 'done'),
    'p50_ms', (select percentile_cont(0.5) within group (order by extract(epoch from finished_at - started_at) * 1000) from public.analysis_runs where started_at >= _since and status = 'done'),
    'p95_ms', (select percentile_cont(0.95) within group (order by extract(epoch from finished_at - started_at) * 1000) from public.analysis_runs where started_at >= _since and status = 'done'),
    'by_model', (select coalesce(jsonb_agg(x), '[]') from (select llm_model, count(*) runs, sum(cost_usd) cost from public.analysis_runs where started_at >= _since group by llm_model) x),
    'daily', (select coalesce(jsonb_agg(x order by day), '[]') from (
        select date_trunc('day', created_at)::date as day, count(*) as checks,
               count(*) filter (where status = 'failed') as failed
        from public.submissions where created_at >= _since and not is_demo group by 1) x),
    'recent_errors', (select coalesce(jsonb_agg(x), '[]') from (
        select r.started_at, left(r.error, 200) as error from public.analysis_runs r
        where r.started_at >= _since and r.status = 'failed' order by r.started_at desc limit 10) x)
  );
end $$;
revoke all on function public.admin_metrics(int) from public, anon;
grant execute on function public.admin_metrics(int) to authenticated;
