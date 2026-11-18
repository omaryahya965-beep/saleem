-- v2 Phase 6.3 (M9): external partners behind org_settings.features.partners (default off).
-- Partner links (token stored as a SHA-256 hash, shown once), a partner page that submits one promotion at a time
-- within the allowed products/channels after accepting the terms, external_uploader members that admins approve,
-- and deny-by-default isolation: external roles never count as "a member" unless a policy names them.
-- The existing brand share link is untouched. external_reviewer is defined but grants nothing yet (D127).

-- ---------------------------------------------------------------------------------------------
-- 0. Isolation: a membership check without a role list excludes external roles.
-- ---------------------------------------------------------------------------------------------
create or replace function public.is_org_member(_org uuid, _roles public.org_role[] default null)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.org_members
    where org_id = _org and user_id = auth.uid()
      and (case when _roles is null then role not in ('external_uploader', 'external_reviewer') else role = any(_roles) end)
  )
$$;

create or replace function public.is_external_member(_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.org_members m where m.org_id = _org and m.user_id = auth.uid()
                 and m.role in ('external_uploader', 'external_reviewer'))
$$;
revoke all on function public.is_external_member(uuid) from public, anon;
grant execute on function public.is_external_member(uuid) to authenticated, service_role;

alter table public.org_members
  add column if not exists access_status text not null default 'active' check (access_status in ('active', 'pending')),
  add column if not exists partner_link_id uuid null,
  add column if not exists terms_accepted_at timestamptz null;

-- ---------------------------------------------------------------------------------------------
-- 1. Partner links
-- ---------------------------------------------------------------------------------------------
create table if not exists public.partner_links (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references public.organizations(id) on delete cascade,
  token_hash          text not null unique,
  label               text not null check (char_length(trim(label)) between 1 and 120),
  allowed_product_ids uuid[] not null default '{}',
  allowed_channels    text[] not null default '{}',
  intro_ar            text null check (char_length(intro_ar) <= 2000),
  terms_ar            text not null check (char_length(trim(terms_ar)) between 1 and 5000),
  active              boolean not null default true,
  created_by          uuid null references auth.users(id) on delete set null,
  created_at          timestamptz not null default now()
);
alter table public.partner_links enable row level security;
drop policy if exists partner_links_admin_read on public.partner_links;
create policy partner_links_admin_read on public.partner_links for select to authenticated
  using (public.is_org_member(org_id, array['owner', 'admin']::public.org_role[]));
-- The hash never leaves the database.
grant select (id, org_id, label, allowed_product_ids, allowed_channels, intro_ar, terms_ar, active, created_by, created_at)
  on public.partner_links to authenticated;

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'check_done', 'check_failed', 'share_review', 'org_invite',
  'review_submitted', 'review_assigned', 'review_decided', 'review_escalated', 'review_legal_response', 'comment_mention',
  'claim_review_due', 'claim_expired', 'review_step_open', 'review_flow_replaced', 'risk_requested', 'risk_decided',
  'partner_access_requested'));

-- External members never read comments when the organisation hides them.
drop policy if exists comments_external_hidden on public.comments;
create policy comments_external_hidden on public.comments as restrictive for select to authenticated
  using (not exists (select 1 from public.promotions p join public.org_settings s on s.org_id = p.org_id
                     where p.id = promotion_id and s.hide_comments_from_external and public.is_external_member(p.org_id)));

create or replace function public.partner_token_hash(_token text)
returns text language sql immutable set search_path = '' as $$
  select encode(extensions.digest(convert_to(coalesce(_token, ''), 'UTF8'), 'sha256'), 'hex')
$$;
revoke all on function public.partner_token_hash(text) from public, anon, authenticated;

