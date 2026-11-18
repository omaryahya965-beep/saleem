-- v2 Phase 8: enforce the intended column grants on a real Supabase database.
-- Supabase's default privileges give anon/authenticated ALL on every new public table, so the column-level grants in
-- the v2 migrations restricted nothing: an org admin could set products.status / promotions.review_status directly,
-- and anon/authenticated could SELECT token hashes from api_keys, partner_links and webhook_endpoints (RLS still
-- scoped rows, but the columns were exposed). Found by `supabase test db` (p1_products_settings, p1_promotions).
-- Revoking a table privilege also drops its column grants, so each intended column grant is restated after it.

-- Writes through column grants only.
revoke insert, update on public.promotions from anon, authenticated;
grant insert (id, org_id, owner_id, title, product_id, sector, channels, communication_type, audience, market,
              is_paid, distribution, creator_license_no, caption, reviewer_notes, campaign_id, deadline_at, tags)
  on public.promotions to authenticated;
grant update (title, product_id, channels, communication_type, audience, market, is_paid, distribution,
              creator_license_no, caption, reviewer_notes, campaign_id, deadline_at, tags)
  on public.promotions to authenticated;

revoke insert, update, delete on public.products from anon, authenticated;
grant insert (id, org_id, name_ar, name_en, aliases, sector, product_type, regulator, currency, key_facts, version, supersedes_id)
  on public.products to authenticated;
grant update (name_ar, name_en, aliases, sector, product_type, regulator, currency, key_facts)
  on public.products to authenticated;

revoke insert, update, delete on public.org_settings from anon, authenticated;
grant update (sector, brand_aliases, review_sla_business_days, weekend_days, require_uploader_responses,
              require_reviewer_responses, hide_comments_from_external, features)
  on public.org_settings to authenticated;

revoke update on public.notifications from anon, authenticated;
grant update (read_at) on public.notifications to authenticated;

revoke insert, update on public.saved_views from anon, authenticated;
grant insert (org_id, scope, name, filters, shared) on public.saved_views to authenticated;

-- Secret columns (hashes) are never readable by clients.
revoke all on public.api_keys, public.partner_links, public.webhook_endpoints from anon, authenticated;
grant select (id, org_id, label, allowed_product_ids, allowed_channels, intro_ar, terms_ar, active, created_by, created_at)
  on public.partner_links to authenticated;
grant select (id, org_id, name, key_prefix, scopes, expires_at, revoked_at, last_used_at, created_by, created_at)
  on public.api_keys to authenticated;
grant select (id, org_id, kind, url, events, active, created_by, created_at)
  on public.webhook_endpoints to authenticated;

-- v2 tables written only by RPCs or the service role: read-only for clients.
revoke insert, update, delete on public.calibration_notes, public.org_rule_packs, public.rule_checks,
  public.self_approval_rules, public.submission_assets, public.webhook_deliveries, public.api_rate
  from anon, authenticated;
