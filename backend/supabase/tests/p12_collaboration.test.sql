-- D189–D190: eligible-only mentions (no access by mention, no title leak), comment categories and permissions,
-- reply notifications, duplicate-submit protection, author names hidden from externals, Mawthooq manual check.
begin;
create extension if not exists pgtap with schema extensions;
select plan(1);

insert into auth.users (id, email) values
  ('1c000000-0000-0000-0000-000000000001', 'ow@collab.test'), ('1c000000-0000-0000-0000-000000000002', 'mk@collab.test'),
  ('1c000000-0000-0000-0000-000000000003', 'rv@collab.test'), ('1c000000-0000-0000-0000-000000000004', 'lg@collab.test'),
  ('1c000000-0000-0000-0000-000000000005', 'lg2@collab.test'), ('1c000000-0000-0000-0000-000000000006', 'ext@collab.test'),
  ('1c000000-0000-0000-0000-000000000007', 'vw@collab.test'), ('1c000000-0000-0000-0000-000000000008', 'mk2@collab.test');
update public.profiles set plan_id = (select id from public.plans order by monthly_checks desc limit 1) where id::text like '1c000000-%';
insert into public.organizations (id, name, created_by) values ('2c000000-0000-0000-0000-000000000001', 'Collab Org', '1c000000-0000-0000-0000-000000000001');
insert into public.org_members (org_id, user_id, role, display_name) values
  ('2c000000-0000-0000-0000-000000000001', '1c000000-0000-0000-0000-000000000001', 'owner', 'المالك'),
  ('2c000000-0000-0000-0000-000000000001', '1c000000-0000-0000-0000-000000000002', 'creator', 'المسوقة'),
  ('2c000000-0000-0000-0000-000000000001', '1c000000-0000-0000-0000-000000000003', 'reviewer', 'المراجع'),
  ('2c000000-0000-0000-0000-000000000001', '1c000000-0000-0000-0000-000000000004', 'legal', 'القانوني'),
  ('2c000000-0000-0000-0000-000000000001', '1c000000-0000-0000-0000-000000000005', 'legal', 'قانوني آخر'),
  ('2c000000-0000-0000-0000-000000000001', '1c000000-0000-0000-0000-000000000006', 'external_uploader', 'وكالة'),
  ('2c000000-0000-0000-0000-000000000001', '1c000000-0000-0000-0000-000000000007', 'viewer', 'المطلع'),
  ('2c000000-0000-0000-0000-000000000001', '1c000000-0000-0000-0000-000000000008', 'creator', 'مسوق آخر');
insert into public.org_settings (org_id) values ('2c000000-0000-0000-0000-000000000001') on conflict (org_id) do nothing;

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

insert into public.promotions (id, owner_id, org_id, title, communication_type, escalated_to)
values ('4c000000-0000-0000-0000-000000000001', '1c000000-0000-0000-0000-000000000002', '2c000000-0000-0000-0000-000000000001',
        'إعلان سري', 'general_commercial', '1c000000-0000-0000-0000-000000000004');
insert into public.submissions (id, user_id, kind, caption, platform, product_category, promotion_id, sha256)
values ('3c000000-0000-0000-0000-000000000001', '1c000000-0000-0000-0000-000000000002', 'text', 'x', 'x', 'beauty', '4c000000-0000-0000-0000-000000000001', 'c1');

set local role authenticated;
select pg_temp.as_user('1c000000-0000-0000-0000-000000000003');
do $$
declare _c uuid; _r uuid; _list jsonb;
begin
  _list := public.comment_participants('4c000000-0000-0000-0000-000000000001');
  -- Eligible: owner, marketer (ad owner), legal on the case, viewer. Not: other legal, external, other marketer.
  if exists (select 1 from jsonb_array_elements(_list) e where e->>'user_id' in ('1c000000-0000-0000-0000-000000000005',
      '1c000000-0000-0000-0000-000000000006', '1c000000-0000-0000-0000-000000000008')) then raise exception 'ineligible offered: %', _list; end if;
  if not exists (select 1 from jsonb_array_elements(_list) e where e->>'user_id' = '1c000000-0000-0000-0000-000000000004') then raise exception 'case legal missing'; end if;
  -- Mentioning ineligible people silently drops them: no notification, no access.
  _c := public.add_comment('4c000000-0000-0000-0000-000000000001', '3c000000-0000-0000-0000-000000000001', 'راجعوا الادعاء', null, null, 'reviewer_feedback',
    array['1c000000-0000-0000-0000-000000000004', '1c000000-0000-0000-0000-000000000005', '1c000000-0000-0000-0000-000000000006',
          '1c000000-0000-0000-0000-000000000008']::uuid[], array['https://example.test/guide.pdf']);
  if (select mentions from public.comments where id = _c) <> array['1c000000-0000-0000-0000-000000000004']::uuid[] then raise exception 'mentions not filtered'; end if;
  -- Double submit returns the same comment.
  if public.add_comment('4c000000-0000-0000-0000-000000000001', '3c000000-0000-0000-0000-000000000001', 'راجعوا الادعاء', null, null, 'reviewer_feedback') <> _c then
    raise exception 'duplicate comment created'; end if;
  perform pg_temp.expect_error($q$select public.add_comment('4c000000-0000-0000-0000-000000000001', '3c000000-0000-0000-0000-000000000001', 'x', null, null, 'legal_opinion')$q$, 'code:forbidden');
  perform pg_temp.expect_error($q$select public.add_comment('4c000000-0000-0000-0000-000000000001', '3c000000-0000-0000-0000-000000000001', 'x', null, null, 'general', '{}', array['javascript:alert(1)'])$q$, 'code:invalid_link');
  perform pg_temp.expect_error($q$select public.verify_creator_license('4c000000-0000-0000-0000-000000000001', 'verified', 'x')$q$, 'code:not_assigned');
