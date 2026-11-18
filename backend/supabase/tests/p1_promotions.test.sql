-- Phase 1 — M1 promotions: backfill, attach trigger, lock, RLS, column privileges.
-- Run: npx supabase test db --workdir backend
begin;
create extension if not exists pgtap with schema extensions;
select plan(1);

-- Users: u1 personal creator, u2 outsider, ow org owner, rv org reviewer, cr org creator.
insert into auth.users (id, email) values
  ('10000000-0000-0000-0000-000000000001', 'u1@test.local'),
  ('10000000-0000-0000-0000-000000000002', 'u2@test.local'),
  ('10000000-0000-0000-0000-000000000003', 'ow@test.local'),
  ('10000000-0000-0000-0000-000000000004', 'rv@test.local'),
  ('10000000-0000-0000-0000-000000000005', 'cr@test.local');
-- Fixtures create many checks this month: put test users on the largest plan (quota is not under test).
update public.profiles set plan_id = (select id from public.plans order by monthly_checks desc limit 1)
where id::text like '10000000-%';
insert into public.organizations (id, name, created_by) values
  ('20000000-0000-0000-0000-000000000001', 'Org Test', '10000000-0000-0000-0000-000000000003');
insert into public.org_members (org_id, user_id, role) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 'owner'),
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004', 'reviewer'),
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000005', 'creator');

-- ---- 1. Backfill on legacy chains (trigger off to simulate pre-v2 rows) -----------------------
alter table public.submissions disable trigger submissions_v2_attach_promotion;
alter table public.submissions disable trigger submissions_v2_set_current;
insert into public.submissions (id, user_id, kind, caption, platform, product_category, title, created_at, parent_id) values
  ('30000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-000000000001', 'text', 'x', 'x', 'other', 'Chain A', now() - interval '9 days', null),
  ('30000000-0000-0000-0000-0000000000b1', '10000000-0000-0000-0000-000000000001', 'text', 'x', 'tiktok', 'other', 'Chain B', now() - interval '8 days', null),
  ('30000000-0000-0000-0000-0000000000b2', '10000000-0000-0000-0000-000000000001', 'text', 'x', 'tiktok', 'other', 'B2', now() - interval '7 days', '30000000-0000-0000-0000-0000000000b1'),
  ('30000000-0000-0000-0000-0000000000c1', '10000000-0000-0000-0000-000000000001', 'text', 'x', 'x', 'other', '', now() - interval '6 days', null),
  ('30000000-0000-0000-0000-0000000000c2', '10000000-0000-0000-0000-000000000001', 'text', 'x', 'x', 'other', 'C2', now() - interval '5 days', '30000000-0000-0000-0000-0000000000c1'),
  ('30000000-0000-0000-0000-0000000000c3', '10000000-0000-0000-0000-000000000001', 'text', 'x', 'x', 'other', 'C3', now() - interval '4 days', '30000000-0000-0000-0000-0000000000c2'),
  -- a user's re-check of the public demo must not join the demo's promotion
  ('30000000-0000-0000-0000-0000000000d1', '10000000-0000-0000-0000-000000000001', 'text', 'x', 'x', 'other', 'Demo recheck', now() - interval '3 days', 'd0000000-0000-0000-0000-000000000001');
alter table public.submissions enable trigger submissions_v2_attach_promotion;
alter table public.submissions enable trigger submissions_v2_set_current;

