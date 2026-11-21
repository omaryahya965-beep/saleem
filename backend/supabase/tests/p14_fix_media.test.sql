-- SALEEM Fix media editing (D198): media_edit needs an original video, is ready at once (browser renderer, no
-- provider, no charge), accepts a media-only proposal, and an interrupted acceptance is re-claimable only when stale.
begin;
create extension if not exists pgtap with schema extensions;
select plan(1);

insert into auth.users (id, email) values ('1e000000-0000-0000-0000-000000000001', 'ow@media.test'), ('1e000000-0000-0000-0000-000000000002', 'mk@media.test');
update public.profiles set plan_id = (select id from public.plans order by monthly_checks desc limit 1) where id::text like '1e000000-%';
insert into public.organizations (id, name, created_by) values ('2e000000-0000-0000-0000-000000000001', 'Media Org', '1e000000-0000-0000-0000-000000000001');
insert into public.org_members (org_id, user_id, role) values
  ('2e000000-0000-0000-0000-000000000001', '1e000000-0000-0000-0000-000000000001', 'owner'),
  ('2e000000-0000-0000-0000-000000000001', '1e000000-0000-0000-0000-000000000002', 'creator');
insert into public.org_settings (org_id) values ('2e000000-0000-0000-0000-000000000001') on conflict (org_id) do nothing;
update public.org_settings set features = '{"saleem_fix": true, "saleem_fix_monthly_limit": 5}' where org_id = '2e000000-0000-0000-0000-000000000001';

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

-- A text advertisement and a video advertisement, both analysed.
set local role authenticated;
select pg_temp.as_user('1e000000-0000-0000-0000-000000000002');
insert into public.promotions (id, owner_id, org_id, title, communication_type) values
  ('4e000000-0000-0000-0000-000000000001', '1e000000-0000-0000-0000-000000000002', '2e000000-0000-0000-0000-000000000001', 'نص', 'general_commercial'),
  ('4e000000-0000-0000-0000-000000000002', '1e000000-0000-0000-0000-000000000002', '2e000000-0000-0000-0000-000000000001', 'فيديو', 'general_commercial');
insert into public.submissions (id, user_id, kind, caption, platform, product_category, promotion_id, sha256, file_path) values
  ('3e000000-0000-0000-0000-000000000001', '1e000000-0000-0000-0000-000000000002', 'text', 'نتيجة مضمونة', 'x', 'beauty', '4e000000-0000-0000-0000-000000000001', 'm1', null),
  ('3e000000-0000-0000-0000-000000000002', '1e000000-0000-0000-0000-000000000002', 'video', 'كريم ندى', 'tiktok', 'beauty', '4e000000-0000-0000-0000-000000000002', 'm2', 'u/x/original.mp4');
reset role;
update public.submissions set status = 'done', analyzed_at = now() where id::text like '3e000000-%';
insert into public.transcripts (submission_id, full_text) values ('3e000000-0000-0000-0000-000000000002', 'بدون أي أعراض جانبية');

set local role authenticated;
select pg_temp.as_user('1e000000-0000-0000-0000-000000000002');
do $$
declare _j uuid; j public.correction_jobs;
begin
  perform pg_temp.expect_error($q$select public.create_correction_job('4e000000-0000-0000-0000-000000000001', 'media_edit', '{}', '{}', null, 'media-key-0001')$q$, 'code:media_unavailable');
  _j := public.create_correction_job('4e000000-0000-0000-0000-000000000002', 'media_edit', '{}', '{}', null, 'media-key-0002');
  select * into j from public.correction_jobs where id = _j;
  if j.status <> 'ready' or j.provider <> 'browser' then raise exception 'media job not ready/browser: % %', j.status, j.provider; end if;
  if j.proposal->>'script' <> 'بدون أي أعراض جانبية' then raise exception 'transcript not proposed'; end if;
  -- Media-only proposal (no text) is accepted.
  perform public.begin_accept_correction(_j, '{"media": {"overlays": ["إعلان مدفوع"]}}');
  -- A fresh «accepting» cannot be claimed twice.
  perform pg_temp.expect_error(format('select public.begin_accept_correction(%L, %L)', _j, '{"media": {}}'), 'code:invalid_status');
end $$;
-- Interrupted upload: after 10 minutes with nothing linked, the uploader can claim it again.
reset role;
update public.correction_jobs set updated_at = now() - interval '11 minutes' where idempotency_key = 'media-key-0002';
set local role authenticated;
select pg_temp.as_user('1e000000-0000-0000-0000-000000000002');
do $$
declare _j uuid := (select id from public.correction_jobs where idempotency_key = 'media-key-0002');
begin
  perform public.begin_accept_correction(_j, '{"media": {"overlays": ["إعلان مدفوع"]}}');
  if (select status from public.correction_jobs where id = _j) <> 'accepting' then raise exception 'not re-claimed'; end if;
end $$;
-- Another member (the owner) cannot claim someone else's job.
select pg_temp.as_user('1e000000-0000-0000-0000-000000000001');
do $$ begin
  perform pg_temp.expect_error(format('select public.begin_accept_correction(%L, %L)', (select id from public.correction_jobs where idempotency_key = 'media-key-0002'), '{"media": {}}'), 'forbidden');
end $$;
reset role;

-- D199: an asynchronous proposal that becomes ready notifies the user who started it.
set local role authenticated;
select pg_temp.as_user('1e000000-0000-0000-0000-000000000002');
select public.create_correction_job('4e000000-0000-0000-0000-000000000001', 'text_correction', '{}', '{}', null, 'media-key-0003');
reset role;
select set_config('request.jwt.claim.sub', '', true);
update public.correction_jobs set status = 'generating' where idempotency_key = 'media-key-0003';
update public.correction_jobs set status = 'ready', proposal = '{"caption": "x"}' where idempotency_key = 'media-key-0003';
do $$ begin
  if not exists (select 1 from public.notifications where user_id = '1e000000-0000-0000-0000-000000000002' and kind = 'correction_ready'
                 and payload->>'promotion_id' = '4e000000-0000-0000-0000-000000000001') then raise exception 'no correction_ready notification'; end if;
end $$;

select pass('p14 SALEEM Fix media');
select * from finish();
rollback;
