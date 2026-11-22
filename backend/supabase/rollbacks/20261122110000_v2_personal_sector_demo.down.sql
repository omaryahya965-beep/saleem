-- Rollback of 20261122110000_v2_personal_sector_demo.sql (D210). Generated from a catalog diff on the isolated stack (master schema + this
-- migration) and verified: master + all pending migrations + every rollback in reverse = master's schema.
-- Run the rollbacks newest first, each in one transaction. Data written into objects this migration added
-- (new tables, new columns) is dropped with them; take the backup first (RELEASE_PLAN.md §1).
begin;
CREATE OR REPLACE FUNCTION public.recommend_authorities(_sector text, _category text, _communication_type text, _channels text[], _is_paid boolean, _ai_used boolean)
 RETURNS text[]
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select array(select distinct a from unnest(array[
    -- Social-media advertising and sponsored creator content (Mawthooq, content rules).
    case when coalesce(cardinality(_channels), 0) > 0 or _communication_type = 'creator_sponsored' or _is_paid then 'GMEDIA' end,
    -- Commercial advertising of goods and services (misleading claims, e-commerce).
    case when coalesce(_communication_type, 'general_commercial') in ('general_commercial', 'creator_sponsored')
           or _sector in ('ecommerce', 'retail') then 'MC' end,
    case when _ai_used then 'SDAIA' end,
    case when _sector in ('cosmetics', 'food_beverage', 'health_supplements') or _category in ('beauty', 'food', 'health') then 'SFDA' end,
    case when _sector in ('banking', 'finance_company', 'payments') or _category = 'finance' or _communication_type = 'financial_promotion' then 'SAMA' end,
    case when _sector = 'capital_market' then 'CMA' end,
    case when _sector = 'insurance' then 'IA' end,
    case when _sector = 'tourism' then 'MT' end,
    case when _category = 'real_estate' then 'REGA' end
  ]) as a where a is not null order by 1)
$function$;
alter table public.promotions drop constraint if exists "promotions_selected_authorities_check";
alter table public.promotions add constraint "promotions_selected_authorities_check" CHECK ((public.valid_authorities(selected_authorities) AND ((selected_authorities IS NULL) OR (org_id IS NULL)))) not valid;
alter table public.promotions drop constraint if exists "promotions_sector_check";
alter table public.promotions add constraint "promotions_sector_check" CHECK (((sector IS NULL) OR (sector = ANY (ARRAY['banking'::text, 'finance_company'::text, 'payments'::text, 'capital_market'::text, 'insurance'::text, 'cosmetics'::text, 'food_beverage'::text, 'health_supplements'::text, 'tourism'::text, 'ecommerce'::text, 'retail'::text, 'other'::text])))) NOT VALID not valid;
drop index if exists public.personal_workspaces_demo_expiry;
alter table public.personal_workspaces drop column if exists "purged_at";
alter table public.personal_workspaces drop column if exists "expires_at";
-- Column grants are not part of the catalog diff: restore the D211 client write access to selected_authorities.
grant insert (selected_authorities), update (selected_authorities) on public.promotions to authenticated;
commit;
