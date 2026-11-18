-- Phase 6.3 — partners: hashed tokens, flag, terms, one promotion at a time, allowed products/channels, pending access,
-- and isolation (external members read nothing of the org except their own promotions). Run: npx supabase test db --workdir backend
begin;
create extension if not exists pgtap with schema extensions;
select plan(1);

insert into auth.users (id, email) values
  ('18000000-0000-0000-0000-000000000001', 'ow@partner.test'), ('18000000-0000-0000-0000-000000000002', 'agency@partner.test'),
  ('18000000-0000-0000-0000-000000000003', 'cr@partner.test'), ('18000000-0000-0000-0000-000000000004', 'other@partner.test');
update public.profiles set plan_id = (select id from public.plans order by monthly_checks desc limit 1) where id::text like '18000000-%';
insert into public.organizations (id, name, created_by) values ('28000000-0000-0000-0000-000000000001', 'Partner Bank', '18000000-0000-0000-0000-000000000001');
insert into public.org_members (org_id, user_id, role) values
  ('28000000-0000-0000-0000-000000000001', '18000000-0000-0000-0000-000000000001', 'owner'),
  ('28000000-0000-0000-0000-000000000001', '18000000-0000-0000-0000-000000000003', 'creator');
insert into public.products (id, org_id, name_ar, sector, product_type, regulator)
values ('58000000-0000-0000-0000-000000000001', '28000000-0000-0000-0000-000000000001', 'بطاقة', 'banking', 'credit_card', 'SAMA'),
       ('58000000-0000-0000-0000-000000000002', '28000000-0000-0000-0000-000000000001', 'تمويل', 'banking', 'personal_finance', 'SAMA');
insert into public.promotions (id, owner_id, org_id, title, communication_type) values
  ('48000000-0000-0000-0000-0000000000ff', '18000000-0000-0000-0000-000000000003', '28000000-0000-0000-0000-000000000001', 'internal', 'financial_promotion');
insert into public.org_settings (org_id, hide_comments_from_external) values ('28000000-0000-0000-0000-000000000001', true)
on conflict (org_id) do update set hide_comments_from_external = true;

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
create temp table tok (k text primary key, v text);
grant all on tok to authenticated, anon;

-- Flag off → no links.
set local role authenticated;
select pg_temp.as_user('18000000-0000-0000-0000-000000000001');
do $$ begin
  perform pg_temp.expect_error($q$select public.create_partner_link('28000000-0000-0000-0000-000000000001', 'وكالة', '{}', '{}', null, 'الشروط')$q$, 'code:feature_off');
end $$;
reset role;
select set_config('request.jwt.claim.sub', '', true);
update public.org_settings set features = '{"partners": true}' where org_id = '28000000-0000-0000-0000-000000000001';

set local role authenticated;
select pg_temp.as_user('18000000-0000-0000-0000-000000000003');
do $$ begin
  perform pg_temp.expect_error($q$select public.create_partner_link('28000000-0000-0000-0000-000000000001', 'x', '{}', '{}', null, 'x')$q$, 'code:forbidden');
end $$;
select pg_temp.as_user('18000000-0000-0000-0000-000000000001');
do $$ begin
  insert into tok values ('t', public.create_partner_link('28000000-0000-0000-0000-000000000001', 'وكالة', '{58000000-0000-0000-0000-000000000001}', '{instagram,tiktok}', 'مرحباً', 'أوافق على الشروط'));
  perform pg_temp.expect_error($q$select token_hash from public.partner_links$q$, 'permission denied');
end $$;

-- Anonymous: info only, no membership.
reset role;
select set_config('request.jwt.claim.sub', '', true);
do $$ begin
  if exists (select 1 from public.partner_links where token_hash = (select v from tok)) then raise exception 'raw token stored'; end if;
  if not exists (select 1 from public.partner_links where token_hash = encode(extensions.digest(convert_to((select v from tok), 'UTF8'), 'sha256'), 'hex')) then raise exception 'hash missing'; end if;
end $$;
set local role anon;
do $$ begin
  if not (public.partner_link_info((select v from tok))->>'ok')::boolean then raise exception 'info not public'; end if;
  if (public.partner_link_info('wrong')->>'ok')::boolean then raise exception 'wrong token accepted'; end if;
  if jsonb_array_length(public.partner_link_info((select v from tok))->'products') <> 1 then raise exception 'products not limited'; end if;
