-- v2 Phase 5 — M8 `v2_libraries`: approved claims (with private substantiation), approved disclaimers, saved views,
-- org rule overrides (narrow scope only), claim review reminders. Matching runs in the analyze function (D119).

-- ---------------------------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------------------------
create table if not exists public.claims (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references public.organizations(id) on delete cascade,
  claim_key           uuid not null default gen_random_uuid(),
  version             integer not null default 1 check (version >= 1),
  supersedes_id       uuid null references public.claims(id) on delete set null,
  name                text not null check (char_length(trim(name)) between 1 and 200),
  text_ar             text not null check (char_length(trim(text_ar)) between 1 and 2000),
  text_en             text null check (char_length(text_en) <= 2000),
  normalized_text     text not null default '',
  numbers             jsonb not null default '[]'::jsonb,
  product_ids         uuid[] not null default '{}',
  channels            text[] not null default '{}',
  communication_types text[] not null default '{}',
  substantiation      jsonb not null default '[]'::jsonb check (jsonb_typeof(substantiation) = 'array'),
  status              text not null default 'draft' check (status in ('draft', 'pending_review', 'approved', 'rejected', 'changes_requested', 'expired', 'archived')),
  next_review_at      date null,
  expires_at          date null,
  reviewed_by         uuid null references auth.users(id) on delete set null,
  reviewed_at         timestamptz null,
  review_reason_ids   uuid[] not null default '{}',
  review_comment      text null,
  source_finding_id   uuid null references public.findings(id) on delete set null,
  created_by          uuid null default auth.uid() references auth.users(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (org_id, claim_key, version)
);
create index if not exists claims_org_status_idx on public.claims (org_id, status);

create table if not exists public.promotion_claims (
  promotion_id uuid not null references public.promotions(id) on delete cascade,
  claim_id     uuid not null references public.claims(id) on delete cascade,
  link_source  text not null check (link_source in ('manual', 'auto', 'finding_fix')),
  linked_by    uuid null references auth.users(id) on delete set null,
  linked_at    timestamptz not null default now(),
  primary key (promotion_id, claim_id)
);

create table if not exists public.disclaimers (
  id                     uuid primary key default gen_random_uuid(),
  org_id                 uuid null references public.organizations(id) on delete cascade,
  disclaimer_key         uuid not null default gen_random_uuid(),
  version                integer not null default 1,
  supersedes_id          uuid null references public.disclaimers(id) on delete set null,
  name                   text not null default '',
  text_ar                text not null check (char_length(trim(text_ar)) between 1 and 2000),
  text_en                text null,
  normalized_text        text not null default '',
  product_types          text[] not null default '{}',
  channels               text[] not null default '{}',
  communication_types    text[] not null default '{}',
  required_by_rule_codes text[] not null default '{}',
  check_prominence       boolean not null default false,
  is_template            boolean not null default false,
  status                 text not null default 'active' check (status in ('draft', 'active', 'archived')),
  created_by             uuid null default auth.uid() references auth.users(id) on delete set null,
  created_at             timestamptz not null default now()
);

create table if not exists public.saved_views (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid null references public.organizations(id) on delete cascade,
  owner_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  scope      text not null check (scope in ('promotions', 'queue', 'claims')),
  name       text not null check (char_length(trim(name)) between 1 and 80),
  filters    jsonb not null check (jsonb_typeof(filters) = 'object'),
  shared     boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.org_rule_overrides (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references public.organizations(id) on delete cascade,
  rule_code           text not null,
  applicability_patch jsonb not null,
  reason              text not null check (char_length(trim(reason)) between 3 and 1000),
  created_by          uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at          timestamptz not null default now(),
  archived_at         timestamptz null
);

-- Normalised text (search/display; the analyze function re-normalises with normalizeArabic).
create or replace function public.normalize_ar_sql(_t text)
returns text language sql immutable set search_path = '' as $$
  select lower(regexp_replace(translate(coalesce(_t, ''), 'أإآٱىؤئ٠١٢٣٤٥٦٧٨٩ًٌٍَُِّْـ', 'اااايوي0123456789'), '\s+', ' ', 'g'))
$$;
create or replace function public.libraries_normalize()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.normalized_text := public.normalize_ar_sql(new.text_ar);
  if tg_table_name = 'claims' then new.updated_at := now(); end if;
  return new;
end $$;
drop trigger if exists claims_normalize on public.claims;
create trigger claims_normalize before insert or update of text_ar on public.claims for each row execute function public.libraries_normalize();
drop trigger if exists disclaimers_normalize on public.disclaimers;
create trigger disclaimers_normalize before insert or update of text_ar on public.disclaimers for each row execute function public.libraries_normalize();

-- Platform templates: proposed wording, NOT official text (legal review required before use).
insert into public.disclaimers (id, org_id, name, text_ar, text_en, product_types, communication_types, required_by_rule_codes, is_template, status)
values
  ('d5000000-0000-0000-0000-000000000001', null, 'صيغة مقترحة — راجعها قانونياً: عبارة الإشراف',
   'خاضع لإشراف ورقابة البنك المركزي السعودي', 'Supervised and regulated by the Saudi Central Bank',
   '{}', '{financial_promotion}', '{SAMA-ADV-03-9}', true, 'active'),
  ('d5000000-0000-0000-0000-000000000002', null, 'صيغة مقترحة — راجعها قانونياً: أثر سعر الصرف',
   'قد يتأثر المبلغ بتغير سعر الصرف', 'The amount may be affected by exchange-rate changes',
   '{}', '{financial_promotion}', '{SAMA-ADV-06}', true, 'active')
on conflict (id) do nothing;

-- System rules for the libraries in the active v2 release (labelled «فحص نظامي في سَليم», never regulation).
insert into public.rules (code, rulebook_version_id, category, pack, title_ar, title_en, summary_ar, summary_en, description_ar, description_en,
  source_name, source_name_en, source_url, check_type, check_kind, finding_type_on_fail, default_severity, llm_instructions, review_state, legal_status)
select v.code, '22222222-2222-2222-2222-222222222222', 'system', 'sa-system', v.tar, v.ten, v.sar, v.sen, v.sar, v.sen,
  'فحص نظامي في سَليم', 'SALEEM system check', 'https://saleem.app', 'text', 'deterministic', v.ft, 'warning', 'Deterministic check (not evaluated by the model).', 'active', 'illustrative_pending_review'
from (values
  ('SYS-CLAIMS', 'ادعاءات غير موجودة في مكتبة الادعاءات المعتمدة', 'Claims not in the approved claims library',
   'يقارن الادعاءات في الإعلان بالادعاءات المعتمدة لدى الجهة.', 'Compares the ad''s claims with the organisation''s approved claims.', 'needs_evidence'),
  ('SYS-DISCLAIMERS', 'إفصاحات معتمدة مطلوبة', 'Required approved disclaimers',
   'يتحقق من وجود الإفصاحات المعتمدة المطلوبة لسياق الإعلان.', 'Checks that the approved disclaimers required by the context are present.', 'missing_required')
) as v(code, tar, ten, sar, sen, ft)
where exists (select 1 from public.rulebook_versions where id = '22222222-2222-2222-2222-222222222222')
on conflict (rulebook_version_id, code) do nothing;

-- Claim reminders and expiry notifications.
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'check_done', 'check_failed', 'share_review', 'org_invite',
  'review_submitted', 'review_assigned', 'review_decided', 'review_escalated', 'review_legal_response', 'comment_mention',
  'claim_review_due', 'claim_expired'));

