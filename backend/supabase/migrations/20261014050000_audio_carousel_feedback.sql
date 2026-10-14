-- Audio modes, carousel posts, blurred evidence frames, finding feedback, duplicate-upload reuse.
-- Additive only.

-- 1. Audio: browser probe result on the submission, final mode on the run.
alter table public.submissions
  add column if not exists audio_probe jsonb,
  add column if not exists image_count int not null default 1 check (image_count between 1 and 10);

alter table public.analysis_runs
  add column if not exists audio_mode text check (audio_mode in ('speech', 'music_no_speech', 'no_audio'));

-- 2. Evidence frames are blurred server-side before display.
alter table public.frames add column if not exists blurred boolean not null default false;

-- 3. Finding feedback («هذه الملاحظة غير صحيحة»).
create table if not exists public.finding_feedback (
  id uuid primary key default gen_random_uuid(),
  finding_id uuid not null references public.findings(id) on delete cascade,
  submission_id uuid not null references public.submissions(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  reason text check (length(reason) <= 1000),
  created_at timestamptz not null default now(),
  unique (finding_id, user_id)
);
grant select, insert, delete on public.finding_feedback to authenticated;
grant all on public.finding_feedback to service_role;
alter table public.finding_feedback enable row level security;
drop policy if exists "feedback insert" on public.finding_feedback;
create policy "feedback insert" on public.finding_feedback for insert to authenticated with check (
  user_id = auth.uid()
  and exists (select 1 from public.findings f where f.id = finding_id and f.submission_id = finding_feedback.submission_id)
  and public.can_read_submission(submission_id)
);
drop policy if exists "feedback read" on public.finding_feedback;
create policy "feedback read" on public.finding_feedback for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
drop policy if exists "feedback delete own" on public.finding_feedback;
create policy "feedback delete own" on public.finding_feedback for delete to authenticated using (user_id = auth.uid());

-- Admin: disputed findings with the context needed to build eval cases.
create or replace function public.admin_finding_feedback(_limit int default 200)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(x order by x.created_at desc) from (
      select fb.id, fb.created_at, fb.reason, f.rule_code, f.severity, f.t_start, f.evidence_type, f.evidence_text, f.source,
             s.id as submission_id, s.kind, s.caption, s.text_content, s.platform, s.product_category, s.is_paid_ad,
             s.has_written_contract, s.ai_used, s.mawthooq_license_no, s.duration_seconds, s.title,
             (select segments from public.transcripts t where t.submission_id = s.id) as segments,
             (select coalesce(jsonb_agg(jsonb_build_object('rule', f2.rule_code, 't', f2.t_start)), '[]')
                from public.findings f2 where f2.run_id = f.run_id and f2.id not in (select finding_id from public.finding_feedback)) as kept
      from public.finding_feedback fb
      join public.findings f on f.id = fb.finding_id
      join public.submissions s on s.id = fb.submission_id
      limit greatest(1, least(_limit, 1000))
    ) x
  ), '[]'::jsonb);
end $$;
revoke all on function public.admin_finding_feedback(int) from public, anon;
grant execute on function public.admin_finding_feedback(int) to authenticated;

-- 4. Duplicate uploads: the client offers the previous report; reusing it is logged with the saved cost.
create or replace function public.log_duplicate_reuse(_previous uuid)
returns void language plpgsql security definer set search_path = public as $$
declare _cost numeric;
begin
  if not exists (select 1 from public.submissions where id = _previous and user_id = auth.uid()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select cost_usd into _cost from public.analysis_runs where submission_id = _previous order by started_at desc limit 1;
  insert into public.audit_events (actor, action, target_table, target_id, meta)
  values (auth.uid(), 'duplicate_reuse', 'submissions', _previous::text, jsonb_build_object('saved_cost_usd', coalesce(_cost, 0)));
end $$;
revoke all on function public.log_duplicate_reuse(uuid) from public, anon;
grant execute on function public.log_duplicate_reuse(uuid) to authenticated;

create or replace function public.admin_dedupe_stats(_days int default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'forbidden' using errcode = '42501'; end if;
  return (select jsonb_build_object(
    'reuses', count(*),
    'saved_cost_usd', coalesce(sum((meta->>'saved_cost_usd')::numeric), 0),
    'disputed_findings', (select count(*) from public.finding_feedback where created_at >= now() - make_interval(days => _days)))
    from public.audit_events where action = 'duplicate_reuse' and at >= now() - make_interval(days => _days));
end $$;
revoke all on function public.admin_dedupe_stats(int) from public, anon;
grant execute on function public.admin_dedupe_stats(int) to authenticated;
