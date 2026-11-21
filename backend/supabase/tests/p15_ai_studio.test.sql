-- SALEEM AI Studio (D207): draft privacy, creation rights, frozen results, acceptance checks, quotas.
begin;
create extension if not exists pgtap with schema extensions;
select plan(1);

insert into auth.users (id, email) values
  ('1f000000-0000-0000-0000-000000000001', 'ow@studio.test'), ('1f000000-0000-0000-0000-000000000002', 'mk@studio.test'),
  ('1f000000-0000-0000-0000-000000000003', 'rv@studio.test'), ('1f000000-0000-0000-0000-000000000004', 'vw@studio.test'),
  ('1f000000-0000-0000-0000-000000000005', 'mk2@studio.test');
update public.profiles set plan_id = (select id from public.plans order by monthly_checks desc limit 1) where id::text like '1f000000-%';
insert into public.organizations (id, name, created_by) values ('2f000000-0000-0000-0000-000000000001', 'Studio Org', '1f000000-0000-0000-0000-000000000001');
insert into public.org_members (org_id, user_id, role) values
  ('2f000000-0000-0000-0000-000000000001', '1f000000-0000-0000-0000-000000000001', 'owner'),
  ('2f000000-0000-0000-0000-000000000001', '1f000000-0000-0000-0000-000000000002', 'creator'),
  ('2f000000-0000-0000-0000-000000000001', '1f000000-0000-0000-0000-000000000003', 'reviewer'),
  ('2f000000-0000-0000-0000-000000000001', '1f000000-0000-0000-0000-000000000004', 'viewer'),
  ('2f000000-0000-0000-0000-000000000001', '1f000000-0000-0000-0000-000000000005', 'creator');

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
-- Reviewer and viewer cannot create drafts in the organisation.
select pg_temp.as_user('1f000000-0000-0000-0000-000000000003');
do $$ begin
  perform pg_temp.expect_error($q$insert into public.studio_drafts (id, org_id, brief) values ('3f000000-0000-0000-0000-0000000000aa', '2f000000-0000-0000-0000-000000000001', '{}')$q$, 'row-level security');
end $$;
select pg_temp.as_user('1f000000-0000-0000-0000-000000000004');
do $$ begin
  perform pg_temp.expect_error($q$insert into public.studio_drafts (id, org_id, brief) values ('3f000000-0000-0000-0000-0000000000ab', '2f000000-0000-0000-0000-000000000001', '{}')$q$, 'row-level security');
end $$;

-- The marketer creates a draft; it is private to them.
select pg_temp.as_user('1f000000-0000-0000-0000-000000000002');
insert into public.studio_drafts (id, org_id, brief) values ('3f000000-0000-0000-0000-000000000001', '2f000000-0000-0000-0000-000000000001', '{"product": {"name": "x"}}');
do $$ begin
  -- A client cannot accept a draft or attach a result by updating the row.
  perform pg_temp.expect_error($q$update public.studio_drafts set status = 'accepted' where id = '3f000000-0000-0000-0000-000000000001'$q$, 'row-level security');
  update public.studio_drafts set status = 'rendered', result_promotion_id = gen_random_uuid(), attempts = 99 where id = '3f000000-0000-0000-0000-000000000001';
  if (select result_promotion_id is not null or attempts <> 0 from public.studio_drafts where id = '3f000000-0000-0000-0000-000000000001') then
    raise exception 'client changed frozen columns'; end if;
  -- Accepting with a promotion that is not theirs / not a video version of it is refused.
  perform pg_temp.expect_error(format('select public.accept_studio_draft(%L, %L, %L)', '3f000000-0000-0000-0000-000000000001', gen_random_uuid(), gen_random_uuid()), 'code:invalid_result');
  -- Usage rows cannot be forged by clients.
  perform pg_temp.expect_error($q$insert into public.ai_usage (capability, provider) values ('script', 'gemini')$q$, 'permission denied');
  if (public.ai_allowance('2f000000-0000-0000-0000-000000000001', 'script')->>'limit')::int <> 60 then raise exception 'default script limit'; end if;
  if (public.ai_allowance('2f000000-0000-0000-0000-000000000001', 'video')->>'ok')::boolean then raise exception 'video must default to 0'; end if;
  perform pg_temp.expect_error($q$select public.set_ai_limit('2f000000-0000-0000-0000-000000000001', 'script', 5)$q$, 'code:forbidden');
end $$;
-- Another marketer cannot see or accept it.
select pg_temp.as_user('1f000000-0000-0000-0000-000000000005');
do $$ begin
  if exists (select 1 from public.studio_drafts where id = '3f000000-0000-0000-0000-000000000001') then raise exception 'draft visible to another user'; end if;
  perform pg_temp.expect_error($q$select public.accept_studio_draft('3f000000-0000-0000-0000-000000000001', gen_random_uuid(), gen_random_uuid())$q$, 'code:forbidden');
end $$;

-- A real acceptance: the marketer's own promotion with a video version.
select pg_temp.as_user('1f000000-0000-0000-0000-000000000002');
insert into public.promotions (id, owner_id, org_id, title, communication_type)
values ('4f000000-0000-0000-0000-000000000001', '1f000000-0000-0000-0000-000000000002', '2f000000-0000-0000-0000-000000000001', 'Studio ad', 'general_commercial');
insert into public.submissions (id, user_id, kind, caption, platform, product_category, promotion_id, sha256, file_path, ai_used)
values ('5f000000-0000-0000-0000-000000000001', '1f000000-0000-0000-0000-000000000002', 'video', 'إعلان مدفوع', 'instagram', 'beauty', '4f000000-0000-0000-0000-000000000001', 'st1', 'u/x/original.mp4', true);
do $$ begin
  perform public.accept_studio_draft('3f000000-0000-0000-0000-000000000001', '4f000000-0000-0000-0000-000000000001', '5f000000-0000-0000-0000-000000000001');
  perform public.accept_studio_draft('3f000000-0000-0000-0000-000000000001', '4f000000-0000-0000-0000-000000000001', '5f000000-0000-0000-0000-000000000001'); -- idempotent
  if (select status || '/' || (result_submission_id = '5f000000-0000-0000-0000-000000000001')::text from public.studio_drafts where id = '3f000000-0000-0000-0000-000000000001') <> 'accepted/true' then
    raise exception 'not accepted with its result'; end if;
  -- The generated ad is never approved automatically.
  if (select review_status from public.promotions where id = '4f000000-0000-0000-0000-000000000001') <> 'draft' then raise exception 'status changed'; end if;
  -- Accepted drafts are frozen.
  perform pg_temp.expect_error($q$select public.discard_studio_draft('3f000000-0000-0000-0000-000000000001')$q$, 'code:invalid_status');
end $$;

-- The owner sets a quota.
select pg_temp.as_user('1f000000-0000-0000-0000-000000000001');
select public.set_ai_limit('2f000000-0000-0000-0000-000000000001', 'script', 5);
do $$ begin
  if (public.ai_allowance('2f000000-0000-0000-0000-000000000001', 'script')->>'limit')::int <> 5 then raise exception 'limit not set'; end if;
  if (select features->'ai_limits'->>'script' from public.org_settings where org_id = '2f000000-0000-0000-0000-000000000001') <> '5' then raise exception 'not stored'; end if;
end $$;
reset role;

select pass('p15 SALEEM AI Studio');
select * from finish();
rollback;
