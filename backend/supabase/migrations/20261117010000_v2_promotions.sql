-- v2 Phase 1 — M1 `v2_promotions`.
-- A promotion (إعلان) is a container of immutable versions. A version is an existing `submissions` row
-- with `promotion_id` + `version_no`. Additive only: no existing column, table or policy is removed.
-- Every existing re-check chain (parent_id) becomes one promotion; legacy promotions stay `draft`.

-- ---------------------------------------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------------------------------------
do $$ begin
  create type public.promotion_review_status as enum (
    'draft', 'pending_review', 'in_review', 'changes_requested', 'conditionally_approved',
    'approved', 'rejected', 'escalated', 'withdrawn', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.communication_type as enum (
    'financial_promotion', 'general_commercial', 'creator_sponsored', 'internal');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------------------------
-- 2. Table
-- ---------------------------------------------------------------------------------------------
create table if not exists public.promotions (
  id                   uuid primary key default gen_random_uuid(),
  -- set null like submissions.org_id: deleting an org keeps its promotions as personal ones.
  org_id               uuid null references public.organizations(id) on delete set null,
  -- Nullable like submissions.user_id: demo promotions have no owner.
  owner_id             uuid null references auth.users(id) on delete set null,
  title                text not null check (char_length(title) between 1 and 200),
  product_id           uuid null,                       -- FK added in M2
  sector               text null,
  channels             text[] not null default '{}',
  communication_type   public.communication_type not null default 'creator_sponsored',
  audience             text[] not null default '{general}',
  market               text not null default 'SA',
  is_paid              boolean null,
  distribution         text null check (distribution in ('owned', 'paid_media', 'influencer')),
  creator_license_no   text null check (char_length(creator_license_no) <= 60),
  caption              text null check (char_length(caption) <= 5000),
  reviewer_notes       text null check (char_length(reviewer_notes) <= 5000),
  campaign_id          uuid null references public.campaigns(id) on delete set null,
  deadline_at          timestamptz null,
  review_status        public.promotion_review_status not null default 'draft',
  current_version_id   uuid null,
  assigned_reviewer_id uuid null references auth.users(id) on delete set null,
  submitted_at         timestamptz null,
  first_decision_at    timestamptz null,
  approved_at          timestamptz null,
  approved_version_id  uuid null,
  tags                 text[] not null default '{}',
  is_demo              boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

alter table public.submissions
  add column if not exists promotion_id uuid null references public.promotions(id) on delete restrict,
  add column if not exists version_no integer null check (version_no >= 1);
create unique index if not exists submissions_promotion_version_uq
  on public.submissions (promotion_id, version_no) where promotion_id is not null;
create index if not exists submissions_promotion_idx on public.submissions (promotion_id);

do $$ begin
  alter table public.promotions
    add constraint promotions_current_version_fk foreign key (current_version_id) references public.submissions(id) on delete set null;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.promotions
    add constraint promotions_approved_version_fk foreign key (approved_version_id) references public.submissions(id) on delete set null;
exception when duplicate_object then null; end $$;

create index if not exists promotions_org_status_idx on public.promotions (org_id, review_status);
create index if not exists promotions_owner_idx on public.promotions (owner_id);
create index if not exists promotions_reviewer_idx on public.promotions (assigned_reviewer_id, review_status);
create index if not exists promotions_deadline_idx on public.promotions (deadline_at) where deadline_at is not null;

-- ---------------------------------------------------------------------------------------------
-- 3. Backfill — every re-check chain of the same owner becomes one promotion (idempotent: only rows
--    without promotion_id are touched). A child whose parent belongs to another owner (or demo ↔ real)
--    starts its own promotion. Returns the number of promotions created. Service role only.
-- ---------------------------------------------------------------------------------------------
create or replace function public.v2_backfill_promotions()
returns int language plpgsql security definer set search_path = '' as $$
declare _n int;
begin
  create temporary table _v2_chain as
  with recursive chain as (
    select s.id as submission_id, s.id as root_id, s.user_id, s.is_demo
    from public.submissions s
    where s.promotion_id is null
      and (s.parent_id is null or not exists (
        select 1 from public.submissions p
        where p.id = s.parent_id and p.promotion_id is null
          and p.user_id is not distinct from s.user_id and p.is_demo = s.is_demo))
    union all
    select c.id, ch.root_id, c.user_id, c.is_demo
    from public.submissions c
    join chain ch on c.parent_id = ch.submission_id
    where c.promotion_id is null and c.user_id is not distinct from ch.user_id and c.is_demo = ch.is_demo
  )
  select c.submission_id, c.root_id,
         row_number() over (partition by c.root_id order by s.created_at, s.id) as version_no
  from chain c join public.submissions s on s.id = c.submission_id;

  create temporary table _v2_roots as
  select root_id, gen_random_uuid() as promotion_id from (select distinct root_id from _v2_chain) r;

  insert into public.promotions (id, org_id, owner_id, title, campaign_id, channels, is_paid, caption,
                                 communication_type, is_demo, created_at, updated_at)
  select r.promotion_id, s.org_id, s.user_id,
         left(coalesce(nullif(trim(s.title), ''), 'إعلان ' || to_char(s.created_at, 'YYYY-MM-DD')), 200),
         s.campaign_id, array[s.platform::text], s.is_paid_ad, nullif(s.caption, ''),
         'creator_sponsored', s.is_demo, s.created_at, s.created_at
  from _v2_roots r join public.submissions s on s.id = r.root_id;
  get diagnostics _n = row_count;

  update public.submissions s
     set promotion_id = r.promotion_id, version_no = c.version_no
    from _v2_chain c join _v2_roots r on r.root_id = c.root_id
   where s.id = c.submission_id;

  update public.promotions p
     set current_version_id = x.id
    from (select distinct on (promotion_id) promotion_id, id
            from public.submissions where promotion_id is not null
           order by promotion_id, version_no desc) x
   where p.id = x.promotion_id and p.id in (select promotion_id from _v2_roots);

  drop table _v2_chain;
  drop table _v2_roots;
  return _n;
end $$;
revoke all on function public.v2_backfill_promotions() from public, anon, authenticated;
grant execute on function public.v2_backfill_promotions() to service_role;

select public.v2_backfill_promotions();
-- ---------------------------------------------------------------------------------------------
-- 4. Read helper (mirrors can_read_submission: demo, owner, org owner/admin/reviewer)
-- ---------------------------------------------------------------------------------------------
create or replace function public.can_read_promotion(_pid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.promotions p
    where p.id = _pid
      and (p.is_demo
           or p.owner_id = auth.uid()
           or (p.org_id is not null
               and public.is_org_member(p.org_id, array['owner', 'admin', 'reviewer']::public.org_role[])))
  )
$$;
revoke all on function public.can_read_promotion(uuid) from public;
grant execute on function public.can_read_promotion(uuid) to anon, authenticated, service_role;

/** Draft-like states in which the context may be edited and versions added. */
create or replace function public.promotion_is_open(_status public.promotion_review_status)
returns boolean language sql immutable set search_path = '' as $$
  select _status in ('draft', 'changes_requested', 'rejected', 'conditionally_approved')
$$;

-- ---------------------------------------------------------------------------------------------
-- 5. Attach trigger: every new submission becomes a numbered version of a promotion.
--    Fires after `submissions_initial_state` (same timing, alphabetical order).
-- ---------------------------------------------------------------------------------------------
create or replace function public.submissions_v2_attach_promotion()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  _pid uuid := new.promotion_id;
  _explicit boolean := new.promotion_id is not null;
  _p public.promotions;
  _next int;
  _prev uuid;
  _client boolean := coalesce(auth.role(), '') = 'authenticated';
begin
  if _pid is null and new.parent_id is not null then
    select s.promotion_id into _pid from public.submissions s
    where s.id = new.parent_id and s.user_id is not distinct from new.user_id and s.is_demo = new.is_demo;
  end if;

  if _pid is not null then
    select * into _p from public.promotions where id = _pid for update;   -- serialises version numbers
    if _p.id is null then raise exception 'code:promotion_not_found' using errcode = 'P0001'; end if;
    if _client and not (
      _p.owner_id = auth.uid()
      or (_p.org_id is not null and public.is_org_member(_p.org_id, array['owner', 'admin', 'creator']::public.org_role[]))
    ) then
      if _explicit then raise exception 'code:promotion_forbidden' using errcode = '42501'; end if;
      _pid := null;   -- legacy re-check of something the caller cannot extend: start a new promotion
    elsif not public.promotion_is_open(_p.review_status) then
      raise exception 'code:promotion_locked' using errcode = 'P0001';
    end if;
  end if;

  if _pid is null then
    insert into public.promotions (owner_id, org_id, campaign_id, title, channels, is_paid, caption, is_demo)
    values (new.user_id, new.org_id, new.campaign_id,
            left(coalesce(nullif(trim(new.title), ''), 'إعلان جديد'), 200),
            array[new.platform::text], new.is_paid_ad, nullif(new.caption, ''), coalesce(new.is_demo, false))
    returning * into _p;
    _pid := _p.id;
  else
    -- A version always belongs to its promotion's workspace (org reviewers must be able to read it).
    new.org_id := _p.org_id;
    new.campaign_id := coalesce(new.campaign_id, _p.campaign_id);
  end if;

  select coalesce(max(version_no), 0) + 1 into _next from public.submissions where promotion_id = _pid;
  if new.parent_id is null and _next > 1 then
    select id into _prev from public.submissions where promotion_id = _pid and version_no = _next - 1;
    new.parent_id := _prev;   -- keeps the existing re-check comparison («ما أُصلح وما بقي») working
  end if;
  new.promotion_id := _pid;
  new.version_no := _next;
  return new;
end $$;

drop trigger if exists submissions_v2_attach_promotion on public.submissions;
create trigger submissions_v2_attach_promotion before insert on public.submissions
  for each row execute function public.submissions_v2_attach_promotion();

create or replace function public.submissions_v2_set_current()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.promotions set current_version_id = new.id, updated_at = now() where id = new.promotion_id;
  return new;
end $$;

drop trigger if exists submissions_v2_set_current on public.submissions;
create trigger submissions_v2_set_current after insert on public.submissions
  for each row execute function public.submissions_v2_set_current();

-- Versions are immutable containers: the client may never move a version between promotions.
revoke update (promotion_id, version_no) on public.submissions from authenticated;

create or replace function public.promotions_touch()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists promotions_touch on public.promotions;
create trigger promotions_touch before update on public.promotions
  for each row execute function public.promotions_touch();

-- ---------------------------------------------------------------------------------------------
-- 6. RLS and column privileges (review fields are written only by security definer RPCs)
-- ---------------------------------------------------------------------------------------------
alter table public.promotions enable row level security;

grant select on public.promotions to anon, authenticated;
grant all on public.promotions to service_role;
grant insert (id, org_id, owner_id, title, product_id, sector, channels, communication_type, audience, market,
              is_paid, distribution, creator_license_no, caption, reviewer_notes, campaign_id, deadline_at, tags)
  on public.promotions to authenticated;
grant update (title, product_id, channels, communication_type, audience, market, is_paid, distribution,
              creator_license_no, caption, reviewer_notes, campaign_id, deadline_at, tags)
  on public.promotions to authenticated;
grant delete on public.promotions to authenticated;

drop policy if exists promotions_select_demo on public.promotions;
create policy promotions_select_demo on public.promotions for select to anon using (is_demo);

drop policy if exists promotions_select on public.promotions;
create policy promotions_select on public.promotions for select to authenticated
  using (public.can_read_promotion(id));

drop policy if exists promotions_insert on public.promotions;
create policy promotions_insert on public.promotions for insert to authenticated
  with check (
    owner_id = auth.uid()
    and (org_id is null or public.is_org_member(org_id, array['owner', 'admin', 'creator']::public.org_role[]))
    and (campaign_id is null or exists (
      select 1 from public.campaigns c where c.id = campaign_id and c.org_id is not distinct from promotions.org_id))
  );

drop policy if exists promotions_update_context on public.promotions;
create policy promotions_update_context on public.promotions for update to authenticated
  using (
    (owner_id = auth.uid()
     or (org_id is not null and public.is_org_member(org_id, array['owner', 'admin']::public.org_role[])))
    and public.promotion_is_open(review_status)
  )
  with check (
    campaign_id is null or exists (
      select 1 from public.campaigns c where c.id = campaign_id and c.org_id is not distinct from promotions.org_id)
  );

-- Only an empty draft (e.g. the upload of its first version failed) may be deleted by its owner.
drop policy if exists promotions_delete_empty on public.promotions;
create policy promotions_delete_empty on public.promotions for delete to authenticated
  using (
    owner_id = auth.uid() and review_status = 'draft'
    and not exists (select 1 from public.submissions s where s.promotion_id = promotions.id)
  );
