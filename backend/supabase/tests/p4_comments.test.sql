-- Phase 4 — comments RLS and RPCs, mentions, change-request carry-forward, old versions read-only.
-- Run: npx supabase test db --workdir backend
begin;
create extension if not exists pgtap with schema extensions;
select plan(1);

insert into auth.users (id, email) values
  ('15000000-0000-0000-0000-000000000001', 'rv@c.test'), ('15000000-0000-0000-0000-000000000002', 'cr@c.test'),
  ('15000000-0000-0000-0000-000000000003', 'out@c.test');
update public.profiles set plan_id = (select id from public.plans order by monthly_checks desc limit 1) where id::text like '15000000-%';
insert into public.organizations (id, name, created_by) values ('25000000-0000-0000-0000-000000000001', 'Org C', '15000000-0000-0000-0000-000000000001');
insert into public.org_members (org_id, user_id, role) values
  ('25000000-0000-0000-0000-000000000001', '15000000-0000-0000-0000-000000000001', 'reviewer'),
  ('25000000-0000-0000-0000-000000000001', '15000000-0000-0000-0000-000000000002', 'creator');

create or replace function pg_temp.as_user(_u text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', _u, true), set_config('request.jwt.claim.role', 'authenticated', true)
$$;
create or replace function pg_temp.expect_error(_sql text, _code text) returns void language plpgsql as $$
begin
  execute _sql;
  raise exception 'expected % but succeeded: %', _code, _sql;
exception when others then
  if sqlerrm not like '%' || _code || '%' then raise exception 'expected %, got %', _code, sqlerrm; end if;
end $$;

set local role authenticated;
select pg_temp.as_user('15000000-0000-0000-0000-000000000002');
insert into public.promotions (id, owner_id, org_id, title) values ('45000000-0000-0000-0000-000000000001', '15000000-0000-0000-0000-000000000002', '25000000-0000-0000-0000-000000000001', 'C');
insert into public.submissions (id, user_id, kind, caption, platform, product_category, promotion_id)
values ('35000000-0000-0000-0000-000000000001', '15000000-0000-0000-0000-000000000002', 'image', 'x', 'x', 'other', '45000000-0000-0000-0000-000000000001');

-- Creator: general comment ok, change request forbidden, invalid anchor rejected.
do $$ begin
  perform public.add_comment('45000000-0000-0000-0000-000000000001', '35000000-0000-0000-0000-000000000001', 'سؤال', '{"kind":"image","x":0.2,"y":0.3}');
  perform pg_temp.expect_error($q$select public.add_comment('45000000-0000-0000-0000-000000000001', '35000000-0000-0000-0000-000000000001', 'x', null, null, 'change_request')$q$, 'code:forbidden');
  perform pg_temp.expect_error($q$select public.add_comment('45000000-0000-0000-0000-000000000001', '35000000-0000-0000-0000-000000000001', 'x', '{"kind":"image","x":2,"y":0}')$q$, 'code:invalid_anchor');
end $$;

-- Reviewer pins a change request and mentions the creator (and an outsider, who is filtered out).
reset role;
insert into public.promotions (id, owner_id, title) values ('45000000-0000-0000-0000-000000000009', '15000000-0000-0000-0000-000000000003', 'other');
set local role authenticated;
select pg_temp.as_user('15000000-0000-0000-0000-000000000001');
do $$
declare _c uuid;
begin
  _c := public.add_comment('45000000-0000-0000-0000-000000000001', '35000000-0000-0000-0000-000000000001', 'كبّر عبارة الإشراف',
    '{"kind":"image","x":0.5,"y":0.9}', null, 'change_request',
    array['15000000-0000-0000-0000-000000000002', '15000000-0000-0000-0000-000000000003']::uuid[]);
  if (select mentions from public.comments where id = _c) <> array['15000000-0000-0000-0000-000000000002']::uuid[] then raise exception 'mentions not filtered'; end if;
  perform set_config('test.cr', _c::text, true);
end $$;
reset role;
do $$ begin
  if not exists (select 1 from public.notifications where kind = 'comment_mention' and user_id = '15000000-0000-0000-0000-000000000002') then raise exception 'mention not notified'; end if;
end $$;

-- V2: the open change request is carried; V1 becomes read-only.
set local role authenticated;
select pg_temp.as_user('15000000-0000-0000-0000-000000000002');
insert into public.submissions (id, user_id, kind, caption, platform, product_category, promotion_id)
values ('35000000-0000-0000-0000-000000000002', '15000000-0000-0000-0000-000000000002', 'image', 'x2', 'x', 'other', '45000000-0000-0000-0000-000000000001');
do $$ begin
  if (select count(*) from public.comments where submission_id = '35000000-0000-0000-0000-000000000002' and kind = 'change_request'
      and carried_from_comment_id = current_setting('test.cr')::uuid) <> 1 then raise exception 'change request not carried'; end if;
  if exists (select 1 from public.comments where submission_id = '35000000-0000-0000-0000-000000000002' and kind = 'general') then raise exception 'general comment carried'; end if;
  perform pg_temp.expect_error($q$select public.add_comment('45000000-0000-0000-0000-000000000001', '35000000-0000-0000-0000-000000000001', 'reply', null, current_setting('test.cr')::uuid)$q$, 'code:old_version_read_only');
  perform pg_temp.expect_error($q$select public.resolve_comment(current_setting('test.cr')::uuid, true)$q$, 'code:forbidden');
  perform pg_temp.expect_error($q$update public.comments set body = 'x'$q$, 'permission denied');
end $$;

-- Reviewer resolves: the original and its carried copy are resolved; a V3 no longer carries it.
select pg_temp.as_user('15000000-0000-0000-0000-000000000001');
select public.resolve_comment(current_setting('test.cr')::uuid, true);
select pg_temp.as_user('15000000-0000-0000-0000-000000000002');
insert into public.submissions (id, user_id, kind, caption, platform, product_category, promotion_id)
values ('35000000-0000-0000-0000-000000000003', '15000000-0000-0000-0000-000000000002', 'image', 'x3', 'x', 'other', '45000000-0000-0000-0000-000000000001');
do $$ begin
  if exists (select 1 from public.comments where carried_from_comment_id = current_setting('test.cr')::uuid and resolved_at is null) then raise exception 'carried copy not resolved'; end if;
  if exists (select 1 from public.comments where submission_id = '35000000-0000-0000-0000-000000000003') then raise exception 'resolved request carried to V3'; end if;
end $$;

-- Outsider sees nothing.
select pg_temp.as_user('15000000-0000-0000-0000-000000000003');
do $$ begin
  if exists (select 1 from public.comments where promotion_id = '45000000-0000-0000-0000-000000000001') then raise exception 'outsider reads comments'; end if;
  perform pg_temp.expect_error($q$select public.add_comment('45000000-0000-0000-0000-000000000001', '35000000-0000-0000-0000-000000000003', 'x')$q$, 'code:not_found');
end $$;
reset role;

select pass('comments');
select * from finish();
rollback;
