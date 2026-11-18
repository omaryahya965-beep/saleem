-- Phase 7.2/7.3 — API keys hashed, scoped, expiring, revocable, rate limited; webhook/chat endpoints gated by their
-- flags; events queued by triggers; backoff; secrets and hashes not readable. Run: npx supabase test db --workdir backend
begin;
create extension if not exists pgtap with schema extensions;
select plan(1);

insert into auth.users (id, email) values ('1e000000-0000-0000-0000-000000000001', 'ow@api.test'), ('1e000000-0000-0000-0000-000000000005', 'cr@api.test');
update public.profiles set plan_id = (select id from public.plans order by monthly_checks desc limit 1) where id::text like '1e000000-%';
insert into public.organizations (id, name, created_by) values ('2e000000-0000-0000-0000-000000000001', 'API Bank', '1e000000-0000-0000-0000-000000000001');
insert into public.org_members (org_id, user_id, role) values
  ('2e000000-0000-0000-0000-000000000001', '1e000000-0000-0000-0000-000000000001', 'owner'),
  ('2e000000-0000-0000-0000-000000000001', '1e000000-0000-0000-0000-000000000005', 'creator');
insert into public.org_settings (org_id, features) values ('2e000000-0000-0000-0000-000000000001', '{"api": true}')
on conflict (org_id) do update set features = excluded.features;

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
create temp table k (n text primary key, v text);
grant all on k to authenticated;

set local role authenticated;
select pg_temp.as_user('1e000000-0000-0000-0000-000000000005');
do $$ begin
  perform pg_temp.expect_error($q$select public.create_api_key('2e000000-0000-0000-0000-000000000001', 'x', '{findings:read}')$q$, 'code:forbidden');
end $$;
select pg_temp.as_user('1e000000-0000-0000-0000-000000000001');
do $$ begin
  insert into k values ('key', public.create_api_key('2e000000-0000-0000-0000-000000000001', 'CI', '{findings:read,promotions:read}', 30));
  perform pg_temp.expect_error($q$select public.create_api_key('2e000000-0000-0000-0000-000000000001', 'x', '{admin:all}')$q$, 'check');
  perform pg_temp.expect_error($q$select key_hash from public.api_keys$q$, 'permission denied');
  perform pg_temp.expect_error($q$select secret from public.webhook_endpoints$q$, 'permission denied');
  perform pg_temp.expect_error($q$select public.save_webhook_endpoint('2e000000-0000-0000-0000-000000000001', 'slack', 'https://hooks.slack.test/x', '{review.decided}')$q$, 'code:feature_off');
  perform pg_temp.expect_error($q$select public.save_webhook_endpoint('2e000000-0000-0000-0000-000000000001', 'webhook', 'http://insecure.test', '{review.decided}')$q$, 'code:invalid_url');
  perform public.save_webhook_endpoint('2e000000-0000-0000-0000-000000000001', 'webhook', 'https://example.test/hook', '{review.submitted,analysis.completed}');
end $$;
reset role;
select set_config('request.jwt.claim.sub', '', true);

-- Key check (service role path): valid, rate limited, revoked, wrong.
do $$
declare r jsonb;
begin
  r := public.api_key_check((select v from k), 2);
  if not (r->>'ok')::boolean or r->>'org_id' <> '2e000000-0000-0000-0000-000000000001' then raise exception 'key not accepted: %', r; end if;
  perform public.api_key_check((select v from k), 2);
  if (public.api_key_check((select v from k), 2)->>'reason') <> 'rate_limited' then raise exception 'not rate limited'; end if;
  if (public.api_key_check('slm_wrong')->>'ok')::boolean then raise exception 'wrong key accepted'; end if;
  if exists (select 1 from public.api_keys where key_hash = (select v from k)) then raise exception 'raw key stored'; end if;
end $$;
update public.api_keys set revoked_at = now();
do $$ begin
  if (public.api_key_check((select v from k))->>'ok')::boolean then raise exception 'revoked key accepted'; end if;
end $$;

-- Events: a submission finishing and a promotion submitted are queued; review.decided is not subscribed.
insert into public.promotions (id, owner_id, org_id, title, communication_type) values
  ('4e000000-0000-0000-0000-000000000001', '1e000000-0000-0000-0000-000000000005', '2e000000-0000-0000-0000-000000000001', 'W', 'general_commercial');
insert into public.submissions (id, user_id, kind, caption, platform, product_category, promotion_id, sha256) values
  ('3e000000-0000-0000-0000-000000000001', '1e000000-0000-0000-0000-000000000005', 'text', 'w', 'x', 'finance', '4e000000-0000-0000-0000-000000000001', 'w1');
update public.submissions set status = 'done', analyzed_at = now() where id = '3e000000-0000-0000-0000-000000000001';
set local role authenticated;
select pg_temp.as_user('1e000000-0000-0000-0000-000000000005');
select public.submit_promotion('4e000000-0000-0000-0000-000000000001');
reset role;
select set_config('request.jwt.claim.sub', '', true);
do $$ begin
  if (select array_agg(event order by event) from public.webhook_deliveries) <> '{analysis.completed,review.submitted}' then
    raise exception 'events wrong: %', (select array_agg(event) from public.webhook_deliveries);
  end if;
  perform public.webhook_attempt((select min(id) from public.webhook_deliveries), false, 500, 'boom');
  if (select next_attempt_at > now() and status = 'pending' and attempts = 1 from public.webhook_deliveries where id = (select min(id) from public.webhook_deliveries)) is not true then
    raise exception 'backoff wrong';
  end if;
end $$;

select pass('p7 api + webhooks');
select * from finish();
rollback;
