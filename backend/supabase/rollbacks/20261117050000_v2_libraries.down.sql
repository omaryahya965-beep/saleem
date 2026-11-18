-- Rollback of 20261117050000_v2_libraries.sql. Data loss: claims, links, org disclaimers, saved views, overrides.
-- Substantiation files in the `evidence` bucket must be exported first (the bucket is not deleted here).
select cron.unschedule(jobid) from cron.job where jobname = 'saleem-claims-reminders';
drop function if exists public.claims_reminders();
drop function if exists public.archive_rule_override(uuid);
drop function if exists public.set_rule_override(uuid, text, jsonb, text);
drop function if exists public.save_disclaimer(uuid, uuid, text, text, text, text[], text[], text[], text[], boolean, text);
drop function if exists public.claim_extend_scope(uuid, uuid);
drop function if exists public.claim_add_from_finding(uuid, text, text, jsonb, boolean);
drop function if exists public.link_claim(uuid, uuid, boolean);
drop function if exists public.archive_claim(uuid);
drop function if exists public.new_claim_version(uuid);
drop function if exists public.review_claim(uuid, text, uuid[], text);
drop function if exists public.resolve_claim_findings(public.claims);
drop function if exists public.submit_claim(uuid);
drop function if exists public.save_claim(uuid, uuid, text, text, text, uuid[], text[], text[], jsonb, date, date);
drop function if exists public.lib_role(uuid);
drop policy if exists "evidence read" on storage.objects;
drop policy if exists "evidence write" on storage.objects;
delete from public.rules where code in ('SYS-CLAIMS', 'SYS-DISCLAIMERS') and rulebook_version_id = '22222222-2222-2222-2222-222222222222';
drop table if exists public.org_rule_overrides;
drop table if exists public.saved_views;
drop table if exists public.disclaimers;
drop table if exists public.promotion_claims;
drop table if exists public.claims;
drop function if exists public.libraries_normalize();
drop function if exists public.normalize_ar_sql(text);
delete from public.notifications where kind in ('claim_review_due', 'claim_expired');