end $$;
reset role;
select set_config('request.jwt.claim.sub', '', true);
do $$ begin
  if exists (select 1 from public.notifications where kind = 'comment_mention' and user_id in ('1c000000-0000-0000-0000-000000000005',
      '1c000000-0000-0000-0000-000000000006', '1c000000-0000-0000-0000-000000000008')) then raise exception 'ineligible notified'; end if;
  if not exists (select 1 from public.notifications where kind = 'comment_mention' and user_id = '1c000000-0000-0000-0000-000000000004') then raise exception 'legal not notified'; end if;
end $$;

-- Marketer replies (notifies the reviewer); cannot post reviewer feedback; legal posts an opinion on its case.
set local role authenticated;
select pg_temp.as_user('1c000000-0000-0000-0000-000000000002');
do $$
declare _parent uuid := (select id from public.comments where kind = 'reviewer_feedback' limit 1);
begin
  perform pg_temp.expect_error($q$select public.add_comment('4c000000-0000-0000-0000-000000000001', '3c000000-0000-0000-0000-000000000001', 'x', null, null, 'reviewer_feedback')$q$, 'code:forbidden');
  perform public.add_comment('4c000000-0000-0000-0000-000000000001', '3c000000-0000-0000-0000-000000000001', 'عدّلنا النص', null, _parent);
  perform pg_temp.expect_error($q$update public.promotions set creator_license_status = 'verified' where id = '4c000000-0000-0000-0000-000000000001'$q$, 'permission denied');
end $$;
select pg_temp.as_user('1c000000-0000-0000-0000-000000000004');
select public.add_comment('4c000000-0000-0000-0000-000000000001', '3c000000-0000-0000-0000-000000000001', 'الرأي القانوني: يلزم الإفصاح', null, null, 'legal_opinion');
select pg_temp.as_user('1c000000-0000-0000-0000-000000000005');
do $$ begin
  perform pg_temp.expect_error($q$select public.add_comment('4c000000-0000-0000-0000-000000000001', '3c000000-0000-0000-0000-000000000001', 'x')$q$, 'code:not_found');
  if jsonb_array_length(public.comment_participants('4c000000-0000-0000-0000-000000000001')) <> 0 then raise exception 'non-case legal sees participants'; end if;
end $$;
-- Viewer: read-only.
select pg_temp.as_user('1c000000-0000-0000-0000-000000000007');
do $$ begin
  perform pg_temp.expect_error($q$select public.add_comment('4c000000-0000-0000-0000-000000000001', '3c000000-0000-0000-0000-000000000001', 'x')$q$, 'code:read_only_role');
end $$;
reset role;
select set_config('request.jwt.claim.sub', '', true);
do $$ begin
  if not exists (select 1 from public.notifications where kind = 'comment_reply' and user_id = '1c000000-0000-0000-0000-000000000003') then raise exception 'reply not notified'; end if;
end $$;

-- Owner checks the licence manually (an audit event, not an approval).
set local role authenticated;
select pg_temp.as_user('1c000000-0000-0000-0000-000000000001');
do $$ begin
  perform pg_temp.expect_error($q$select public.verify_creator_license('4c000000-0000-0000-0000-000000000001', 'verified', 'رقم الرخصة')$q$, 'code:license_missing');
  perform public.verify_creator_license('4c000000-0000-0000-0000-000000000001', 'not_applicable', 'نشر عبر قنوات الجهة الرسمية');
  perform public.verify_creator_license('4c000000-0000-0000-0000-000000000001', 'not_applicable', 'نشر عبر قنوات الجهة الرسمية');
  if (select count(*) from public.review_events where promotion_id = '4c000000-0000-0000-0000-000000000001' and event_type = 'license_checked') <> 1 then raise exception 'duplicate license events'; end if;
  if (select review_status from public.promotions where id = '4c000000-0000-0000-0000-000000000001') <> 'draft' then raise exception 'status changed'; end if;
end $$;
reset role;

select pass('p12 collaboration');
select * from finish();
rollback;