-- ---------------------------------------------------------------------------------------------
-- 2. RLS (reads); writes through RPCs only
-- ---------------------------------------------------------------------------------------------
alter table public.claims enable row level security;
alter table public.promotion_claims enable row level security;
alter table public.disclaimers enable row level security;
alter table public.saved_views enable row level security;
alter table public.org_rule_overrides enable row level security;
grant select on public.claims, public.promotion_claims, public.disclaimers, public.saved_views, public.org_rule_overrides to authenticated;
grant all on public.claims, public.promotion_claims, public.disclaimers, public.saved_views, public.org_rule_overrides to service_role;
grant insert (org_id, scope, name, filters, shared) on public.saved_views to authenticated;
grant delete on public.saved_views to authenticated;

drop policy if exists claims_read on public.claims;
create policy claims_read on public.claims for select to authenticated using (public.is_org_member(org_id));
drop policy if exists promotion_claims_read on public.promotion_claims;
create policy promotion_claims_read on public.promotion_claims for select to authenticated using (public.can_read_promotion(promotion_id));
drop policy if exists disclaimers_read on public.disclaimers;
create policy disclaimers_read on public.disclaimers for select to authenticated using (org_id is null or public.is_org_member(org_id));
drop policy if exists overrides_read on public.org_rule_overrides;
create policy overrides_read on public.org_rule_overrides for select to authenticated using (public.is_org_member(org_id));
drop policy if exists saved_views_read on public.saved_views;
create policy saved_views_read on public.saved_views for select to authenticated
  using (owner_id = auth.uid() or (shared and org_id is not null and public.is_org_member(org_id)));