/** Creates a link and returns the raw token once. */
create or replace function public.create_partner_link(_org uuid, _label text, _products uuid[], _channels text[], _intro text, _terms text)
returns text language plpgsql security definer set search_path = '' as $$
declare _token text := encode(extensions.gen_random_bytes(24), 'hex'); _id uuid;
begin
  if not public.is_org_member(_org, array['owner', 'admin']::public.org_role[]) then raise exception 'code:forbidden' using errcode = '42501'; end if;
  if not public.org_feature(_org, 'partners') then raise exception 'code:feature_off' using errcode = 'P0001'; end if;
  if coalesce(trim(_terms), '') = '' then raise exception 'code:terms_required' using errcode = 'P0001'; end if;
  if exists (select 1 from unnest(coalesce(_products, '{}')) x where not exists (select 1 from public.products pr where pr.id = x and pr.org_id = _org)) then
    raise exception 'code:invalid_product' using errcode = 'P0001';
  end if;
  insert into public.partner_links (org_id, token_hash, label, allowed_product_ids, allowed_channels, intro_ar, terms_ar, created_by)
  values (_org, public.partner_token_hash(_token), trim(_label), coalesce(_products, '{}'), coalesce(_channels, '{}'), nullif(trim(coalesce(_intro, '')), ''), trim(_terms), auth.uid())
  returning id into _id;
  insert into public.audit_events (actor, action, target_table, target_id, meta)
  values (auth.uid(), 'partner_link.create', 'partner_links', _id::text, jsonb_build_object('org_id', _org, 'label', _label));
  return _token;
end $$;

