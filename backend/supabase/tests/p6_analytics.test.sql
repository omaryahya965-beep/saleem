-- Phase 6.6 — org_metrics against hand-computed values (weekend Fri–Sat, SLA 3 business days).
-- P1: submitted Sun 1 Nov 09:00, approved Tue 3 Nov 09:00 (2 bd, in SLA; first-time approval; 48 h; 0 iterations).
-- P2: deadline Tue 3 Nov; submitted Mon 2 Nov, changes requested Mon 9 Nov (5 bd, out of SLA; reason R1),
--     resubmitted Tue 10 Nov, approved Wed 11 Nov (1 bd). Approval 216 h, first response 168 h, 1 iteration.
-- Run: npx supabase test db --workdir backend
begin;
create extension if not exists pgtap with schema extensions;
select plan(1);

insert into auth.users (id, email) values ('1b000000-0000-0000-0000-000000000001', 'ow@an.test'), ('1b000000-0000-0000-0000-000000000002', 'rv@an.test'),
  ('1b000000-0000-0000-0000-000000000005', 'cr@an.test');
insert into public.organizations (id, name, created_by) values ('2b000000-0000-0000-0000-000000000001', 'An Bank', '1b000000-0000-0000-0000-000000000001');
insert into public.org_members (org_id, user_id, role) values
  ('2b000000-0000-0000-0000-000000000001', '1b000000-0000-0000-0000-000000000001', 'owner'),
  ('2b000000-0000-0000-0000-000000000001', '1b000000-0000-0000-0000-000000000002', 'reviewer'),
  ('2b000000-0000-0000-0000-000000000001', '1b000000-0000-0000-0000-000000000005', 'creator');
insert into public.org_settings (org_id, features, review_sla_business_days, weekend_days) values ('2b000000-0000-0000-0000-000000000001', '{"analytics": true}', 3, '{5,6}')
on conflict (org_id) do update set features = excluded.features, review_sla_business_days = 3, weekend_days = '{5,6}';
insert into public.rejection_reasons (id, org_id, kind, label_ar, label_en) values ('6b000000-0000-0000-0000-000000000001', null, 'promotion', 'سبب', 'Reason');

insert into public.promotions (id, owner_id, org_id, title, communication_type, channels, review_status, created_at, deadline_at, assigned_reviewer_id) values
  ('4b000000-0000-0000-0000-000000000001', '1b000000-0000-0000-0000-000000000005', '2b000000-0000-0000-0000-000000000001', 'P1', 'financial_promotion', '{instagram}', 'draft', '2026-11-01 08:00+03', null, '1b000000-0000-0000-0000-000000000002'),
  ('4b000000-0000-0000-0000-000000000002', '1b000000-0000-0000-0000-000000000005', '2b000000-0000-0000-0000-000000000001', 'P2', 'financial_promotion', '{instagram,x}', 'draft', '2026-11-02 08:00+03', '2026-11-03 09:00+03', '1b000000-0000-0000-0000-000000000002');
insert into public.submissions (id, user_id, kind, caption, platform, product_category, promotion_id, sha256) values
  ('3b000000-0000-0000-0000-000000000001', '1b000000-0000-0000-0000-000000000005', 'text', 'a', 'x', 'finance', '4b000000-0000-0000-0000-000000000001', 'a'),
  ('3b000000-0000-0000-0000-000000000002', '1b000000-0000-0000-0000-000000000005', 'text', 'b', 'x', 'finance', '4b000000-0000-0000-0000-000000000002', 'b');
update public.promotions set review_status = 'approved' where id::text like '4b000000-%';
insert into public.review_events (org_id, promotion_id, submission_id, event_type, actor_id, created_at) values
  ('2b000000-0000-0000-0000-000000000001', '4b000000-0000-0000-0000-000000000001', '3b000000-0000-0000-0000-000000000001', 'submitted', '1b000000-0000-0000-0000-000000000005', '2026-11-01 09:00+03'),
  ('2b000000-0000-0000-0000-000000000001', '4b000000-0000-0000-0000-000000000002', '3b000000-0000-0000-0000-000000000002', 'submitted', '1b000000-0000-0000-0000-000000000005', '2026-11-02 09:00+03'),
  ('2b000000-0000-0000-0000-000000000001', '4b000000-0000-0000-0000-000000000002', '3b000000-0000-0000-0000-000000000002', 'submitted', '1b000000-0000-0000-0000-000000000005', '2026-11-10 09:00+03');
