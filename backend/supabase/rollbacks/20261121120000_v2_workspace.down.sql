-- Rollback of 20261121120000_v2_workspace.sql (D210). Generated from a catalog diff on the isolated stack (master schema + this
-- migration) and verified: master + all pending migrations + every rollback in reverse = master's schema.
-- Run the rollbacks newest first, each in one transaction. Data written into objects this migration added
-- (new tables, new columns) is dropped with them; take the backup first (RELEASE_PLAN.md §1).
begin;
drop function if exists public.ar_token(text);
drop function if exists public.text_overlap(text,text);
drop function if exists public.internal_rule_duplicates(uuid,text,text,uuid);
drop function if exists public.history_actors(uuid);
drop function if exists public.workspace_overview(uuid);
drop function if exists public.role_member_counts(uuid);
drop function if exists public.set_fix_monthly_limit(uuid,integer);
CREATE OR REPLACE FUNCTION public.approve_internal_rule(_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r public.internal_rules;
begin
  select * into r from public.internal_rules where id = _id for update;
  if r.id is null or not public.can_manage_internal_rules(r.org_id) then raise exception 'code:forbidden' using errcode = '42501'; end if;
  if r.status <> 'draft' then raise exception 'code:invalid_status' using errcode = 'P0001'; end if;
  if r.edited_by is null then raise exception 'code:edit_required' using errcode = 'P0001'; end if;
  if r.edited_by = auth.uid() then raise exception 'code:separation_of_duties' using errcode = '42501'; end if;
  update public.internal_rules set status = 'active', approved_by = auth.uid(), approved_at = now() where id = _id;
  insert into public.audit_events (actor, action, target_table, target_id, meta)
  values (auth.uid(), 'internal_rule.approve', 'internal_rules', _id::text, jsonb_build_object('org_id', r.org_id, 'code', r.code));
end $function$;
commit;
