-- V2 — Automatic multi-regulator analysis for personal advertisements and per-session individual demos (D213, D215).
--
-- 1. Individuals no longer choose regulatory authorities: every supported authority is considered automatically
--    (analyze enables every pack for personal promotions; drafts are never applied). The D211 column
--    promotions.selected_authorities is kept for compatibility but can no longer be written by clients and must be
--    null, so no authority can be excluded through the API.
-- 2. The advertisement sector vocabulary gains healthcare, real_estate and general (general content).
-- 3. The public individual demo becomes per-session: each demo login gets its own personal workspace that expires
--    (expires_at); expired sessions are purged by the demo-login broker (service role).

-- ---- 1. No authority selection -------------------------------------------------------------------------------------
update public.promotions set selected_authorities = null where selected_authorities is not null;
revoke insert (selected_authorities), update (selected_authorities) on public.promotions from authenticated, anon;
alter table public.promotions drop constraint if exists promotions_selected_authorities_check;
alter table public.promotions add constraint promotions_selected_authorities_check check (selected_authorities is null);

-- ---- 2. Sector vocabulary ------------------------------------------------------------------------------------------
alter table public.promotions drop constraint if exists promotions_sector_check;
alter table public.promotions add constraint promotions_sector_check check (sector is null or sector in (
  'banking', 'finance_company', 'payments', 'capital_market', 'insurance', 'cosmetics', 'food_beverage',
  'health_supplements', 'healthcare', 'tourism', 'ecommerce', 'retail', 'real_estate', 'general', 'other')) not valid;

create or replace function public.recommend_authorities(
  _sector text, _category text, _communication_type text, _channels text[], _is_paid boolean, _ai_used boolean)
returns text[] language sql immutable set search_path = '' as $$
  select array(select distinct a from unnest(array[
    case when coalesce(cardinality(_channels), 0) > 0 or _communication_type = 'creator_sponsored' or _is_paid then 'GMEDIA' end,
    case when coalesce(_communication_type, 'general_commercial') in ('general_commercial', 'creator_sponsored')
           or _sector in ('ecommerce', 'retail') then 'MC' end,
    case when _ai_used then 'SDAIA' end,
    case when _sector in ('cosmetics', 'food_beverage', 'health_supplements', 'healthcare') or _category in ('beauty', 'food', 'health') then 'SFDA' end,
    case when _sector in ('banking', 'finance_company', 'payments') or _category = 'finance' or _communication_type = 'financial_promotion' then 'SAMA' end,
    case when _sector = 'capital_market' then 'CMA' end,
    case when _sector = 'insurance' then 'IA' end,
    case when _sector = 'tourism' then 'MT' end,
    case when _sector = 'real_estate' or _category = 'real_estate' then 'REGA' end
  ]) as a where a is not null order by 1)
$$;
grant execute on function public.recommend_authorities(text, text, text, text[], boolean, boolean) to anon, authenticated, service_role;

-- ---- 3. Per-session individual demo --------------------------------------------------------------------------------
alter table public.personal_workspaces add column if not exists expires_at timestamptz null;
create index if not exists personal_workspaces_demo_expiry on public.personal_workspaces (expires_at) where is_demo;
-- Expired demo sessions are purged without touching the immutable review audit (review_events): their files are
-- deleted, their account is banned (no sign-in, rows unreadable by anyone else under RLS) and purged_at is set.
alter table public.personal_workspaces add column if not exists purged_at timestamptz null;
