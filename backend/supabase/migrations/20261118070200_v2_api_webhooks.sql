-- v2 Phase 7.2 + 7.3: public API keys and outgoing notifications.
-- API keys (features.api): hashed (SHA-256), scoped, expiring, revocable, rate-limited per key per minute; the raw
-- key is shown once. Webhooks (features.api) and Slack / Teams incoming webhooks (features.notifications_chat):
-- events analysis.completed, review.submitted, review.decided queued by triggers, delivered by the webhooks-deliver
-- function (HMAC-SHA256 signature for webhooks, retries with backoff, delivery log). Secrets never reach the browser.

create table if not exists public.api_keys (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  name         text not null check (char_length(trim(name)) between 1 and 120),
  key_prefix   text not null,
  key_hash     text not null unique,
  scopes       text[] not null check (cardinality(scopes) > 0 and scopes <@ array['promotions:read', 'promotions:write', 'findings:read', 'decisions:read', 'analysis:run']),
  expires_at   timestamptz not null,
  revoked_at   timestamptz null,
  last_used_at timestamptz null,
  created_by   uuid null references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);
create table if not exists public.api_rate (
  key_id       uuid not null references public.api_keys(id) on delete cascade,
  window_start timestamptz not null,
  hits         integer not null default 0,
  primary key (key_id, window_start)
);
create table if not exists public.webhook_endpoints (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  kind        text not null check (kind in ('webhook', 'slack', 'teams')),
  url         text not null check (url ~ '^https://'),
  secret      text not null,
  events      text[] not null check (cardinality(events) > 0 and events <@ array['analysis.completed', 'review.submitted', 'review.decided']),
  active      boolean not null default true,
  created_by  uuid null references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);
create table if not exists public.webhook_deliveries (
  id               bigint generated always as identity primary key,
  endpoint_id      uuid not null references public.webhook_endpoints(id) on delete cascade,
  event            text not null,
  payload          jsonb not null,
  status           text not null default 'pending' check (status in ('pending', 'delivered', 'failed')),
  attempts         integer not null default 0,
  next_attempt_at  timestamptz not null default now(),
  last_status_code integer null,
  last_error       text null,
  created_at       timestamptz not null default now(),
  delivered_at     timestamptz null
);
create index if not exists webhook_deliveries_due_idx on public.webhook_deliveries (next_attempt_at) where status = 'pending';

alter table public.api_keys enable row level security;
alter table public.api_rate enable row level security;
alter table public.webhook_endpoints enable row level security;
alter table public.webhook_deliveries enable row level security;
drop policy if exists api_keys_admin_read on public.api_keys;
create policy api_keys_admin_read on public.api_keys for select to authenticated using (public.is_org_member(org_id, array['owner', 'admin']::public.org_role[]));
drop policy if exists webhook_endpoints_admin_read on public.webhook_endpoints;
create policy webhook_endpoints_admin_read on public.webhook_endpoints for select to authenticated using (public.is_org_member(org_id, array['owner', 'admin']::public.org_role[]));
drop policy if exists webhook_deliveries_admin_read on public.webhook_deliveries;
create policy webhook_deliveries_admin_read on public.webhook_deliveries for select to authenticated
  using (exists (select 1 from public.webhook_endpoints e where e.id = endpoint_id and public.is_org_member(e.org_id, array['owner', 'admin']::public.org_role[])));
-- Hashes and secrets never leave the database through the client API.
grant select (id, org_id, name, key_prefix, scopes, expires_at, revoked_at, last_used_at, created_by, created_at) on public.api_keys to authenticated;
grant select (id, org_id, kind, url, events, active, created_by, created_at) on public.webhook_endpoints to authenticated;
grant select on public.webhook_deliveries to authenticated;
grant all on public.api_keys, public.api_rate, public.webhook_endpoints, public.webhook_deliveries to service_role;

create or replace function public.api_hash(_key text)
returns text language sql immutable set search_path = '' as $$
  select encode(extensions.digest(convert_to(coalesce(_key, ''), 'UTF8'), 'sha256'), 'hex')
$$;
revoke all on function public.api_hash(text) from public, anon, authenticated;