drop policy if exists saved_views_insert on public.saved_views;
create policy saved_views_insert on public.saved_views for insert to authenticated
  with check (owner_id = auth.uid() and (org_id is null or public.is_org_member(org_id)));
drop policy if exists saved_views_delete on public.saved_views;
create policy saved_views_delete on public.saved_views for delete to authenticated using (owner_id = auth.uid());

-- Private evidence bucket: {org_id}/claims/{claim_id}/{file}. The media cleanup job never touches it.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('evidence', 'evidence', false, 26214400, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
drop policy if exists "evidence read" on storage.objects;
create policy "evidence read" on storage.objects for select to authenticated
  using (bucket_id = 'evidence' and public.is_org_member(((storage.foldername(name))[1])::uuid));
drop policy if exists "evidence write" on storage.objects;
create policy "evidence write" on storage.objects for insert to authenticated
  with check (bucket_id = 'evidence' and public.is_org_member(((storage.foldername(name))[1])::uuid, array['owner', 'admin', 'reviewer', 'creator']::public.org_role[]));

-- ---------------------------------------------------------------------------------------------
-- 3. RPCs
-- ---------------------------------------------------------------------------------------------
create or replace function public.lib_role(_org uuid) returns public.org_role language sql stable security definer set search_path = '' as $$
  select public.org_role_of(_org, auth.uid())
$$;

/** Create or update a draft claim (creators, reviewers, admins). Approved claims change only through new versions. */
create or replace function public.save_claim(_id uuid, _org uuid, _name text, _text_ar text, _text_en text, _product_ids uuid[],
  _channels text[], _communication_types text[], _substantiation jsonb, _next_review date, _expires date)
returns uuid language plpgsql security definer set search_path = '' as $$
declare c public.claims; _new uuid;
begin
  if public.lib_role(_org) is null or public.lib_role(_org) = 'legal' then raise exception 'code:forbidden' using errcode = '42501'; end if;
  if _id is null then
    insert into public.claims (org_id, name, text_ar, text_en, product_ids, channels, communication_types, substantiation, next_review_at, expires_at)
    values (_org, trim(_name), trim(_text_ar), nullif(trim(coalesce(_text_en, '')), ''), coalesce(_product_ids, '{}'), coalesce(_channels, '{}'),
            coalesce(_communication_types, '{}'), coalesce(_substantiation, '[]'), _next_review, _expires)
    returning id into _new;
    return _new;
  end if;
  select * into c from public.claims where id = _id and org_id = _org for update;
  if c.id is null then raise exception 'code:not_found' using errcode = 'P0001'; end if;
  if c.status not in ('draft', 'changes_requested', 'rejected') then raise exception 'code:claim_locked' using errcode = 'P0001'; end if;
  update public.claims set name = trim(_name), text_ar = trim(_text_ar), text_en = nullif(trim(coalesce(_text_en, '')), ''),
    product_ids = coalesce(_product_ids, '{}'), channels = coalesce(_channels, '{}'), communication_types = coalesce(_communication_types, '{}'),
    substantiation = coalesce(_substantiation, '[]'), next_review_at = _next_review, expires_at = _expires, status = 'draft'
  where id = _id;
  return _id;
end $$;

create or replace function public.submit_claim(_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare c public.claims;
begin
  select * into c from public.claims where id = _id for update;
  if c.id is null or public.lib_role(c.org_id) is null then raise exception 'code:not_found' using errcode = 'P0001'; end if;
  if c.status not in ('draft', 'changes_requested', 'rejected') then raise exception 'code:invalid_status' using errcode = 'P0001'; end if;
  if jsonb_array_length(c.substantiation) = 0 then raise exception 'code:substantiation_required' using errcode = 'P0001'; end if;
  update public.claims set status = 'pending_review' where id = _id;
  perform public.notify_org(c.org_id, array['owner', 'admin', 'reviewer']::public.org_role[], 'review_submitted', null,
    jsonb_build_object('claim_id', _id, 'title', c.name));
end $$;

/** Resolves open SYS-CLAIMS findings that point at this claim (by claim key or identical normalised text). */
create or replace function public.resolve_claim_findings(c public.claims)
returns int language plpgsql security definer set search_path = '' as $$
declare _n int;
begin
  update public.findings f set status = 'resolved'
  where f.rule_code = 'SYS-CLAIMS' and f.status in ('open', 'actioned', 'disputed')
    and exists (select 1 from public.submissions s join public.promotions p on p.id = s.promotion_id where s.id = f.submission_id and p.org_id = c.org_id)
    and (f.citation->>'claim_key' = c.claim_key::text or public.normalize_ar_sql(f.evidence_text) = c.normalized_text or f.id = c.source_finding_id);
  get diagnostics _n = row_count;
  return _n;
end $$;
revoke all on function public.resolve_claim_findings(public.claims) from public, anon, authenticated;

/** Reviewer decision on a claim (owner/admin/reviewer; not the claim's author). */
create or replace function public.review_claim(_id uuid, _decision text, _reason_ids uuid[] default '{}', _comment text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare c public.claims; _role public.org_role;
begin
  select * into c from public.claims where id = _id for update;
  if c.id is null then raise exception 'code:not_found' using errcode = 'P0001'; end if;
  _role := public.lib_role(c.org_id);
  if _role is null or _role not in ('owner', 'admin', 'reviewer') then raise exception 'code:forbidden' using errcode = '42501'; end if;
  if c.created_by = auth.uid() then raise exception 'code:separation_of_duties' using errcode = '42501'; end if;
  if c.status <> 'pending_review' then raise exception 'code:invalid_status' using errcode = 'P0001'; end if;
  if _decision not in ('approve', 'reject', 'request_changes') then raise exception 'code:invalid_decision' using errcode = 'P0001'; end if;
  if _decision <> 'approve' and cardinality(coalesce(_reason_ids, '{}')) = 0 and coalesce(trim(_comment), '') = '' then
    raise exception 'code:reason_required' using errcode = 'P0001';
  end if;
  update public.claims set status = case _decision when 'approve' then 'approved' when 'reject' then 'rejected' else 'changes_requested' end,
    reviewed_by = auth.uid(), reviewed_at = now(), review_reason_ids = coalesce(_reason_ids, '{}'), review_comment = nullif(trim(coalesce(_comment, '')), '')
  where id = _id returning * into c;
  if _decision = 'approve' then
    update public.claims set status = 'archived' where id = c.supersedes_id and status = 'approved';
    perform public.resolve_claim_findings(c);
  end if;
end $$;

/** New version of an approved claim (edit = new row). */
create or replace function public.new_claim_version(_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare c public.claims; _new uuid;
begin
  select * into c from public.claims where id = _id;
  if c.id is null or public.lib_role(c.org_id) is null or public.lib_role(c.org_id) = 'legal' then raise exception 'code:forbidden' using errcode = '42501'; end if;
  if c.status <> 'approved' then raise exception 'code:invalid_status' using errcode = 'P0001'; end if;
  insert into public.claims (org_id, claim_key, version, supersedes_id, name, text_ar, text_en, product_ids, channels, communication_types, substantiation, next_review_at, expires_at)
  values (c.org_id, c.claim_key, (select max(version) + 1 from public.claims where claim_key = c.claim_key), c.id, c.name, c.text_ar, c.text_en,
          c.product_ids, c.channels, c.communication_types, c.substantiation, c.next_review_at, c.expires_at)
  returning id into _new;
  return _new;
end $$;

create or replace function public.archive_claim(_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare c public.claims;
begin
  select * into c from public.claims where id = _id;
  if c.id is null or public.lib_role(c.org_id) not in ('owner', 'admin') then raise exception 'code:forbidden' using errcode = '42501'; end if;
  update public.claims set status = 'archived' where id = _id;
end $$;

create or replace function public.link_claim(_pid uuid, _claim uuid, _link boolean default true)
returns void language plpgsql security definer set search_path = '' as $$
declare p public.promotions; c public.claims;
begin
  select * into p from public.promotions where id = _pid;
  select * into c from public.claims where id = _claim;
  if p.id is null or c.id is null or p.org_id is distinct from c.org_id or not public.can_read_promotion(_pid) then raise exception 'code:not_found' using errcode = 'P0001'; end if;
  if public.lib_role(p.org_id) not in ('owner', 'admin', 'reviewer', 'creator') then raise exception 'code:forbidden' using errcode = '42501'; end if;
  if _link then
    insert into public.promotion_claims (promotion_id, claim_id, link_source, linked_by) values (_pid, _claim, 'manual', auth.uid())
    on conflict (promotion_id, claim_id) do nothing;
  else
    delete from public.promotion_claims where promotion_id = _pid and claim_id = _claim;
  end if;
end $$;

/**
 * Fix from a SYS-CLAIMS finding: creates the claim (prefilled from the finding) and links it to the promotion.
 * Reviewers with review rights may approve in the same call when substantiation is given; creators get a
 * pending claim («أُرسل للاعتماد»).
 */
create or replace function public.claim_add_from_finding(_finding uuid, _name text, _text_ar text, _substantiation jsonb, _approve boolean default false)
returns uuid language plpgsql security definer set search_path = '' as $$
declare f public.findings; p public.promotions; _role public.org_role; _id uuid; c public.claims;
begin
  select * into f from public.findings where id = _finding;
  if f.id is null or f.rule_code <> 'SYS-CLAIMS' or not public.can_read_submission(f.submission_id) then raise exception 'code:not_found' using errcode = 'P0001'; end if;
  select p2.* into p from public.promotions p2 join public.submissions s on s.promotion_id = p2.id where s.id = f.submission_id;
  _role := public.lib_role(p.org_id);
  if _role is null or _role = 'legal' then raise exception 'code:forbidden' using errcode = '42501'; end if;
  if jsonb_array_length(coalesce(_substantiation, '[]')) = 0 then raise exception 'code:substantiation_required' using errcode = 'P0001'; end if;
  insert into public.claims (org_id, name, text_ar, substantiation, status, source_finding_id, product_ids, communication_types)
  values (p.org_id, trim(_name), trim(_text_ar), _substantiation, 'pending_review', _finding,
          case when p.product_id is null then '{}' else array[p.product_id] end, array[p.communication_type::text])
  returning id into _id;
  insert into public.promotion_claims (promotion_id, claim_id, link_source, linked_by) values (p.id, _id, 'finding_fix', auth.uid())
  on conflict do nothing;
  if _approve then
    if _role not in ('owner', 'admin', 'reviewer') then raise exception 'code:forbidden' using errcode = '42501'; end if;
    -- The reviewer adds and approves in one step; the claim records them as reviewer (they did not author the ad).
    update public.claims set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), created_by = null where id = _id returning * into c;
    perform public.resolve_claim_findings(c);
  end if;
  perform public.log_review_event(p.id, f.submission_id, 'claim_fix', null, null, jsonb_build_object('claim_id', _id, 'approved', _approve));
  return _id;
end $$;

/** New version of an approved claim with the promotion's product/channels/communication type added to its scope. */
create or replace function public.claim_extend_scope(_claim uuid, _pid uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare c public.claims; p public.promotions; _new uuid;
begin
  select * into c from public.claims where id = _claim;
  select * into p from public.promotions where id = _pid;
  if c.id is null or p.id is null or c.org_id is distinct from p.org_id then raise exception 'code:not_found' using errcode = 'P0001'; end if;
  _new := public.new_claim_version(_claim);
  update public.claims set
    product_ids = case when cardinality(product_ids) = 0 or p.product_id is null then product_ids else array(select distinct x from unnest(product_ids || p.product_id) x) end,
    channels = case when cardinality(channels) = 0 then channels else array(select distinct x from unnest(channels || p.channels) x) end,
    communication_types = case when cardinality(communication_types) = 0 then communication_types else array(select distinct x from unnest(communication_types || p.communication_type::text) x) end,
    status = 'pending_review'
  where id = _new;
  return _new;
end $$;

create or replace function public.save_disclaimer(_id uuid, _org uuid, _name text, _text_ar text, _text_en text, _product_types text[],
  _channels text[], _communication_types text[], _required_by text[], _prominence boolean, _status text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare _new uuid; d public.disclaimers;
begin
  if public.lib_role(_org) is null or public.lib_role(_org) not in ('owner', 'admin') then raise exception 'code:forbidden' using errcode = '42501'; end if;
  if _status not in ('draft', 'active', 'archived') then raise exception 'code:invalid_status' using errcode = 'P0001'; end if;
  if _id is not null then
    -- Edits create a new version; the previous one is archived (findings keep pointing at the version they used).
    select * into d from public.disclaimers where id = _id and org_id = _org;
    if d.id is null then raise exception 'code:not_found' using errcode = 'P0001'; end if;
    update public.disclaimers set status = 'archived' where id = _id;
  end if;
  insert into public.disclaimers (org_id, disclaimer_key, version, supersedes_id, name, text_ar, text_en, product_types, channels, communication_types,
    required_by_rule_codes, check_prominence, status)
  values (_org, coalesce(d.disclaimer_key, gen_random_uuid()), coalesce(d.version, 0) + 1, d.id, coalesce(trim(_name), ''), trim(_text_ar),
    nullif(trim(coalesce(_text_en, '')), ''), coalesce(_product_types, '{}'), coalesce(_channels, '{}'), coalesce(_communication_types, '{}'),
    coalesce(_required_by, '{}'), coalesce(_prominence, false), _status)
  returning id into _new;
  return _new;
end $$;

/** Org admins narrow a rule's scope (never its logic). Patch keys: exclude_channels, exclude_product_types,
 *  exclude_communication_types, exclude_audiences (lists), disabled (boolean). Audited by review_events-free audit row. */
create or replace function public.set_rule_override(_org uuid, _rule_code text, _patch jsonb, _reason text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare _id uuid; k text;
begin
  if public.lib_role(_org) is null or public.lib_role(_org) not in ('owner', 'admin') then raise exception 'code:forbidden' using errcode = '42501'; end if;
  if coalesce(trim(_reason), '') = '' or char_length(trim(_reason)) < 3 then raise exception 'code:reason_required' using errcode = 'P0001'; end if;
  for k in select jsonb_object_keys(coalesce(_patch, '{}'::jsonb)) loop
    if k not in ('exclude_channels', 'exclude_product_types', 'exclude_communication_types', 'exclude_audiences', 'disabled') then
      raise exception 'code:invalid_override' using errcode = 'P0001';
    end if;
  end loop;
  if _rule_code like 'SYS-%' then raise exception 'code:invalid_override' using errcode = 'P0001'; end if;
  update public.org_rule_overrides set archived_at = now() where org_id = _org and rule_code = _rule_code and archived_at is null;
  insert into public.org_rule_overrides (org_id, rule_code, applicability_patch, reason) values (_org, _rule_code, _patch, trim(_reason)) returning id into _id;
  insert into public.audit_events (actor, action, target_table, target_id, meta)
  values (auth.uid(), 'rule_override', 'org_rule_overrides', _id::text, jsonb_build_object('org_id', _org, 'rule_code', _rule_code, 'patch', _patch, 'reason', _reason));
  return _id;
end $$;

create or replace function public.archive_rule_override(_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare o public.org_rule_overrides;
begin
  select * into o from public.org_rule_overrides where id = _id;
  if o.id is null or public.lib_role(o.org_id) not in ('owner', 'admin') then raise exception 'code:forbidden' using errcode = '42501'; end if;
  update public.org_rule_overrides set archived_at = now() where id = _id;
  insert into public.audit_events (actor, action, target_table, target_id, meta)
  values (auth.uid(), 'rule_override_archived', 'org_rule_overrides', _id::text, jsonb_build_object('org_id', o.org_id, 'rule_code', o.rule_code));
end $$;

/** Daily: reminders 7 days before and on next_review_at; approved claims past expires_at → expired. */
create or replace function public.claims_reminders()
returns int language plpgsql security definer set search_path = '' as $$
declare _n int := 0; c record;
begin
  for c in select * from public.claims where status = 'approved' and next_review_at in (current_date, current_date + 7) loop
    insert into public.notifications (user_id, kind, payload)
    select m.user_id, 'claim_review_due', jsonb_build_object('claim_id', c.id, 'title', c.name, 'due', c.next_review_at)
    from public.org_members m where m.org_id = c.org_id and m.role in ('owner', 'admin');
    _n := _n + 1;
  end loop;
  for c in update public.claims set status = 'expired' where status = 'approved' and expires_at is not null and expires_at < current_date returning * loop
    insert into public.notifications (user_id, kind, payload)
    select m.user_id, 'claim_expired', jsonb_build_object('claim_id', c.id, 'title', c.name)
    from public.org_members m where m.org_id = c.org_id and m.role in ('owner', 'admin');
    _n := _n + 1;
  end loop;
  return _n;
end $$;
revoke all on function public.claims_reminders() from public, anon, authenticated;
select cron.unschedule(jobid) from cron.job where jobname = 'saleem-claims-reminders';
select cron.schedule('saleem-claims-reminders', '0 6 * * *', 'select public.claims_reminders()');

revoke all on function public.save_claim(uuid, uuid, text, text, text, uuid[], text[], text[], jsonb, date, date), public.submit_claim(uuid),
  public.review_claim(uuid, text, uuid[], text), public.new_claim_version(uuid), public.archive_claim(uuid), public.link_claim(uuid, uuid, boolean),
  public.claim_add_from_finding(uuid, text, text, jsonb, boolean), public.claim_extend_scope(uuid, uuid),
  public.save_disclaimer(uuid, uuid, text, text, text, text[], text[], text[], text[], boolean, text),
  public.set_rule_override(uuid, text, jsonb, text), public.archive_rule_override(uuid), public.lib_role(uuid) from public, anon;
grant execute on function public.save_claim(uuid, uuid, text, text, text, uuid[], text[], text[], jsonb, date, date), public.submit_claim(uuid),
  public.review_claim(uuid, text, uuid[], text), public.new_claim_version(uuid), public.archive_claim(uuid), public.link_claim(uuid, uuid, boolean),
  public.claim_add_from_finding(uuid, text, text, jsonb, boolean), public.claim_extend_scope(uuid, uuid),
  public.save_disclaimer(uuid, uuid, text, text, text, text[], text[], text[], text[], boolean, text),
  public.set_rule_override(uuid, text, jsonb, text), public.archive_rule_override(uuid) to authenticated;