end $$;
reset role;

-- The agency signs in, accepts the terms, submits one promotion within the allowed scope.
set local role authenticated;
select pg_temp.as_user('18000000-0000-0000-0000-000000000002');
do $$
declare _pid uuid;
begin
  perform pg_temp.expect_error(format('select public.partner_join(%L, false)', (select v from tok)), 'code:terms_required');
  if public.partner_join((select v from tok), true) <> 'pending' then raise exception 'not pending'; end if;
  perform pg_temp.expect_error(format('select public.partner_create_promotion(%L, %L, %L, %L, %L)', (select v from tok), 'x',
    '58000000-0000-0000-0000-000000000002', '{instagram}', 'financial_promotion'), 'code:product_not_allowed');
  perform pg_temp.expect_error(format('select public.partner_create_promotion(%L, %L, %L, %L, %L)', (select v from tok), 'x',
    '58000000-0000-0000-0000-000000000001', '{snapchat}', 'financial_promotion'), 'code:channel_not_allowed');
  _pid := public.partner_create_promotion((select v from tok), 'حملة البطاقة', '58000000-0000-0000-0000-000000000001', '{instagram}', 'financial_promotion');
  if not public.can_read_promotion(_pid) then raise exception 'partner cannot read own promotion'; end if;
  perform pg_temp.expect_error(format('select public.partner_create_promotion(%L, %L, %L, %L, %L)', (select v from tok), 'y',
    '58000000-0000-0000-0000-000000000001', '{instagram}', 'financial_promotion'), 'code:one_at_a_time');
  -- Isolation: nothing else of the org is readable.
  if exists (select 1 from public.promotions where id = '48000000-0000-0000-0000-0000000000ff') then raise exception 'reads internal promotion'; end if;
  if exists (select 1 from public.products where org_id = '28000000-0000-0000-0000-000000000001') then raise exception 'reads products'; end if;
  if exists (select 1 from public.org_members where org_id = '28000000-0000-0000-0000-000000000001') then raise exception 'reads members'; end if;
  if exists (select 1 from public.org_settings where org_id = '28000000-0000-0000-0000-000000000001') then raise exception 'reads settings'; end if;
  if exists (select 1 from public.organizations where id = '28000000-0000-0000-0000-000000000001') then raise exception 'reads org'; end if;
  if exists (select 1 from public.partner_links) then raise exception 'reads links'; end if;
  if public.is_org_member('28000000-0000-0000-0000-000000000001') then raise exception 'external counted as member'; end if;
  perform pg_temp.expect_error($q$insert into public.promotions (owner_id, org_id, title, communication_type) values ('18000000-0000-0000-0000-000000000002', '28000000-0000-0000-0000-000000000001', 'direct', 'financial_promotion')$q$, 'row-level security');
end $$;

-- Owner sees the pending partner and approves; another user cannot use someone else's promotion.
select pg_temp.as_user('18000000-0000-0000-0000-000000000001');
do $$ begin
  if (select access_status from public.org_members where user_id = '18000000-0000-0000-0000-000000000002') <> 'pending' then raise exception 'not pending for admin'; end if;
  perform public.decide_partner_access('28000000-0000-0000-0000-000000000001', '18000000-0000-0000-0000-000000000002', true);
  if (select count(*) from public.notifications where kind = 'partner_access_requested' and user_id = '18000000-0000-0000-0000-000000000001') <> 1 then raise exception 'admin not notified'; end if;
end $$;
select pg_temp.as_user('18000000-0000-0000-0000-000000000004');
do $$ begin
  if exists (select 1 from public.promotions where owner_id = '18000000-0000-0000-0000-000000000002') then raise exception 'other user reads partner promotion'; end if;
end $$;

-- Deactivated link stops working.
select pg_temp.as_user('18000000-0000-0000-0000-000000000001');
select public.set_partner_link_active((select id from public.partner_links limit 1), false);
select pg_temp.as_user('18000000-0000-0000-0000-000000000002');
do $$ begin
  if (public.partner_link_info((select v from tok))->>'ok')::boolean then raise exception 'inactive link works'; end if;
end $$;
reset role;

select pass('p6 partners');
select * from finish();
rollback;