create or replace function public.create_api_key(_org uuid, _name text, _scopes text[], _days integer default 90)
returns text language plpgsql security definer set search_path = '' as $$
declare _key text := 'slm_' || encode(extensions.gen_random_bytes(24), 'hex'); _id uuid;
begin
  if not public.is_org_member(_org, array['owner', 'admin']::public.org_role[]) then raise exception 'code:forbidden' using errcode = '42501'; end if;
  if not public.org_feature(_org, 'api') then raise exception 'code:feature_off' using errcode = 'P0001'; end if;
  if coalesce(_days, 0) not between 1 and 365 then raise exception 'code:invalid_expiry' using errcode = 'P0001'; end if;
  insert into public.api_keys (org_id, name, key_prefix, key_hash, scopes, expires_at, created_by)
  values (_org, trim(_name), left(_key, 10), public.api_hash(_key), _scopes, now() + make_interval(days => _days), auth.uid()) returning id into _id;
  insert into public.audit_events (actor, action, target_table, target_id, meta)
  values (auth.uid(), 'api_key.create', 'api_keys', _id::text, jsonb_build_object('org_id', _org, 'scopes', _scopes, 'days', _days));
  return _key;
end $$;

create or replace function public.revoke_api_key(_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare _org uuid;
begin
  select org_id into _org from public.api_keys where id = _id;
  if _org is null or not public.is_org_member(_org, array['owner', 'admin']::public.org_role[]) then raise exception 'code:forbidden' using errcode = '42501'; end if;
  update public.api_keys set revoked_at = coalesce(revoked_at, now()) where id = _id;
  insert into public.audit_events (actor, action, target_table, target_id, meta) values (auth.uid(), 'api_key.revoke', 'api_keys', _id::text, jsonb_build_object('org_id', _org));
end $$;

/** Service role (api function): validates a key, applies the per-minute limit. {ok, reason, key_id, org_id, scopes}. */
create or replace function public.api_key_check(_key text, _limit integer default 60)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare k public.api_keys; _win timestamptz := date_trunc('minute', now()); _hits integer;
begin
  select * into k from public.api_keys where key_hash = public.api_hash(_key);
  if k.id is null or k.revoked_at is not null or k.expires_at <= now() or not public.org_feature(k.org_id, 'api') then
    return jsonb_build_object('ok', false, 'reason', 'invalid_key');
  end if;
  insert into public.api_rate (key_id, window_start, hits) values (k.id, _win, 1)
  on conflict (key_id, window_start) do update set hits = public.api_rate.hits + 1 returning hits into _hits;
  delete from public.api_rate where key_id = k.id and window_start < _win - interval '10 minutes';
  update public.api_keys set last_used_at = now() where id = k.id;
  if _hits > _limit then return jsonb_build_object('ok', false, 'reason', 'rate_limited'); end if;
  return jsonb_build_object('ok', true, 'key_id', k.id, 'org_id', k.org_id, 'scopes', to_jsonb(k.scopes), 'owner', k.created_by);
end $$;
revoke all on function public.api_key_check(text, integer) from public, anon, authenticated;
grant execute on function public.api_key_check(text, integer) to service_role;

create or replace function public.save_webhook_endpoint(_org uuid, _kind text, _url text, _events text[])
returns uuid language plpgsql security definer set search_path = '' as $$
declare _id uuid;
begin
  if not public.is_org_member(_org, array['owner', 'admin']::public.org_role[]) then raise exception 'code:forbidden' using errcode = '42501'; end if;
  if (_kind = 'webhook' and not public.org_feature(_org, 'api')) or (_kind in ('slack', 'teams') and not public.org_feature(_org, 'notifications_chat')) then
    raise exception 'code:feature_off' using errcode = 'P0001';
  end if;
  if coalesce(_url, '') !~ '^https://[^\s]+$' then raise exception 'code:invalid_url' using errcode = 'P0001'; end if;
  insert into public.webhook_endpoints (org_id, kind, url, secret, events, created_by)
  values (_org, _kind, _url, encode(extensions.gen_random_bytes(24), 'hex'), _events, auth.uid()) returning id into _id;
  insert into public.audit_events (actor, action, target_table, target_id, meta) values (auth.uid(), 'webhook.create', 'webhook_endpoints', _id::text, jsonb_build_object('org_id', _org, 'kind', _kind, 'events', _events));
  return _id;
end $$;

/** The signing secret of a webhook, shown to owners/admins on demand (for verifying signatures). */
create or replace function public.webhook_secret(_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare e public.webhook_endpoints;
begin
  select * into e from public.webhook_endpoints where id = _id;
  if e.id is null or not public.is_org_member(e.org_id, array['owner', 'admin']::public.org_role[]) or e.kind <> 'webhook' then raise exception 'code:forbidden' using errcode = '42501'; end if;
  return e.secret;
end $$;

create or replace function public.set_webhook_active(_id uuid, _active boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare _org uuid;
begin
  select org_id into _org from public.webhook_endpoints where id = _id;
  if _org is null or not public.is_org_member(_org, array['owner', 'admin']::public.org_role[]) then raise exception 'code:forbidden' using errcode = '42501'; end if;
  update public.webhook_endpoints set active = coalesce(_active, false) where id = _id;
end $$;

/** Queues one event for the org's active endpoints whose kind is enabled by its flag. */
create or replace function public.enqueue_webhook(_org uuid, _event text, _payload jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.webhook_deliveries (endpoint_id, event, payload)
  select e.id, _event, jsonb_build_object('event', _event, 'org_id', _org, 'occurred_at', now(), 'data', _payload)
  from public.webhook_endpoints e
  where e.org_id = _org and e.active and _event = any(e.events)
    and ((e.kind = 'webhook' and public.org_feature(_org, 'api')) or (e.kind in ('slack', 'teams') and public.org_feature(_org, 'notifications_chat')))
$$;
revoke all on function public.enqueue_webhook(uuid, text, jsonb) from public, anon, authenticated;

create or replace function public.review_events_webhooks()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.org_id is null or new.event_type not in ('submitted', 'decided') then return new; end if;
  perform public.enqueue_webhook(new.org_id, case new.event_type when 'submitted' then 'review.submitted' else 'review.decided' end,
    jsonb_build_object('promotion_id', new.promotion_id, 'version_id', new.submission_id, 'status', new.to_status,
      'decision', new.payload->>'decision', 'title', (select title from public.promotions where id = new.promotion_id)));
  return new;
end $$;
drop trigger if exists review_events_webhooks on public.review_events;
create trigger review_events_webhooks after insert on public.review_events for each row execute function public.review_events_webhooks();

create or replace function public.submissions_webhooks()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.org_id is null or new.status is not distinct from old.status or new.status not in ('done', 'failed') then return new; end if;
  perform public.enqueue_webhook(new.org_id, 'analysis.completed',
    jsonb_build_object('promotion_id', new.promotion_id, 'version_id', new.id, 'status', new.status, 'overall_status', new.overall_status));
  return new;
end $$;
drop trigger if exists submissions_webhooks on public.submissions;
create trigger submissions_webhooks after update of status on public.submissions for each row execute function public.submissions_webhooks();

/** Service role (deliverer): records a delivery attempt; backoff 1, 5, 30, 120, 720 minutes, then failed. */
create or replace function public.webhook_attempt(_id bigint, _ok boolean, _code integer, _error text)
returns void language sql security definer set search_path = '' as $$
  update public.webhook_deliveries set
    attempts = attempts + 1,
    status = case when _ok then 'delivered' when attempts + 1 >= 6 then 'failed' else 'pending' end,
    delivered_at = case when _ok then now() else null end,
    last_status_code = _code, last_error = left(_error, 500),
    next_attempt_at = now() + make_interval(mins => (array[1, 5, 30, 120, 720, 720])[least(attempts + 1, 6)])
  where id = _id
$$;
revoke all on function public.webhook_attempt(bigint, boolean, integer, text) from public, anon, authenticated;
grant execute on function public.webhook_attempt(bigint, boolean, integer, text) to service_role;

create or replace function public.invoke_webhooks_deliver()
returns void language plpgsql security definer set search_path = '' as $$
declare
  _url text := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url' limit 1);
  _secret text := (select decrypted_secret from vault.decrypted_secrets where name = 'cleanup_cron_secret' limit 1);
begin
  if not exists (select 1 from public.webhook_deliveries where status = 'pending' and next_attempt_at <= now()) then return; end if;
  if _url is null or _secret is null then raise notice 'saleem-webhooks skipped: vault secret project_url or cleanup_cron_secret is missing'; return; end if;
  perform net.http_post(url := rtrim(_url, '/') || '/functions/v1/webhooks-deliver',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', _secret), body := '{}'::jsonb, timeout_milliseconds := 60000);
end $$;
revoke all on function public.invoke_webhooks_deliver() from public, anon, authenticated;
grant execute on function public.invoke_webhooks_deliver() to service_role;

revoke all on function public.create_api_key(uuid, text, text[], integer), public.revoke_api_key(uuid), public.save_webhook_endpoint(uuid, text, text, text[]),
  public.webhook_secret(uuid), public.set_webhook_active(uuid, boolean) from public, anon;
grant execute on function public.create_api_key(uuid, text, text[], integer), public.revoke_api_key(uuid), public.save_webhook_endpoint(uuid, text, text, text[]),
  public.webhook_secret(uuid), public.set_webhook_active(uuid, boolean) to authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'saleem-webhooks';
select cron.schedule('saleem-webhooks', '* * * * *', 'select public.invoke_webhooks_deliver()');
