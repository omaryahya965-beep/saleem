-- Phase 6.4 — variations share context, are decided separately, bulk submit skips the ones not ready; batch items
-- are already one promotion each. Run: npx supabase test db --workdir backend
begin;
create extension if not exists pgtap with schema extensions;
select plan(1);

insert into auth.users (id, email) values
  ('19000000-0000-0000-0000-000000000001', 'ow@var.test'), ('19000000-0000-0000-0000-000000000002', 'rv@var.test'),
  ('19000000-0000-0000-0000-000000000005', 'cr@var.test'), ('19000000-0000-0000-0000-000000000006', 'out@var.test');
update public.profiles set plan_id = (select id from public.plans order by monthly_checks desc limit 1) where id::text like '19000000-%';
insert into public.organizations (id, name, created_by) values ('29000000-0000-0000-0000-000000000001', 'Var Bank', '19000000-0000-0000-0000-000000000001');
insert into public.org_members (org_id, user_id, role) values
  ('29000000-0000-0000-0000-000000000001', '19000000-0000-0000-0000-000000000001', 'owner'),
  ('29000000-0000-0000-0000-000000000001', '19000000-0000-0000-0000-000000000002', 'reviewer'),
  ('29000000-0000-0000-0000-000000000001', '19000000-0000-0000-0000-000000000005', 'creator');

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
create temp table ids (k text primary key, v uuid);
grant all on ids to authenticated;

set local role authenticated;
select pg_temp.as_user('19000000-0000-0000-0000-000000000005');
insert into public.promotions (id, owner_id, org_id, title, communication_type, channels, audience, market)
values ('49000000-0000-0000-0000-000000000001', '19000000-0000-0000-0000-000000000005', '29000000-0000-0000-0000-000000000001', 'A', 'financial_promotion', '{instagram,x}', '{general}', 'SA');
do $$ begin
  perform pg_temp.expect_error($q$select public.create_variation('49000000-0000-0000-0000-000000000001', 'B')$q$, 'code:feature_off');
end $$;
reset role;
select set_config('request.jwt.claim.sub', '', true);
insert into public.org_settings (org_id, features) values ('29000000-0000-0000-0000-000000000001', '{"upload_types": true}')
on conflict (org_id) do update set features = excluded.features;

set local role authenticated;
select pg_temp.as_user('19000000-0000-0000-0000-000000000006');
do $$ begin
  perform pg_temp.expect_error($q$select public.create_variation('49000000-0000-0000-0000-000000000001', 'B')$q$, 'code:forbidden');
end $$;
select pg_temp.as_user('19000000-0000-0000-0000-000000000005');
do $$ begin
  insert into ids values ('b', public.create_variation('49000000-0000-0000-0000-000000000001', 'نسخة تيك توك'));
  if (select variation_group_id from public.promotions where id = (select v from ids where k = 'b'))
     is distinct from (select variation_group_id from public.promotions where id = '49000000-0000-0000-0000-000000000001') then raise exception 'not grouped'; end if;
  if (select channels from public.promotions where id = (select v from ids where k = 'b')) <> '{instagram,x}' then raise exception 'context not copied'; end if;
end $$;
-- Only A has an analysed version: bulk submit submits A and skips B.
insert into public.submissions (id, user_id, kind, caption, platform, product_category, promotion_id, sha256)
values ('39000000-0000-0000-0000-000000000001', '19000000-0000-0000-0000-000000000005', 'text', 'a', 'x', 'finance', '49000000-0000-0000-0000-000000000001', 'a1');
reset role;
select set_config('request.jwt.claim.sub', '', true);
update public.submissions set status = 'done', analyzed_at = now() where id = '39000000-0000-0000-0000-000000000001';
set local role authenticated;
select pg_temp.as_user('19000000-0000-0000-0000-000000000005');
do $$
declare r jsonb;
begin
  r := public.submit_variations((select variation_group_id from public.promotions where id = '49000000-0000-0000-0000-000000000001'));
  if jsonb_array_length(r->'submitted') <> 1 or (r->'skipped'->0->>'reason') <> 'no_version' then raise exception 'bulk submit wrong: %', r; end if;
  if (select review_status from public.promotions where id = (select v from ids where k = 'b')) <> 'draft' then raise exception 'B submitted'; end if;
end $$;
-- Batch items without a promotion each get their own promotion (unchanged behaviour).
insert into public.submissions (id, user_id, kind, caption, platform, product_category, sha256) values
  ('39000000-0000-0000-0000-0000000000b1', '19000000-0000-0000-0000-000000000005', 'text', 'b1', 'x', 'finance', 'b1'),
  ('39000000-0000-0000-0000-0000000000b2', '19000000-0000-0000-0000-000000000005', 'text', 'b2', 'x', 'finance', 'b2');
do $$ begin
  if (select count(distinct promotion_id) from public.submissions where id::text like '39000000-0000-0000-0000-0000000000b%') <> 2 then raise exception 'batch items share a promotion'; end if;
end $$;
reset role;

select pass('p6 upload types');
select * from finish();
rollback;
