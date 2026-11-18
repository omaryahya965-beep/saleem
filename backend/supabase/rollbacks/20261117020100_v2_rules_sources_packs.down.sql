-- Rollback of 20261117020100_v2_rules_sources_packs.sql: reactivate v1, remove the v2 release and the v2 columns.
-- Findings keep their rule_code; analysis runs pointing at the v2 release keep rulebook_version (text).
update public.rulebook_versions set is_active = true, status = 'published' where id = '11111111-1111-1111-1111-111111111111';
update public.analysis_runs set rulebook_version_id = null where rulebook_version_id = '22222222-2222-2222-2222-222222222222';
delete from public.rules where rulebook_version_id = '22222222-2222-2222-2222-222222222222';
delete from public.rulebook_versions where id = '22222222-2222-2222-2222-222222222222';
drop function if exists public.set_org_rule_pack(uuid, text, boolean, boolean);
drop function if exists public.set_rule_review_state(uuid, text, text, text, text);
drop function if exists public.v2_publish_rulebook();
alter table public.rules drop constraint if exists rules_active_needs_review;
alter table public.rules
  drop column if exists pack, drop column if exists regulatory_source_id, drop column if exists article_ref,
  drop column if exists additional_citations, drop column if exists official_text_ar, drop column if exists summary_ar,
  drop column if exists summary_en, drop column if exists applicability, drop column if exists content_triggers,
  drop column if exists check_kind, drop column if exists deterministic_check, drop column if exists finding_type_on_fail,
  drop column if exists review_state, drop column if exists legal_reviewed_by, drop column if exists legal_reviewed_at,
  drop column if exists change_reason, drop column if exists supersedes_rule_id;
drop table if exists public.org_rule_packs;
drop table if exists public.rule_packs;
drop table if exists public.regulatory_sources;
-- create_rulebook_draft: re-apply its body from 20261014020000_product_features.sql.
