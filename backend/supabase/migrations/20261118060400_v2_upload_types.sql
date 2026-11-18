-- v2 Phase 6.4 (M9): upload types behind org_settings.features.upload_types (default off).
-- Variations: linked promotions that share the context (product, channels, type, audience, market, distribution)
-- and are decided separately, with a bulk submit. Batch uploads already create one promotion per item (the
-- attach trigger), so batch needs no change. Carousel (several assets analysed as one version) is not built in
-- this run (D128): the columns exist so it can be added without another schema change.

alter table public.promotions
  add column if not exists upload_type        text not null default 'single' check (upload_type in ('single', 'carousel', 'variations', 'batch')),
  add column if not exists variation_group_id uuid null;
create index if not exists promotions_variation_group_idx on public.promotions (variation_group_id) where variation_group_id is not null;

create table if not exists public.submission_assets (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  position      integer not null,
  kind          text not null,
  file_path     text not null,
  sha256        text not null,
  width         integer null,
  height        integer null,
  duration_s    numeric null,
  page_count    integer null,
  unique (submission_id, position)
);
alter table public.submission_assets enable row level security;
drop policy if exists submission_assets_read on public.submission_assets;
create policy submission_assets_read on public.submission_assets for select to authenticated using (public.can_read_submission(submission_id));
grant select on public.submission_assets to authenticated;
alter table public.frames add column if not exists asset_id uuid null references public.submission_assets(id) on delete set null;

/** Creates a variation of a promotion: same context, new title, same group; decided on its own. */
create or replace function public.create_variation(_pid uuid, _title text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare p public.promotions; _group uuid; _id uuid;
begin
  select * into p from public.promotions where id = _pid for update;
  if p.id is null or p.org_id is null then raise exception 'code:not_found' using errcode = 'P0001'; end if;
  if not public.org_feature(p.org_id, 'upload_types') then raise exception 'code:feature_off' using errcode = 'P0001'; end if;
  if not (p.owner_id = auth.uid() or public.is_org_member(p.org_id, array['owner', 'admin', 'creator']::public.org_role[])) then
    raise exception 'code:forbidden' using errcode = '42501';
  end if;
  if p.is_demo then raise exception 'code:forbidden' using errcode = '42501'; end if;
  if coalesce(trim(_title), '') = '' then raise exception 'code:title_required' using errcode = 'P0001'; end if;
  _group := coalesce(p.variation_group_id, gen_random_uuid());
  if p.variation_group_id is null then
    update public.promotions set variation_group_id = _group, upload_type = 'variations', updated_at = now() where id = _pid;
  end if;
  if (select count(*) from public.promotions where variation_group_id = _group) >= 20 then raise exception 'code:too_many_variations' using errcode = 'P0001'; end if;
  insert into public.promotions (org_id, owner_id, title, product_id, sector, channels, communication_type, audience, market, is_paid,
    distribution, campaign_id, deadline_at, tags, upload_type, variation_group_id)
  values (p.org_id, auth.uid(), left(trim(_title), 200), p.product_id, p.sector, p.channels, p.communication_type, p.audience, p.market, p.is_paid,
    p.distribution, p.campaign_id, p.deadline_at, p.tags, 'variations', _group)
  returning id into _id;
  perform public.log_review_event(_id, null, 'variation_created', null, 'draft', jsonb_build_object('source', _pid, 'group', _group));
  return _id;
end $$;

/** Submits every variation in the group the caller may submit; returns what was submitted and why others were skipped. */
create or replace function public.submit_variations(_group uuid, _note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r record; _check jsonb; _done uuid[] := '{}'; _skipped jsonb := '[]'::jsonb;
begin
  if _group is null then raise exception 'code:not_found' using errcode = 'P0001'; end if;
  for r in select id, org_id from public.promotions where variation_group_id = _group order by created_at loop
    if not public.org_feature(r.org_id, 'upload_types') then raise exception 'code:feature_off' using errcode = 'P0001'; end if;
    _check := public.can_submit(r.id, _note, false);
    if (_check->>'ok')::boolean then
      perform public.submit_promotion(r.id, _note, false);
      _done := array_append(_done, r.id);
    else
      _skipped := _skipped || jsonb_build_array(jsonb_build_object('id', r.id, 'reason', _check->'reasons'->>0));
    end if;
  end loop;
  return jsonb_build_object('submitted', to_jsonb(_done), 'skipped', _skipped);
end $$;

revoke all on function public.create_variation(uuid, text), public.submit_variations(uuid, text) from public, anon;
grant execute on function public.create_variation(uuid, text), public.submit_variations(uuid, text) to authenticated;
