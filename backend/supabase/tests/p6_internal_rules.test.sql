-- Phase 6.7 — internal rules: flag, owners/admins only, drafts must be edited before approval, editing an active
-- rule returns it to draft, codes are INT-*. Run: npx supabase test db --workdir backend
begin;
create extension if not exists pgtap with schema extensions;
select plan(1);

insert into auth.users (id, email) values ('1c000000-0000-0000-0000-000000000001', 'ow@int.test'), ('1c000000-0000-0000-0000-000000000005', 'cr@int.test'),
  ('1c000000-0000-0000-0000-000000000002', 'ad@int.test');
insert into public.organizations (id, name, created_by) values ('2c000000-0000-0000-0000-000000000001', 'Int Bank', '1c000000-0000-0000-0000-000000000001');
insert into public.org_members (org_id, user_id, role) values
  ('2c000000-0000-0000-0000-000000000001', '1c000000-0000-0000-0000-000000000001', 'owner'),
  ('2c000000-0000-0000-0000-000000000001', '1c000000-0000-0000-0000-000000000002', 'admin'),
  ('2c000000-0000-0000-0000-000000000001', '1c000000-0000-0000-0000-000000000005', 'creator');
insert into public.org_settings (org_id) values ('2c000000-0000-0000-0000-000000000001') on conflict (org_id) do nothing;
-- A drafted rule as the drafting function writes it (service role).
insert into public.internal_rules (id, org_id, code, title_ar, instruction_ar, source)
values ('5c000000-0000-0000-0000-000000000001', '2c000000-0000-0000-0000-000000000001', 'INT-LOGO', 'الشعار', 'لا يُمدّ الشعار ولا تُغيّر ألوانه', 'model_draft');

create or replace function pg_temp.as_user(_u text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', _u, true), set_config('request.jwt.claim.role', 'authenticated', true)
$$;
create or replace function pg_temp.expect_error(_sql text, _code text) returns void language plpgsql as $$
begin
  execute _sql;
  raise exception 'expected % but the statement succeeded: %', _code, _sql;
exception when others then
  if sqlerrm not like '%' || _code || '%' then raise exception 'expected %, got %: %', _code, sqlerrm, _sql; end if;
end $$;

set local role authenticated;
select pg_temp.as_user('1c000000-0000-0000-0000-000000000001');
do $$ begin
  perform pg_temp.expect_error($q$select public.approve_internal_rule('5c000000-0000-0000-0000-000000000001')$q$, 'code:forbidden');
end $$;
reset role;
select set_config('request.jwt.claim.sub', '', true);
update public.org_settings set features = '{"internal_rules": true}' where org_id = '2c000000-0000-0000-0000-000000000001';
set local role authenticated;
select pg_temp.as_user('1c000000-0000-0000-0000-000000000005');
do $$ begin
  perform pg_temp.expect_error($q$select public.save_brand_guideline('2c000000-0000-0000-0000-000000000001', 'x', 'y')$q$, 'code:forbidden');
  if not exists (select 1 from public.internal_rules) then raise exception 'creator cannot read rules'; end if;
  perform pg_temp.expect_error($q$update public.internal_rules set status = 'active'$q$, 'permission denied');
end $$;
select pg_temp.as_user('1c000000-0000-0000-0000-000000000001');
do $$ begin
  perform pg_temp.expect_error($q$select public.approve_internal_rule('5c000000-0000-0000-0000-000000000001')$q$, 'code:edit_required');
  perform public.save_internal_rule('2c000000-0000-0000-0000-000000000001', '5c000000-0000-0000-0000-000000000001', 'int-logo', 'سلامة الشعار',
    'يجب ألا يظهر الشعار ممدوداً أو بألوان خارج الهوية', 'warning');
  -- The author cannot approve their own rule (Phase 8): another owner/admin/lead does.
  perform pg_temp.expect_error($q$select public.approve_internal_rule('5c000000-0000-0000-0000-000000000001')$q$, 'code:separation_of_duties');
  perform set_config('request.jwt.claim.sub', '1c000000-0000-0000-0000-000000000002', true);
  perform public.approve_internal_rule('5c000000-0000-0000-0000-000000000001');
  perform set_config('request.jwt.claim.sub', '1c000000-0000-0000-0000-000000000001', true);
  if (select status from public.internal_rules where id = '5c000000-0000-0000-0000-000000000001') <> 'active' then raise exception 'not active'; end if;
  perform public.save_internal_rule('2c000000-0000-0000-0000-000000000001', '5c000000-0000-0000-0000-000000000001', 'INT-LOGO', 'سلامة الشعار', 'نص معدّل', 'warning');
  if (select status from public.internal_rules where id = '5c000000-0000-0000-0000-000000000001') <> 'draft' then raise exception 'edit kept it active'; end if;
  perform pg_temp.expect_error($q$select public.save_internal_rule('2c000000-0000-0000-0000-000000000001', null, 'SAMA-1', 'x', 'y', 'warning')$q$, 'code:invalid_code');
end $$;
reset role;
-- Phase 8: versions. The first approval wrote version 1; the edit above started version 2 (draft).
do $$ begin
  if (select version from public.internal_rules where id = '5c000000-0000-0000-0000-000000000001') <> 2 then raise exception 'edit did not start version 2'; end if;
  if (select count(*) from public.internal_rule_versions where rule_id = '5c000000-0000-0000-0000-000000000001' and version = 1) <> 1 then raise exception 'v1 snapshot missing'; end if;
end $$;

select pass('p6 internal rules');
select * from finish();
rollback;
