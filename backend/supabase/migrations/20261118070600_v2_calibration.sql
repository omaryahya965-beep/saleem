-- v2 Phase 7.6: calibration report for platform admins. Per rule: findings, reviewer agreement, dismiss rate and
-- the most common dismiss reasons, from reviewer responses only. Suggestions are notes for a person to review and
-- publish as a new rule version later; nothing here edits a rule.

create table if not exists public.calibration_notes (
  id         uuid primary key default gen_random_uuid(),
  rule_code  text not null,
  note       text not null check (char_length(trim(note)) between 1 and 2000),
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.calibration_notes enable row level security;
drop policy if exists calibration_notes_admin on public.calibration_notes;
create policy calibration_notes_admin on public.calibration_notes for select to authenticated using (public.has_role(auth.uid(), 'admin'));
grant select on public.calibration_notes to authenticated;

create or replace function public.calibration_report(_from timestamptz, _to timestamptz)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'code:forbidden' using errcode = '42501'; end if;
  return coalesce((
    with f as (
      select f.id, f.rule_code from public.findings f
      join public.submissions s on s.id = f.submission_id
      join public.analysis_runs ar on ar.id = f.run_id
      where ar.started_at >= _from and ar.started_at < _to and not s.is_demo
    ),
    last_rev as (
      select distinct on (r.finding_id) r.finding_id, r.action, r.comment
      from public.finding_responses r join f on f.id = r.finding_id
      where r.actor_role = 'reviewer' order by r.finding_id, r.created_at desc
    ),
    per_rule as (
      select f.rule_code,
        count(*) as findings,
        count(l.finding_id) as reviewed,
        count(*) filter (where l.action = 'agree_please_action') as agreed,
        count(*) filter (where l.action in ('dismiss', 'not_required')) as dismissed
      from f left join last_rev l on l.finding_id = f.id group by f.rule_code
    ),
    reasons as (
      select f.rule_code, lower(trim(l.comment)) as reason, count(*) as n,
             row_number() over (partition by f.rule_code order by count(*) desc) as rk
      from f join last_rev l on l.finding_id = f.id
      where l.action in ('dismiss', 'not_required') and coalesce(trim(l.comment), '') <> ''
      group by f.rule_code, lower(trim(l.comment))
    )
    select jsonb_agg(jsonb_build_object(
      'rule_code', p.rule_code, 'findings', p.findings, 'reviewed', p.reviewed,
      'agreement', case when p.reviewed = 0 then null else round(p.agreed::numeric / p.reviewed, 4) end,
      'dismiss_rate', case when p.reviewed = 0 then null else round(p.dismissed::numeric / p.reviewed, 4) end,
      'top_dismiss_reasons', coalesce((select jsonb_agg(jsonb_build_object('reason', r.reason, 'count', r.n) order by r.n desc)
                                       from reasons r where r.rule_code = p.rule_code and r.rk <= 3), '[]'::jsonb),
      'notes', (select count(*) from public.calibration_notes n where n.rule_code = p.rule_code))
      order by case when p.reviewed = 0 then 0 else p.dismissed::numeric / p.reviewed end desc, p.findings desc)
    from per_rule p), '[]'::jsonb);
end $$;

create or replace function public.add_calibration_note(_rule_code text, _note text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare _id uuid;
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'code:forbidden' using errcode = '42501'; end if;
  insert into public.calibration_notes (rule_code, note, created_by) values (_rule_code, trim(_note), auth.uid()) returning id into _id;
  return _id;
end $$;

revoke all on function public.calibration_report(timestamptz, timestamptz), public.add_calibration_note(text, text) from public, anon;
grant execute on function public.calibration_report(timestamptz, timestamptz), public.add_calibration_note(text, text) to authenticated;
