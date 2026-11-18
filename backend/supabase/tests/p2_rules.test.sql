-- Phase 2 — M3: release content, drafts never active, activation guard, pack settings permissions.
-- Run: npx supabase test db --workdir backend
begin;
create extension if not exists pgtap with schema extensions;
select plan(1);

do $$
declare _v2 uuid := '22222222-2222-2222-2222-222222222222';
begin
  if (select id from public.rulebook_versions where is_active) <> _v2 then raise exception 'v2 release not active'; end if;
  if (select count(*) from public.rules where rulebook_version_id = _v2) <> 51 then raise exception 'unexpected rule count'; end if;
  -- Every SAMA/CMA rule is a draft, unverified, without official text.
  if exists (select 1 from public.rules where (code like 'SAMA-%' or code like 'CMA-%')
             and (review_state <> 'draft' or source_verified or official_text_ar is not null)) then
    raise exception 'a regulatory rule is not a plain draft'; end if;
  -- Existing creator rules unchanged (codes, instructions, severities) and still active.
  if exists (
    select 1 from public.rules a join public.rules b on b.code = a.code and b.rulebook_version_id = _v2
    where a.rulebook_version_id = '11111111-1111-1111-1111-111111111111'
      and (a.llm_instructions <> b.llm_instructions or a.default_severity <> b.default_severity or b.review_state <> 'active')) then
    raise exception 'existing rule changed'; end if;
  if (select pack from public.rules where rulebook_version_id = _v2 and code = 'AI-01') <> 'sa-sdaia-ai' then raise exception 'AI-01 pack'; end if;
  if public.v2_publish_rulebook() <> 51 then raise exception 'publish not idempotent'; end if;
  -- Additional citation for finance companies.
  if (select additional_citations->0->>'source_id' from public.rules where rulebook_version_id = _v2 and code = 'SAMA-ADV-03-8') <> 'sama-fc-impl-art86' then
    raise exception 'additional citation missing'; end if;
end $$;

insert into auth.users (id, email) values
  ('12000000-0000-0000-0000-000000000001', 'platform-admin@test.local'),
  ('12000000-0000-0000-0000-000000000002', 'org-owner@test.local'),
  ('12000000-0000-0000-0000-000000000003', 'org-creator@test.local');
insert into public.user_roles (user_id, role) values ('12000000-0000-0000-0000-000000000001', 'admin');
insert into public.organizations (id, name, created_by) values ('22000000-0000-0000-0000-000000000001', 'Bank Test', '12000000-0000-0000-0000-000000000002');
insert into public.org_members (org_id, user_id, role) values
  ('22000000-0000-0000-0000-000000000001', '12000000-0000-0000-0000-000000000002', 'owner'),
  ('22000000-0000-0000-0000-000000000001', '12000000-0000-0000-0000-000000000003', 'creator');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);

-- Org owner opts in to draft rules; creator cannot; the system pack cannot be disabled.
select set_config('request.jwt.claim.sub', '12000000-0000-0000-0000-000000000002', true);
select public.set_org_rule_pack('22000000-0000-0000-0000-000000000001', 'sa-sama-advertising', true, true);
do $$ begin
  if not (select include_draft_rules from public.org_rule_packs where org_id = '22000000-0000-0000-0000-000000000001' and pack_code = 'sa-sama-advertising') then
    raise exception 'opt-in not stored'; end if;
  begin
    perform public.set_org_rule_pack('22000000-0000-0000-0000-000000000001', 'sa-system', false, false);
    raise exception 'system pack disabled';
  exception when others then if sqlerrm not like '%code:pack_always_enabled%' then raise; end if; end;
  begin
    perform public.set_rule_review_state((select id from public.rules where code = 'SAMA-ADV-02' and rulebook_version_id = '22222222-2222-2222-2222-222222222222'), 'active', 'x', 'نص', 'x');
    raise exception 'org owner changed a rule state';
  exception when others then if sqlerrm not like '%code:forbidden%' then raise; end if; end;
end $$;
select set_config('request.jwt.claim.sub', '12000000-0000-0000-0000-000000000003', true);
do $$ begin
  begin
    perform public.set_org_rule_pack('22000000-0000-0000-0000-000000000001', 'sa-sama-advertising', true, false);
    raise exception 'creator changed pack settings';
  exception when others then if sqlerrm not like '%code:forbidden%' then raise; end if; end;
end $$;

-- Platform admin: activation needs official text and a named reviewer; legal_review is allowed.
select set_config('request.jwt.claim.sub', '12000000-0000-0000-0000-000000000001', true);
do $$
declare _r uuid := (select id from public.rules where code = 'SAMA-ADV-02' and rulebook_version_id = '22222222-2222-2222-2222-222222222222');
begin
  begin
    perform public.set_rule_review_state(_r, 'active', 'review done', null, null);
    raise exception 'activated without official text';
  exception when others then if sqlerrm not like '%code:activation_requires_review%' then raise; end if; end;
  perform public.set_rule_review_state(_r, 'legal_review', 'sent to legal');
  if (select review_state from public.rules where id = _r) <> 'legal_review' then raise exception 'legal_review not set'; end if;
end $$;
reset role;

-- Direct writes cannot activate a regulatory rule without review data (constraint).
do $$ begin
  begin
    update public.rules set review_state = 'active' where code = 'SAMA-ADV-01';
    raise exception 'constraint missing';
  exception when check_violation then null; end;
end $$;

select pass('rule packs, drafts and activation guard');
select * from finish();
rollback;
