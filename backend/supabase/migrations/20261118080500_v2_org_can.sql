-- v2 Phase 8 (step 5): org_can — the permission matrix in SQL. Hand-written to match frontend/src/lib/permissions.ts;
-- backend/supabase/tests/p8_roles_matrix.test.sql (generated from that file) fails if the two disagree.
-- Returns 'yes', 'cond' (allowed only when the enforcing RPC's condition holds) or 'no'. Used by the UI to explain
-- disabled actions and by RPCs as the role gate; conditions stay in the RPCs.

create or replace function public.org_role_can(_role public.org_role, _action text)
returns text language sql immutable set search_path = '' as $$
  select case _action
    when 'view_promotions' then case when _role::text in ('creator', 'external_uploader', 'external_reviewer') then 'cond' else 'yes' end
    when 'create_promotion' then case when _role::text in ('owner', 'admin', 'creator') then 'yes' when _role::text = 'external_uploader' then 'cond' else 'no' end
    when 'submit_for_review' then case when _role::text in ('owner', 'admin', 'creator') then 'yes'
                                       when _role::text in ('compliance_lead', 'reviewer', 'legal', 'external_uploader') then 'cond' else 'no' end
    when 'request_changes_comment' then case when _role::text in ('owner', 'admin', 'compliance_lead', 'reviewer') then 'yes' else 'no' end
    when 'comment' then case when _role::text in ('owner', 'admin', 'compliance_lead', 'reviewer', 'legal') then 'yes'
                             when _role::text = 'viewer' then 'no' else 'cond' end
    when 'decide_review' then case when _role::text in ('owner', 'admin', 'compliance_lead', 'reviewer') then 'cond' else 'no' end
    when 'assign_reviewer' then case when _role::text in ('owner', 'admin', 'compliance_lead') then 'yes' else 'no' end
    when 'escalate_legal' then case when _role::text in ('owner', 'admin', 'compliance_lead', 'reviewer') then 'cond' else 'no' end
    when 'legal_opinion' then case when _role::text = 'legal' then 'yes' else 'no' end
    when 'accept_risk' then case when _role::text in ('owner', 'admin', 'compliance_lead', 'reviewer', 'legal') then 'cond' else 'no' end
    when 'manage_members' then case when _role::text = 'owner' then 'yes' when _role::text = 'admin' then 'cond' else 'no' end
    when 'manage_rule_packs' then case when _role::text in ('owner', 'admin', 'compliance_lead') then 'yes' else 'no' end
    when 'manage_company_rules' then case when _role::text in ('owner', 'admin', 'compliance_lead') then 'yes' else 'no' end
    when 'approve_company_rules' then case when _role::text in ('owner', 'admin', 'compliance_lead') then 'cond' else 'no' end
    when 'manage_products' then case when _role::text in ('owner', 'admin') then 'yes' else 'no' end
    when 'manage_settings' then case when _role::text in ('owner', 'admin') then 'yes' else 'no' end
    when 'view_analytics' then case when _role::text in ('owner', 'admin', 'compliance_lead', 'reviewer', 'viewer') then 'yes' else 'no' end
    else 'no'
  end
$$;

/** The caller's cell for an action in an organisation ('no' when not a member). */
create or replace function public.org_can(_org uuid, _action text)
returns text language sql stable security definer set search_path = '' as $$
  select coalesce((select public.org_role_can(m.role, _action) from public.org_members m
                   where m.org_id = _org and m.user_id = auth.uid() and m.access_status = 'active'), 'no')
$$;

revoke all on function public.org_role_can(public.org_role, text), public.org_can(uuid, text) from public, anon;
grant execute on function public.org_role_can(public.org_role, text), public.org_can(uuid, text) to authenticated, service_role;

-- Company rules: the author (last editor) cannot approve their own rule; another owner, admin or compliance lead does.
create or replace function public.approve_internal_rule(_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
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
end $$;
