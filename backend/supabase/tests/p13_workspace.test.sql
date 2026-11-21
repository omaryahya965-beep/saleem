-- D192–D195: workspace overview, history actors, role counts and SALEEM Fix limit respect roles.
begin;
create extension if not exists pgtap with schema extensions;
select plan(1);
insert into auth.users (id, email) values
  ('1e000000-0000-0000-0000-000000000001', 'ow@ws.test'), ('1e000000-0000-0000-0000-000000000002', 'mk@ws.test'),
  ('1e000000-0000-0000-0000-000000000003', 'rv@ws.test'), ('1e000000-0000-0000-0000-000000000004', 'ext@ws.test'),
  ('1e000000-0000-0000-0000-000000000005', 'vw@ws.test');
insert into public.organizations (id, name, created_by) values ('2e000000-0000-0000-0000-000000000001', 'WS Org', '1e000000-0000-0000-0000-000000000001');
insert into public.org_members (org_id, user_id, role, display_name) values
  ('2e000000-0000-0000-0000-000000000001', '1e000000-0000-0000-0000-000000000001', 'owner', 'المالك'),
  ('2e000000-0000-0000-0000-000000000001', '1e000000-0000-0000-0000-000000000002', 'creator', 'المسوقة'),
  ('2e000000-0000-0000-0000-000000000001', '1e000000-0000-0000-0000-000000000003', 'reviewer', 'المراجع'),
  ('2e000000-0000-0000-0000-000000000001', '1e000000-0000-0000-0000-000000000004', 'external_uploader', 'وكالة'),
  ('2e000000-0000-0000-0000-000000000001', '1e000000-0000-0000-0000-000000000005', 'viewer', 'المطلع');
insert into public.org_settings (org_id) values ('2e000000-0000-0000-0000-000000000001') on conflict (org_id) do nothing;
insert into public.promotions (id, owner_id, org_id, title) values
  ('4e000000-0000-0000-0000-000000000001', '1e000000-0000-0000-0000-000000000004', '2e000000-0000-0000-0000-000000000001', 'إعلان الشريك');
insert into public.review_events (org_id, promotion_id, event_type, actor_id) values
  ('2e000000-0000-0000-0000-000000000001', '4e000000-0000-0000-0000-000000000001', 'assigned', '1e000000-0000-0000-0000-000000000001');

create or replace function pg_temp.as_user(_u text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', _u, true), set_config('request.jwt.claim.role', 'authenticated', true)
$$;
create or replace function pg_temp.expect_error(_sql text, _code text) returns void language plpgsql as $$
begin
  execute _sql;
  raise exception 'expected % but the statement succeeded: %', _code, _sql;
exception when others then
  if sqlerrm not like '%' || _code || '%' then raise exception 'expected %, got %: %', _code, sqlerrm, _sql; end if;
end $$;

set local role authenticated;
select pg_temp.as_user('1e000000-0000-0000-0000-000000000001');
do $$ begin
  if (public.workspace_overview('2e000000-0000-0000-0000-000000000001')->>'advertisements')::int <> 1 then raise exception 'overview count'; end if;
  if (public.role_member_counts('2e000000-0000-0000-0000-000000000001')->>'creator')::int <> 1 then raise exception 'role counts'; end if;
  perform public.set_fix_monthly_limit('2e000000-0000-0000-0000-000000000001', 5);
  perform pg_temp.expect_error($q$select public.set_fix_monthly_limit('2e000000-0000-0000-0000-000000000001', -1)$q$, 'code:invalid_limit');
end $$;
select pg_temp.as_user('1e000000-0000-0000-0000-000000000005');
do $$ begin
  perform public.workspace_overview('2e000000-0000-0000-0000-000000000001');  -- viewer: read-only operational counts
  perform pg_temp.expect_error($q$select public.set_fix_monthly_limit('2e000000-0000-0000-0000-000000000001', 9)$q$, 'code:forbidden');
end $$;
select pg_temp.as_user('1e000000-0000-0000-0000-000000000003');
do $$ begin
  perform pg_temp.expect_error($q$select public.workspace_overview('2e000000-0000-0000-0000-000000000001')$q$, 'code:forbidden');
end $$;
select pg_temp.as_user('1e000000-0000-0000-0000-000000000002');
do $$ begin
  perform pg_temp.expect_error($q$select public.workspace_overview('2e000000-0000-0000-0000-000000000001')$q$, 'code:forbidden');
end $$;
-- External partner: own ad history shows roles, never internal names; no role counts.
select pg_temp.as_user('1e000000-0000-0000-0000-000000000004');
do $$
declare _a jsonb := public.history_actors('4e000000-0000-0000-0000-000000000001');
begin
  if _a->'1e000000-0000-0000-0000-000000000001'->>'name' is not null then raise exception 'internal name leaked to partner'; end if;
  if _a->'1e000000-0000-0000-0000-000000000001'->>'role' <> 'owner' then raise exception 'role missing'; end if;
  if public.role_member_counts('2e000000-0000-0000-0000-000000000001') <> '{}'::jsonb then raise exception 'counts leaked'; end if;
  perform pg_temp.expect_error($q$select public.workspace_overview('2e000000-0000-0000-0000-000000000001')$q$, 'code:forbidden');
end $$;
reset role;
select pass('p13 workspace');
select * from finish();
rollback;