do $$
declare _created int; _pa uuid; _pb uuid; _pc uuid; _pd uuid; _demo uuid;
begin
  _created := public.v2_backfill_promotions();
  if _created <> 4 then raise exception 'backfill created % promotions, expected 4', _created; end if;
  select promotion_id into _pa from public.submissions where id = '30000000-0000-0000-0000-0000000000a1';
  select promotion_id into _pb from public.submissions where id = '30000000-0000-0000-0000-0000000000b1';
  select promotion_id into _pc from public.submissions where id = '30000000-0000-0000-0000-0000000000c1';
  select promotion_id into _pd from public.submissions where id = '30000000-0000-0000-0000-0000000000d1';
  select promotion_id into _demo from public.submissions where id = 'd0000000-0000-0000-0000-000000000001';
  if (select count(*) from public.submissions where promotion_id = _pb) <> 2 then raise exception 'chain B not 2 versions'; end if;
  if (select array_agg(version_no order by version_no) from public.submissions where promotion_id = _pc) <> array[1,2,3] then
    raise exception 'chain C version numbers wrong'; end if;
  if (select version_no from public.submissions where id = '30000000-0000-0000-0000-0000000000c3') <> 3 then raise exception 'c3 not v3'; end if;
  if (select current_version_id from public.promotions where id = _pc) <> '30000000-0000-0000-0000-0000000000c3' then
    raise exception 'current version of C is not the latest'; end if;
  if (select title from public.promotions where id = _pc) not like 'إعلان %' then raise exception 'empty title fallback missing'; end if;
  if (select channels from public.promotions where id = _pb) <> array['tiktok'] then raise exception 'platform not mapped to channels'; end if;
  if _pd = _demo or (select version_no from public.submissions where id = '30000000-0000-0000-0000-0000000000d1') <> 1 then
    raise exception 'demo re-check joined the demo promotion'; end if;
  if (select review_status from public.promotions where id = _pa) <> 'draft' then raise exception 'legacy promotion not draft'; end if;
  if public.v2_backfill_promotions() <> 0 then raise exception 'backfill is not idempotent'; end if;
  if exists (select 1 from public.submissions where promotion_id is null) then raise exception 'a submission has no promotion'; end if;
end $$;

-- ---- 2. Old client path (no promotion_id) and re-check via parent_id ---------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true),
       set_config('request.jwt.claim.role', 'authenticated', true);
insert into public.submissions (id, user_id, kind, caption, platform, product_category, title)
values ('30000000-0000-0000-0000-0000000000e1', '10000000-0000-0000-0000-000000000001', 'text', 'cap', 'x', 'other', 'Old path');
insert into public.submissions (id, user_id, kind, caption, platform, product_category, title, parent_id)
values ('30000000-0000-0000-0000-0000000000e2', '10000000-0000-0000-0000-000000000001', 'text', 'cap', 'x', 'other', 'Old path 2',
        '30000000-0000-0000-0000-0000000000e1');
do $$
declare _p uuid;
begin
  select promotion_id into _p from public.submissions where id = '30000000-0000-0000-0000-0000000000e1';
  if _p is null then raise exception 'old path created no promotion'; end if;
  if (select version_no from public.submissions where id = '30000000-0000-0000-0000-0000000000e1') <> 1 then raise exception 'not v1'; end if;
  if (select promotion_id from public.submissions where id = '30000000-0000-0000-0000-0000000000e2') <> _p then raise exception 're-check not in same promotion'; end if;
  if (select version_no from public.submissions where id = '30000000-0000-0000-0000-0000000000e2') <> 2 then raise exception 're-check not v2'; end if;
  if (select current_version_id from public.promotions where id = _p) <> '30000000-0000-0000-0000-0000000000e2' then raise exception 'current not updated'; end if;
  if (select title from public.promotions where id = _p) <> 'Old path' then raise exception 'title not taken from submission'; end if;
end $$;

-- New path: explicit promotion_id continues numbering and links parent_id to the previous version.
insert into public.promotions (id, owner_id, title, communication_type)
values ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Explicit', 'general_commercial');
insert into public.submissions (id, user_id, kind, caption, platform, product_category, promotion_id)
values ('30000000-0000-0000-0000-0000000000f1', '10000000-0000-0000-0000-000000000001', 'text', 'a', 'x', 'other', '40000000-0000-0000-0000-000000000001'),
       ('30000000-0000-0000-0000-0000000000f2', '10000000-0000-0000-0000-000000000001', 'text', 'b', 'x', 'other', '40000000-0000-0000-0000-000000000001');
do $$ begin
  if (select version_no from public.submissions where id = '30000000-0000-0000-0000-0000000000f2') <> 2 then raise exception 'explicit v2 wrong'; end if;
  if (select parent_id from public.submissions where id = '30000000-0000-0000-0000-0000000000f2') <> '30000000-0000-0000-0000-0000000000f1' then
    raise exception 'parent not linked to previous version'; end if;
end $$;

-- Column privileges: the client cannot set or change review fields.
do $$ begin
  begin
    update public.promotions set review_status = 'approved' where id = '40000000-0000-0000-0000-000000000001';
    raise exception 'review_status update allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.promotions (owner_id, title, review_status) values ('10000000-0000-0000-0000-000000000001', 'Forged', 'approved');
    raise exception 'review_status insert allowed';
  exception when insufficient_privilege then null; end;
  begin
    update public.submissions set version_no = 9 where id = '30000000-0000-0000-0000-0000000000f2';
    raise exception 'version_no update allowed';
  exception when insufficient_privilege then null; end;