insert into public.review_decisions (promotion_id, submission_id, decision, actor_id, actor_role, reason_ids, from_status, to_status, findings_snapshot, asset_sha256, hash, created_at) values
  ('4b000000-0000-0000-0000-000000000001', '3b000000-0000-0000-0000-000000000001', 'approve', '1b000000-0000-0000-0000-000000000002', 'reviewer', '{}', 'in_review', 'approved', '[]', 'a', 'h1', '2026-11-03 09:00+03'),
  ('4b000000-0000-0000-0000-000000000002', '3b000000-0000-0000-0000-000000000002', 'request_changes', '1b000000-0000-0000-0000-000000000002', 'reviewer', '{6b000000-0000-0000-0000-000000000001}', 'in_review', 'changes_requested', '[]', 'b', 'h2', '2026-11-09 09:00+03'),
  ('4b000000-0000-0000-0000-000000000002', '3b000000-0000-0000-0000-000000000002', 'approve', '1b000000-0000-0000-0000-000000000002', 'reviewer', '{}', 'in_review', 'approved', '[]', 'b', 'h3', '2026-11-11 09:00+03');

create or replace function pg_temp.as_user(_u text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', _u, true), set_config('request.jwt.claim.role', 'authenticated', true)
$$;
set local role authenticated;
select pg_temp.as_user('1b000000-0000-0000-0000-000000000005');
do $$ begin
  begin
    perform public.org_metrics('2b000000-0000-0000-0000-000000000001', '2026-11-01', '2026-12-01');
    raise exception 'creator read metrics';
  exception when others then if sqlerrm not like '%code:forbidden%' then raise; end if;
  end;
end $$;
select pg_temp.as_user('1b000000-0000-0000-0000-000000000002');
do $$
declare m jsonb := public.org_metrics('2b000000-0000-0000-0000-000000000001', '2026-11-01 00:00+03', '2026-12-01 00:00+03');
begin
  if public.business_days_between('2026-11-02 09:00+03', '2026-11-09 09:00+03', '{5,6}') <> 5 then raise exception 'bd wrong'; end if;
  if (m->>'promotions_submitted')::int <> 2 then raise exception 'promotions_submitted %', m->>'promotions_submitted'; end if;
  if (m->>'versions_submitted')::int <> 3 then raise exception 'versions_submitted'; end if;
  if (m->>'avg_versions')::numeric <> 1.5 then raise exception 'avg_versions %', m->>'avg_versions'; end if;
  if (m->>'early_requests')::numeric <> 0.6667 then raise exception 'early_requests %', m->>'early_requests'; end if;
  if (m->>'sla_compliance')::numeric <> 0.6667 then raise exception 'sla %', m->>'sla_compliance'; end if;
  if (m->>'first_time_approval')::numeric <> 0.5 then raise exception 'fta %', m->>'first_time_approval'; end if;
  if (m->'approval_time_hours'->>'mean')::numeric <> 132 or (m->'approval_time_hours'->>'median')::numeric <> 132 then raise exception 'approval time %', m->'approval_time_hours'; end if;
  if (m->'first_response_hours'->>'mean')::numeric <> 108 then raise exception 'first response %', m->'first_response_hours'; end if;
  if (m->'iterations'->>'mean')::numeric <> 0.5 then raise exception 'iterations %', m->'iterations'; end if;
  if (m->'reasons'->0->>'count')::int <> 1 then raise exception 'reasons %', m->'reasons'; end if;
  if (m->'workload'->0->>'decisions')::int <> 3 then raise exception 'workload %', m->'workload'; end if;
  if (m->'volume'->'by_status'->>'approved')::int <> 2 or (m->'volume'->'by_channel'->>'instagram')::int <> 2 then raise exception 'volume %', m->'volume'; end if;
  -- Filter by channel x → only P2.
  m := public.org_metrics('2b000000-0000-0000-0000-000000000001', '2026-11-01 00:00+03', '2026-12-01 00:00+03', '{"channel":"x"}');
  if (m->>'promotions_submitted')::int <> 1 or (m->>'first_time_approval')::numeric <> 0 then raise exception 'filter %', m; end if;
end $$;
reset role;

select pass('p6 analytics');
select * from finish();
rollback;