create or replace function public.set_partner_link_active(_id uuid, _active boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare _org uuid;
begin
  select org_id into _org from public.partner_links where id = _id;
  if _org is null or not public.is_org_member(_org, array['owner', 'admin']::public.org_role[]) then raise exception 'code:forbidden' using errcode = '42501'; end if;
  update public.partner_links set active = coalesce(_active, false) where id = _id;
  insert into public.audit_events (actor, action, target_table, target_id, meta)
  values (auth.uid(), 'partner_link.active', 'partner_links', _id::text, jsonb_build_object('active', coalesce(_active, false)));
end $$;

/** The active link for a token (with the feature on), or null. */
create or replace function public.partner_link_by_token(_token text)
returns public.partner_links language sql stable security definer set search_path = '' as $$
  select l.* from public.partner_links l
  where l.token_hash = public.partner_token_hash(_token) and l.active and public.org_feature(l.org_id, 'partners')
$$;
revoke all on function public.partner_link_by_token(text) from public, anon, authenticated;

/** Public: what the partner page shows (no ids of people, no hash). */
create or replace function public.partner_link_info(_token text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare l public.partner_links; _me public.org_members;
begin
  l := public.partner_link_by_token(_token);
  if l.id is null then return jsonb_build_object('ok', false); end if;
  select * into _me from public.org_members where org_id = l.org_id and user_id = auth.uid();
  return jsonb_build_object('ok', true,
    'org_id', l.org_id,
    'org_name', (select name from public.organizations where id = l.org_id),
    'label', l.label, 'intro_ar', l.intro_ar, 'terms_ar', l.terms_ar, 'channels', to_jsonb(l.allowed_channels),
    'products', coalesce((select jsonb_agg(jsonb_build_object('id', pr.id, 'name_ar', pr.name_ar, 'name_en', pr.name_en) order by pr.name_ar)
                          from public.products pr where pr.id = any(l.allowed_product_ids) and pr.org_id = l.org_id), '[]'::jsonb),
    'membership', case when _me.user_id is null then null else jsonb_build_object('role', _me.role, 'access_status', _me.access_status,
                       'terms_accepted', _me.terms_accepted_at is not null) end);
end $$;

/** Signed-in partner accepts the terms; the first time this creates a pending external_uploader membership. */
create or replace function public.partner_join(_token text, _accept_terms boolean)
returns text language plpgsql security definer set search_path = '' as $$
declare l public.partner_links; _me public.org_members;
begin
  if auth.uid() is null then raise exception 'code:sign_in_required' using errcode = '42501'; end if;
  l := public.partner_link_by_token(_token);
  if l.id is null then raise exception 'code:not_found' using errcode = 'P0001'; end if;
  if not coalesce(_accept_terms, false) then raise exception 'code:terms_required' using errcode = 'P0001'; end if;
  select * into _me from public.org_members where org_id = l.org_id and user_id = auth.uid();
  if _me.user_id is not null and _me.role not in ('external_uploader', 'external_reviewer') then raise exception 'code:internal_member' using errcode = 'P0001'; end if;
  if _me.user_id is null then
    insert into public.org_members (org_id, user_id, role, display_name, email, access_status, partner_link_id, terms_accepted_at)
    select l.org_id, auth.uid(), 'external_uploader', null, (select email from auth.users where id = auth.uid()), 'pending', l.id, now();
    perform public.notify_org(l.org_id, array['owner', 'admin']::public.org_role[], 'partner_access_requested', null,
      jsonb_build_object('link', l.label, 'email', (select email from auth.users where id = auth.uid())));
    return 'pending';
  end if;
  update public.org_members set terms_accepted_at = now() where org_id = l.org_id and user_id = auth.uid();
  return _me.access_status;
end $$;

/** One promotion at a time, inside the link's products and channels. Pending partners get their first one only. */
create or replace function public.partner_create_promotion(_token text, _title text, _product uuid, _channels text[], _communication_type public.communication_type)
returns uuid language plpgsql security definer set search_path = '' as $$
declare l public.partner_links; _me public.org_members; _id uuid;
begin
  l := public.partner_link_by_token(_token);
  if l.id is null then raise exception 'code:not_found' using errcode = 'P0001'; end if;
  select * into _me from public.org_members where org_id = l.org_id and user_id = auth.uid();
  if _me.user_id is null or _me.role <> 'external_uploader' or _me.terms_accepted_at is null then raise exception 'code:terms_required' using errcode = 'P0001'; end if;
  if exists (select 1 from public.promotions p where p.org_id = l.org_id and p.owner_id = auth.uid()
             and p.review_status not in ('approved', 'rejected', 'archived', 'withdrawn', 'risk_accepted')) then
    raise exception 'code:one_at_a_time' using errcode = 'P0001';
  end if;
  if _me.access_status = 'pending' and exists (select 1 from public.promotions p where p.org_id = l.org_id and p.owner_id = auth.uid()) then
    raise exception 'code:access_pending' using errcode = 'P0001';
  end if;
  if coalesce(trim(_title), '') = '' then raise exception 'code:title_required' using errcode = 'P0001'; end if;
  if _product is not null and not (_product = any(l.allowed_product_ids)) then raise exception 'code:product_not_allowed' using errcode = 'P0001'; end if;
  if cardinality(l.allowed_product_ids) > 0 and _product is null then raise exception 'code:product_required' using errcode = 'P0001'; end if;
  if cardinality(coalesce(_channels, '{}')) = 0 then raise exception 'code:channels_required' using errcode = 'P0001'; end if;
  if cardinality(l.allowed_channels) > 0 and not (_channels <@ l.allowed_channels) then raise exception 'code:channel_not_allowed' using errcode = 'P0001'; end if;
  insert into public.promotions (org_id, owner_id, title, product_id, channels, communication_type)
  values (l.org_id, auth.uid(), left(trim(_title), 200), _product, _channels, _communication_type)
  returning id into _id;
  perform public.log_review_event(_id, null, 'partner_created', null, 'draft', jsonb_build_object('link_id', l.id));
  return _id;
end $$;

/** Owners/admins approve a pending partner, or remove them. */
create or replace function public.decide_partner_access(_org uuid, _user uuid, _approve boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_org_member(_org, array['owner', 'admin']::public.org_role[]) then raise exception 'code:forbidden' using errcode = '42501'; end if;
  if not exists (select 1 from public.org_members where org_id = _org and user_id = _user and role in ('external_uploader', 'external_reviewer')) then
    raise exception 'code:not_found' using errcode = 'P0001';
  end if;
  if _approve then
    update public.org_members set access_status = 'active' where org_id = _org and user_id = _user;
  else
    delete from public.org_members where org_id = _org and user_id = _user;
  end if;
  insert into public.audit_events (actor, action, target_table, target_id, meta)
  values (auth.uid(), 'partner_access', 'org_members', _user::text, jsonb_build_object('org_id', _org, 'approve', _approve));
end $$;

revoke all on function public.create_partner_link(uuid, text, uuid[], text[], text, text), public.set_partner_link_active(uuid, boolean),
  public.partner_link_info(text), public.partner_join(text, boolean),
  public.partner_create_promotion(text, text, uuid, text[], public.communication_type), public.decide_partner_access(uuid, uuid, boolean) from public;
grant execute on function public.partner_link_info(text) to anon, authenticated;
grant execute on function public.create_partner_link(uuid, text, uuid[], text[], text, text), public.set_partner_link_active(uuid, boolean),
  public.partner_join(text, boolean), public.partner_create_promotion(text, text, uuid, text[], public.communication_type),
  public.decide_partner_access(uuid, uuid, boolean) to authenticated;
