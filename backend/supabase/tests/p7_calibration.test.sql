-- Phase 7.6 — calibration report: platform admins only; agreement and dismiss rate from reviewer responses;
-- top dismiss reasons; notes never change rules. Run: npx supabase test db --workdir backend
begin;
create extension if not exists pgtap with schema extensions;
select plan(1);

insert into auth.users (id, email) values ('1f000000-0000-0000-0000-000000000001', 'pa@cal.test'), ('1f000000-0000-0000-0000-000000000002', 'rv@cal.test'),
  ('1f000000-0000-0000-0000-000000000005', 'cr@cal.test');
insert into public.user_roles (user_id, role) values ('1f000000-0000-0000-0000-000000000001', 'admin');
insert into public.submissions (id, user_id, kind, caption, platform, product_category, sha256) values
  ('3f000000-0000-0000-0000-000000000001', '1f000000-0000-0000-0000-000000000005', 'text', 'c', 'x', 'finance', 'c1');
insert into public.analysis_runs (id, submission_id, status, started_at) values ('5f000000-0000-0000-0000-000000000001', '3f000000-0000-0000-0000-000000000001', 'done', '2026-11-10');
insert into public.findings (id, run_id, submission_id, rule_code, severity, evidence_type, source, finding_type) values
  ('6f000000-0000-0000-0000-000000000001', '5f000000-0000-0000-0000-000000000001', '3f000000-0000-0000-0000-000000000001', 'R-A', 'warning', 'caption', 'llm', 'potential_risk'),
  ('6f000000-0000-0000-0000-000000000002', '5f000000-0000-0000-0000-000000000001', '3f000000-0000-0000-0000-000000000001', 'R-A', 'warning', 'caption', 'llm', 'potential_risk'),
  ('6f000000-0000-0000-0000-000000000003', '5f000000-0000-0000-0000-000000000001', '3f000000-0000-0000-0000-000000000001', 'R-B', 'warning', 'caption', 'llm', 'potential_risk');
insert into public.finding_responses (finding_id, submission_id, actor_id, actor_role, action, comment) values
  ('6f000000-0000-0000-0000-000000000001', '3f000000-0000-0000-0000-000000000001', '1f000000-0000-0000-0000-000000000002', 'reviewer', 'dismiss', 'المعدل في الصورة'),
  ('6f000000-0000-0000-0000-000000000002', '3f000000-0000-0000-0000-000000000001', '1f000000-0000-0000-0000-000000000002', 'reviewer', 'agree_please_action', null);

create or replace function pg_temp.as_user(_u text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', _u, true), set_config('request.jwt.claim.role', 'authenticated', true)
$$;
set local role authenticated;
select pg_temp.as_user('1f000000-0000-0000-0000-000000000002');
do $$ begin
  begin
    perform public.calibration_report('2026-11-01', '2026-12-01');
    raise exception 'non-admin read calibration';
  exception when others then if sqlerrm not like '%code:forbidden%' then raise; end if;
  end;
end $$;
select pg_temp.as_user('1f000000-0000-0000-0000-000000000001');
do $$
declare r jsonb := public.calibration_report('2026-11-01', '2026-12-01'); a jsonb;
begin
  select x into a from jsonb_array_elements(r) x where x->>'rule_code' = 'R-A';
  if (a->>'findings')::int <> 2 or (a->>'reviewed')::int <> 2 or (a->>'agreement')::numeric <> 0.5 or (a->>'dismiss_rate')::numeric <> 0.5 then raise exception 'R-A wrong: %', a; end if;
  if a->'top_dismiss_reasons'->0->>'reason' <> 'المعدل في الصورة' then raise exception 'reasons wrong: %', a; end if;
  if (select x->>'agreement' from jsonb_array_elements(r) x where x->>'rule_code' = 'R-B') is not null then raise exception 'unreviewed rule has agreement'; end if;
  perform public.add_calibration_note('R-A', 'وسّع قراءة الصور للمعدل');
  if ((select x from jsonb_array_elements(public.calibration_report('2026-11-01', '2026-12-01')) x where x->>'rule_code' = 'R-A')->>'notes')::int <> 1 then raise exception 'note not counted'; end if;
end $$;
reset role;

select pass('p7 calibration');
select * from finish();
rollback;