end $$;
-- Context fields are editable while draft.
update public.promotions set title = 'Explicit (edited)', channels = '{instagram}' where id = '40000000-0000-0000-0000-000000000001';
do $$ begin
  if (select title from public.promotions where id = '40000000-0000-0000-0000-000000000001') <> 'Explicit (edited)' then raise exception 'context update failed'; end if;
end $$;

-- ---- 3. Lock: no new version on an approved promotion -----------------------------------------
reset role;
update public.promotions set review_status = 'approved' where id = '40000000-0000-0000-0000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true),
       set_config('request.jwt.claim.role', 'authenticated', true);
do $$ begin
  begin
    insert into public.submissions (user_id, kind, caption, platform, product_category, promotion_id)
    values ('10000000-0000-0000-0000-000000000001', 'text', 'c', 'x', 'other', '40000000-0000-0000-0000-000000000001');
    raise exception 'version added to approved promotion';
  exception when others then
    if sqlerrm not like '%code:promotion_locked%' then raise; end if;
  end;
end $$;

-- ---- 4. RLS -------------------------------------------------------------------------------------
-- Outsider u2 sees none of u1's promotions and cannot add versions to them.
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
do $$ begin
  if exists (select 1 from public.promotions where owner_id = '10000000-0000-0000-0000-000000000001') then raise exception 'outsider reads promotions'; end if;
end $$;
reset role;
do $$ declare _p uuid; begin
  select promotion_id into _p from public.submissions where id = '30000000-0000-0000-0000-0000000000e1';
  perform set_config('test.p_e', _p::text, true);
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
do $$ begin
  begin
    insert into public.submissions (user_id, kind, caption, platform, product_category, promotion_id)
    values ('10000000-0000-0000-0000-000000000002', 'text', 'c', 'x', 'other', current_setting('test.p_e')::uuid);
    raise exception 'outsider added a version';
  exception when others then
    if sqlerrm not like '%code:promotion_forbidden%' then raise; end if;
  end;
end $$;

-- Org: the creator creates an org promotion; the reviewer and owner read it; the outsider does not.
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000005', true);
insert into public.promotions (id, owner_id, org_id, title, communication_type)
values ('40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000001', 'Org promo', 'financial_promotion');
insert into public.submissions (id, user_id, kind, caption, platform, product_category, promotion_id)
values ('30000000-0000-0000-0000-0000000000a9', '10000000-0000-0000-0000-000000000005', 'text', 'org', 'x', 'other', '40000000-0000-0000-0000-000000000002');
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000004', true);
do $$ begin
  if not exists (select 1 from public.promotions where id = '40000000-0000-0000-0000-000000000002') then raise exception 'org reviewer cannot read'; end if;
  if not exists (select 1 from public.submissions where id = '30000000-0000-0000-0000-0000000000a9') then raise exception 'org reviewer cannot read the version'; end if;
  -- reviewers cannot edit context
  update public.promotions set title = 'hijack' where id = '40000000-0000-0000-0000-000000000002';
  if (select title from public.promotions where id = '40000000-0000-0000-0000-000000000002') = 'hijack' then raise exception 'reviewer edited context'; end if;
end $$;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
do $$ begin
  if exists (select 1 from public.promotions where id = '40000000-0000-0000-0000-000000000002') then raise exception 'outsider reads org promotion'; end if;
end $$;
-- Outsider cannot create a promotion inside the org.
do $$ begin
  begin
    insert into public.promotions (owner_id, org_id, title) values ('10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'x');
    raise exception 'outsider created org promotion';
  exception when insufficient_privilege then null; end;
end $$;

-- Anonymous visitors read demo promotions only.
reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true), set_config('request.jwt.claim.role', 'anon', true);
do $$ begin
  if exists (select 1 from public.promotions where not is_demo) then raise exception 'anon reads non-demo promotion'; end if;
  if not exists (select 1 from public.promotions where is_demo) then raise exception 'anon cannot read demo promotion'; end if;
end $$;
reset role;

select pass('promotions: backfill, attach trigger, lock, RLS, column privileges');
select * from finish();
rollback;
