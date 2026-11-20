-- SALEEM V2 comprehensive upgrade (D170–D175) — workflow, governance and partner fixes from the Nada Cream test.
--
-- 1. Sectors: products, organisations and advertisements can be non-financial (cosmetics, food, health, tourism,
--    e-commerce, retail). Existing values are unchanged.
-- 2. MAW-03 / MAW-04 (written agreement, Mawthooq licence) apply to creator/influencer advertising only, not to an
--    organisation publishing on its own channels (D171). Legal confirmation is still pending (legal_status unchanged).
-- 3. Finding responses: richer uploader / reviewer actions, idempotent repeats (no duplicate history rows).
-- 4. Submission no longer blocks on unanswered findings: it asks for an explanation (org policy) instead.
-- 5. Reviewer decisions: request changes / reject need no per-finding answers; approval keeps the strict checks
--    (confirmed violations, missing assessments, open conditions) — enforced here, not in the UI.
-- 6. Structured conditional approval: conditions, marketer fulfilment, reviewer verification and a separate final
--    approval decision (hash-chained like every decision).
-- 7. Partners: link scope (campaign, instructions, expiry, assigned partners, communication types), configurable
--    active-submission limit enforced atomically, draft cancellation, link rotation, in-account link access.
-- 8. Assignment no-ops and eligible-reviewer return on resubmission (no duplicate events).
-- Nothing here deletes or rewrites decisions, events, findings or responses.

-- ---------------------------------------------------------------------------------------------
-- 1. Sectors and product types
-- ---------------------------------------------------------------------------------------------
alter table public.products drop constraint if exists products_sector_check;
alter table public.products add constraint products_sector_check check (sector in (
  'banking', 'finance_company', 'payments', 'capital_market', 'insurance',
  'cosmetics', 'food_beverage', 'health_supplements', 'tourism', 'ecommerce', 'retail', 'other'));
alter table public.products drop constraint if exists products_product_type_check;
alter table public.products add constraint products_product_type_check check (product_type in (
  'personal_finance', 'real_estate_finance', 'auto_finance', 'credit_card', 'bnpl', 'sme_finance', 'consumer_microfinance',
  'finance_lease', 'current_account', 'savings_deposit', 'time_deposit', 'wallet', 'prepaid_card', 'remittance', 'fx',
  'public_fund', 'non_retail_fund', 'equities', 'derivatives', 'sukuk_bonds', 'robo_advisory', 'insurance_motor',
  'insurance_health', 'insurance_protection_savings', 'insurance_other',
  'skincare', 'makeup', 'haircare', 'fragrance', 'personal_care',
  'food_product', 'beverage', 'dietary_supplement', 'health_product',
  'tour_package', 'accommodation', 'experience', 'travel_service',
  'online_product', 'retail_product', 'electronics', 'apparel', 'service',
  'other'));
alter table public.products drop constraint if exists products_regulator_check;
alter table public.products add constraint products_regulator_check check (regulator in ('SAMA', 'CMA', 'IA', 'SFDA', 'MOT', 'MOC', 'other'));
alter table public.org_settings drop constraint if exists org_settings_sector_check;
alter table public.org_settings add constraint org_settings_sector_check check (sector in (
  'banking', 'finance_company', 'payments', 'capital_market', 'insurance',
  'cosmetics', 'food_beverage', 'health_supplements', 'tourism', 'ecommerce', 'retail', 'other'));
-- The advertisement's own sector (falls back to its product, then the organisation). Existing values stay valid.
alter table public.promotions drop constraint if exists promotions_sector_check;
alter table public.promotions add constraint promotions_sector_check check (sector is null or sector in (
  'banking', 'finance_company', 'payments', 'capital_market', 'insurance',
  'cosmetics', 'food_beverage', 'health_supplements', 'tourism', 'ecommerce', 'retail', 'other')) not valid;

-- The cosmetics / food / tourism draft packs default to their sector (drafts still never apply unless an org opts in).
update public.rule_packs set default_sectors = '{cosmetics}' where code = 'sa-cos' and default_sectors = '{}';
update public.rule_packs set default_sectors = '{food_beverage,health_supplements}' where code = 'sa-food' and default_sectors = '{}';
update public.rule_packs set default_sectors = '{tourism}' where code = 'sa-tr' and default_sectors = '{}';

-- ---------------------------------------------------------------------------------------------
-- 2. MAW-03 / MAW-04 applicability (D171)
-- ---------------------------------------------------------------------------------------------
-- A function so the seed can re-apply it after publishing a fresh rulebook (local resets).
create or replace function public.v2_rule_scope_fixes()
returns void language sql security definer set search_path = '' as $fn$
update public.rules r set
  applicability = '{"any_of": [{"communication_types": ["creator_sponsored"]}, {"distribution": ["influencer"]}]}'::jsonb,
  applicability_ar = 'ينطبق على الإعلان عبر صانع محتوى أو مؤثر (إعلان برعاية أو نشر عبر صانع محتوى). لا يُطبَّق تلقائياً على نشر الجهة عبر قنواتها الرسمية؛ تطبيقه على الحسابات الرسمية للجهات يحتاج تأكيداً قانونياً.',
  change_reason = 'D171: Mawthooq licence and the written creator agreement concern advertising through natural-person creators (GAMR/Mawthooq); excluded for own-channel corporate publication pending legal confirmation.'
from public.rulebook_versions v
where v.id = r.rulebook_version_id and v.status = 'published' and r.code in ('MAW-03', 'MAW-04');
$fn$;
revoke all on function public.v2_rule_scope_fixes() from public, anon, authenticated;
select public.v2_rule_scope_fixes();

-- ---------------------------------------------------------------------------------------------
-- 3. Finding responses
-- ---------------------------------------------------------------------------------------------
alter table public.findings drop constraint if exists findings_status_check;
alter table public.findings add constraint findings_status_check check (status in (
  'open', 'actioned', 'disputed', 'dismissed', 'not_required', 'resolved',
  'corrected', 'evidence_provided', 'evidence_required', 'verified', 'clarification_required'));

alter table public.finding_responses drop constraint if exists finding_responses_action_check;
alter table public.finding_responses add constraint finding_responses_action_check check (action in (
  'agree_will_action', 'dispute', 'reply', 'agree_please_action', 'not_required', 'dismiss',
  'correction_done', 'request_guidance', 'provide_evidence', 'evidence_required', 'correction_verified', 'clarification_required'));
alter table public.finding_responses drop constraint if exists finding_responses_check1;
alter table public.finding_responses add constraint finding_responses_check1 check (
  action = 'reply'
  or (actor_role = 'uploader' and action in ('agree_will_action', 'dispute', 'correction_done', 'request_guidance', 'provide_evidence'))
  or (actor_role = 'reviewer' and action in ('agree_please_action', 'not_required', 'dismiss', 'evidence_required', 'correction_verified', 'clarification_required')));

create or replace function public.response_status(_action text)
returns text language sql immutable set search_path = '' as $$
  select case _action
    -- uploader (marketer / partner)
    when 'agree_will_action' then 'actioned' when 'correction_done' then 'corrected' when 'dispute' then 'disputed'
    when 'provide_evidence' then 'evidence_provided'
    -- reviewer
    when 'agree_please_action' then 'actioned' when 'not_required' then 'not_required' when 'dismiss' then 'dismissed'
    when 'evidence_required' then 'evidence_required' when 'correction_verified' then 'verified'
    when 'clarification_required' then 'clarification_required'
  end
$$;

create or replace function public.respond_finding(_finding uuid, _action text, _comment text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  f public.findings; s public.submissions; p public.promotions; _role public.org_role; _actor text; _id uuid;
  last public.finding_responses; _note text := nullif(trim(coalesce(_comment, '')), '');
  _uploader_actions constant text[] := array['agree_will_action', 'correction_done', 'dispute', 'request_guidance', 'provide_evidence'];
  _reviewer_actions constant text[] := array['agree_please_action', 'not_required', 'dismiss', 'evidence_required', 'correction_verified', 'clarification_required'];
begin
  select * into f from public.findings where id = _finding;
  if f.id is null or not public.can_read_submission(f.submission_id) then raise exception 'code:not_found' using errcode = 'P0001'; end if;
  select * into s from public.submissions where id = f.submission_id;
  select * into p from public.promotions where id = s.promotion_id;
  if p.id is null or s.is_demo then raise exception 'code:forbidden' using errcode = '42501'; end if;
  if f.run_id <> public.latest_run_id(s.id) then raise exception 'code:finding_superseded' using errcode = 'P0001'; end if;
  _role := case when p.org_id is null then null else public.org_role_of(p.org_id, auth.uid()) end;

  if _action = any(_uploader_actions) or (_action = 'reply' and (p.owner_id = auth.uid() or s.user_id = auth.uid() or _role in ('creator'))) then
    if not coalesce(p.owner_id = auth.uid() or s.user_id = auth.uid() or _role in ('owner', 'admin', 'creator'), false) then
      raise exception 'code:forbidden' using errcode = '42501';
    end if;
    if p.review_status not in ('draft', 'changes_requested', 'rejected', 'conditionally_approved', 'pending_review', 'in_review') then
      raise exception 'code:invalid_status' using errcode = 'P0001';
    end if;
    _actor := 'uploader';
  elsif _action = any(_reviewer_actions) or _action = 'reply' then
    if _role is null or _role not in ('owner', 'admin', 'reviewer', 'compliance_lead') then raise exception 'code:forbidden' using errcode = '42501'; end if;
    if s.user_id = auth.uid() then raise exception 'code:separation_of_duties' using errcode = '42501'; end if;
    if _role = 'reviewer' and p.assigned_reviewer_id is distinct from auth.uid() then raise exception 'code:not_assigned' using errcode = '42501'; end if;
    if p.review_status not in ('in_review', 'escalated', 'conditionally_approved') then raise exception 'code:invalid_status' using errcode = 'P0001'; end if;
    _actor := 'reviewer';
  else
    raise exception 'code:invalid_action' using errcode = 'P0001';
  end if;
  if _action in ('dispute', 'not_required', 'dismiss', 'request_guidance', 'provide_evidence', 'evidence_required', 'clarification_required', 'reply')
     and _note is null then
    raise exception 'code:comment_required' using errcode = 'P0001';
  end if;

  -- Idempotent: the same actor repeating the same answer adds no history row.
  select * into last from public.finding_responses r where r.finding_id = f.id and r.actor_id = auth.uid()
  order by r.created_at desc, r.id desc limit 1;
  if last.id is not null and last.action = _action and last.comment is not distinct from _note then return last.id; end if;

  insert into public.finding_responses (finding_id, submission_id, actor_id, actor_role, action, comment)
  values (f.id, f.submission_id, auth.uid(), _actor, _action, _note)
  returning id into _id;

  -- A reviewer assessment always overrides the uploader's status.
  if public.response_status(_action) is not null and (
       _actor = 'reviewer'
       or not exists (select 1 from public.finding_responses r where r.finding_id = f.id and r.actor_role = 'reviewer')) then
    update public.findings set status = public.response_status(_action) where id = f.id;
  end if;
  return _id;
end $$;

-- ---------------------------------------------------------------------------------------------
-- 4. Submission: unanswered findings need an explanation, never a hard block (D172)
-- ---------------------------------------------------------------------------------------------
create or replace function public.can_submit(_pid uuid, _note text default null, _ack_failed boolean default false)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  p public.promotions; s public.submissions; _reasons text[] := '{}'; _role public.org_role; _settings public.org_settings;
  _last_decided uuid; _open int := 0;
begin
  select * into p from public.promotions where id = _pid;
  if p.id is null or not public.can_read_promotion(_pid) then return jsonb_build_object('ok', false, 'reasons', jsonb_build_array('not_found')); end if;
  if p.org_id is null then return jsonb_build_object('ok', false, 'reasons', jsonb_build_array('personal_promotion')); end if;
  _role := public.org_role_of(p.org_id, auth.uid());
  if _role is null or _role in ('viewer', 'legal', 'external_reviewer')
     or not (p.owner_id = auth.uid() or _role in ('owner', 'admin', 'creator')) then
    _reasons := array_append(_reasons, 'forbidden'::text);
  end if;
  if p.review_status not in ('draft', 'changes_requested', 'rejected', 'conditionally_approved') then _reasons := array_append(_reasons, 'invalid_status'::text); end if;
  select * into s from public.submissions where id = p.current_version_id;
  if s.id is null then _reasons := array_append(_reasons, 'no_version'::text);
  elsif s.status = 'failed' and not _ack_failed then _reasons := array_append(_reasons, 'analysis_failed'::text);
  elsif s.status not in ('done', 'failed') then _reasons := array_append(_reasons, 'analysis_not_done'::text);
  end if;
  select * into _settings from public.org_settings where org_id = p.org_id;
  if s.id is not null then
    select count(*) into _open from public.findings f
    where f.run_id = public.latest_run_id(s.id) and f.status = 'open'
      and not exists (select 1 from public.finding_responses r where r.finding_id = f.id and r.actor_role = 'uploader');
    if _open > 0 and coalesce(_settings.require_uploader_responses, true) and coalesce(trim(_note), '') = '' then
      _reasons := array_append(_reasons, ('note_required_unanswered:' || _open)::text);
    end if;
  end if;
  select submission_id into _last_decided from public.review_decisions
  where promotion_id = _pid and decision in ('approve', 'conditional_approve', 'request_changes', 'reject') order by created_at desc limit 1;
  if _last_decided is not null and _last_decided = p.current_version_id then
    if p.review_status = 'changes_requested' then
      if coalesce(trim(_note), '') = '' then _reasons := array_append(_reasons, 'note_required_same_version'::text); end if;
    elsif p.review_status in ('rejected', 'conditionally_approved') then
      _reasons := array_append(_reasons, 'new_version_required'::text);
    end if;
  end if;
  return jsonb_build_object('ok', cardinality(_reasons) = 0, 'reasons', to_jsonb(_reasons), 'unanswered', _open,
    'explanation_required', coalesce(_settings.require_uploader_responses, true));
end $$;

-- Resubmission returns to the previous reviewer only while they are still eligible (D174).
create or replace function public.submit_promotion_carry(_pid uuid, _note text default null, _ack_failed boolean default false, _carry integer[] default '{}')
returns void language plpgsql security definer set search_path = '' as $$
declare p public.promotions; _check jsonb; _from public.promotion_review_status; _assignee uuid; _arole public.org_role;
begin
  select * into p from public.promotions where id = _pid for update;
  _check := public.can_submit(_pid, _note, _ack_failed);
  if not (_check->>'ok')::boolean then
    raise exception 'code:%', split_part(_check->'reasons'->>0, ':', 1) using errcode = 'P0001', detail = _check::text;
  end if;
  _from := p.review_status;
  _assignee := p.assigned_reviewer_id;
  if _assignee is not null then
    _arole := public.org_role_of(p.org_id, _assignee);
    if _arole is null or _arole not in ('owner', 'admin', 'reviewer', 'compliance_lead') or _assignee = public.promotion_uploader(_pid) then
      _assignee := null;
    end if;
  end if;
  update public.promotions set review_status = 'pending_review', submitted_at = coalesce(submitted_at, now()),
    assigned_reviewer_id = _assignee, updated_at = now() where id = _pid;
  if p.assigned_reviewer_id is not null and _assignee is null then
    perform public.log_review_event(_pid, p.current_version_id, 'unassigned', _from::text, _from::text,
      jsonb_build_object('previous', p.assigned_reviewer_id, 'reason', 'reviewer_not_eligible'));
  end if;
  perform public.log_review_event(_pid, p.current_version_id, 'submitted', _from::text, 'pending_review',
    jsonb_build_object('note', nullif(trim(coalesce(_note, '')), ''), 'analysis_failed_acknowledged', _ack_failed,
      'unanswered_findings', coalesce((_check->>'unanswered')::int, 0), 'resubmission', p.submitted_at is not null,
      'returned_to', _assignee));
  if public.start_review_flow(_pid, _carry) is null then
    if _assignee is not null then
      perform public.notify_user(_assignee, 'review_submitted', p.current_version_id,
        jsonb_build_object('promotion_id', _pid, 'title', p.title, 'resubmission', true));
    else
      perform public.notify_org(p.org_id, array['owner', 'admin', 'compliance_lead']::public.org_role[], 'review_submitted', p.current_version_id,
        jsonb_build_object('promotion_id', _pid, 'title', p.title));
    end if;
  end if;
end $$;

-- ---------------------------------------------------------------------------------------------
-- 5. Reviewer decisions: gating vs approval blockers (D173)
-- ---------------------------------------------------------------------------------------------
create or replace function public.approval_blockers(_pid uuid)
returns text[] language plpgsql stable security definer set search_path = '' as $$
declare p public.promotions; _settings public.org_settings; _run uuid; _out text[] := '{}'; _n int;
begin
  select * into p from public.promotions where id = _pid;
  if p.id is null then return array['not_found']; end if;
  _run := public.latest_run_id(p.current_version_id);
  select * into _settings from public.org_settings where org_id = p.org_id;
  -- Confirmed violations the reviewer asked to correct (or asked evidence for) and nobody verified.
  select count(*) into _n from public.findings f
  where f.run_id = _run and f.severity = 'violation' and f.status in ('actioned', 'evidence_required', 'clarification_required')
    and exists (select 1 from public.finding_responses r where r.finding_id = f.id and r.actor_role = 'reviewer');
  if _n > 0 then _out := array_append(_out, ('confirmed_violations:' || _n)::text); end if;
  if coalesce(_settings.require_reviewer_responses, true) then
    select count(*) into _n from public.findings f
    where f.run_id = _run and f.status not in ('resolved', 'verified')
      and not exists (select 1 from public.finding_responses r where r.finding_id = f.id and r.actor_role = 'reviewer');
    if _n > 0 then _out := array_append(_out, ('missing_reviewer_responses:' || _n)::text); end if;
  end if;
  return _out;
end $$;
revoke all on function public.approval_blockers(uuid) from public, anon;
grant execute on function public.approval_blockers(uuid) to authenticated, service_role;

create or replace function public.can_decide(_pid uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare p public.promotions; _reasons text[] := '{}'; _role public.org_role; _blockers text[];
begin
  select * into p from public.promotions where id = _pid;
  if p.id is null or not public.can_read_promotion(_pid) then return jsonb_build_object('ok', false, 'reasons', jsonb_build_array('not_found')); end if;
  _role := public.org_role_of(p.org_id, auth.uid());
  if _role is null or _role not in ('owner', 'admin', 'reviewer', 'compliance_lead') then _reasons := array_append(_reasons, 'forbidden'::text); end if;
  if p.review_status <> 'in_review' then _reasons := array_append(_reasons, 'invalid_status'::text); end if;
  if public.promotion_uploader(_pid) = auth.uid() then _reasons := array_append(_reasons, 'separation_of_duties'::text); end if;
  if _role = 'reviewer' and p.assigned_reviewer_id is distinct from auth.uid() then _reasons := array_append(_reasons, 'not_assigned'::text); end if;
  if public.flow_is_live(_pid) then _reasons := array_append(_reasons, 'multi_level_flow'::text); end if;
  _blockers := public.approval_blockers(_pid);
  return jsonb_build_object('ok', cardinality(_reasons) = 0, 'reasons', to_jsonb(_reasons),
    'approve_ok', cardinality(_reasons) = 0 and cardinality(_blockers) = 0, 'approve_blockers', to_jsonb(_blockers));
end $$;

-- ---------------------------------------------------------------------------------------------
-- 6. Structured conditional approval (D175)
-- ---------------------------------------------------------------------------------------------
create table if not exists public.approval_conditions (
  id                  uuid primary key default gen_random_uuid(),
  promotion_id        uuid not null references public.promotions(id) on delete restrict,
  decision_id         uuid not null references public.review_decisions(id) on delete restrict,
  submission_id       uuid not null references public.submissions(id) on delete restrict,
  position            integer not null default 1,
  description         text not null check (char_length(trim(description)) between 1 and 2000),
  required_action     text null check (char_length(required_action) <= 2000),
  evidence_required   boolean not null default false,
  responsible_user_id uuid null references auth.users(id) on delete set null,
  due_on              date null,
  status              text not null default 'open' check (status in ('open', 'submitted', 'verified', 'more_evidence', 'rejected')),
  fulfillment_note    text null check (char_length(fulfillment_note) <= 5000),
  evidence_links      text[] not null default '{}',
  evidence_paths      text[] not null default '{}',
  fulfilled_by        uuid null,
  fulfilled_at        timestamptz null,
  verified_by         uuid null,
  verified_at         timestamptz null,
  verifier_note       text null check (char_length(verifier_note) <= 5000),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists approval_conditions_promotion_idx on public.approval_conditions (promotion_id, decision_id, position);
alter table public.approval_conditions enable row level security;
drop policy if exists approval_conditions_read on public.approval_conditions;
create policy approval_conditions_read on public.approval_conditions for select to authenticated
  using (public.can_read_promotion(promotion_id));
grant select on public.approval_conditions to authenticated;
-- Writes go through the RPCs below only.

-- Keeps the condition's history: every change is also an immutable review event.
create or replace function public.condition_uploader_side(p public.promotions)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(p.owner_id = auth.uid() or public.promotion_uploader(p.id) = auth.uid()
    or public.org_role_of(p.org_id, auth.uid()) in ('owner', 'admin', 'creator'), false)
$$;
create or replace function public.condition_decider(p public.promotions)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.org_role_of(p.org_id, auth.uid()) in ('owner', 'admin', 'reviewer', 'compliance_lead'), false)
    and public.promotion_uploader(p.id) is distinct from auth.uid()
    and (public.org_role_of(p.org_id, auth.uid()) <> 'reviewer' or p.assigned_reviewer_id = auth.uid())
$$;
revoke all on function public.condition_uploader_side(public.promotions), public.condition_decider(public.promotions) from public, anon, authenticated;

drop function if exists public.decide_promotion(uuid, text, uuid[], text, text, text);
create or replace function public.decide_promotion(_pid uuid, _decision text, _reason_ids uuid[] default '{}', _reason_other text default null,
  _condition text default null, _comment text default null, _conditions jsonb default '[]'::jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  p public.promotions; _check jsonb; _to public.promotion_review_status; d public.review_decisions; _role public.org_role;
  _items jsonb := coalesce(_conditions, '[]'::jsonb); _c jsonb; _i int := 0; _summary text; _uploader uuid;
begin
  select * into p from public.promotions where id = _pid for update;
  if p.id is null then raise exception 'code:not_found' using errcode = 'P0001'; end if;
  _check := public.can_decide(_pid);
  if not (_check->>'ok')::boolean then
    raise exception 'code:%', split_part(_check->'reasons'->>0, ':', 1) using errcode = 'P0001', detail = _check::text;
  end if;
  _to := case _decision when 'approve' then 'approved' when 'conditional_approve' then 'conditionally_approved'
                        when 'request_changes' then 'changes_requested' when 'reject' then 'rejected' end;
  if _to is null then raise exception 'code:invalid_decision' using errcode = 'P0001'; end if;
  if _decision in ('approve', 'conditional_approve') and not (_check->>'approve_ok')::boolean then
    raise exception 'code:%', split_part(_check->'approve_blockers'->>0, ':', 1) using errcode = 'P0001', detail = _check::text;
  end if;
  if _decision in ('reject', 'request_changes') and cardinality(coalesce(_reason_ids, '{}')) = 0 and coalesce(trim(_reason_other), '') = '' then
    raise exception 'code:reason_required' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.rejection_reasons r where r.id = any(coalesce(_reason_ids, '{}')) and r.is_other) and coalesce(trim(_reason_other), '') = '' then
    raise exception 'code:reason_other_required' using errcode = 'P0001';
  end if;
  if exists (select 1 from unnest(coalesce(_reason_ids, '{}')) x where not exists (
      select 1 from public.rejection_reasons r where r.id = x and not r.archived and (r.org_id is null or r.org_id = p.org_id))) then
    raise exception 'code:invalid_reason' using errcode = 'P0001';
  end if;
  if _decision = 'conditional_approve' then
    if jsonb_typeof(_items) <> 'array' then raise exception 'code:invalid_conditions' using errcode = 'P0001'; end if;
    if jsonb_array_length(_items) = 0 and coalesce(trim(_condition), '') <> '' then
      _items := jsonb_build_array(jsonb_build_object('description', trim(_condition)));
    end if;
    if jsonb_array_length(_items) = 0
       or exists (select 1 from jsonb_array_elements(_items) e where coalesce(trim(e->>'description'), '') = '') then
      raise exception 'code:condition_required' using errcode = 'P0001';
    end if;
    if jsonb_array_length(_items) > 20 then raise exception 'code:too_many_conditions' using errcode = 'P0001'; end if;
    select string_agg(trim(e->>'description'), E'\n' order by o) into _summary from jsonb_array_elements(_items) with ordinality as x(e, o);
  end if;
  _role := public.org_role_of(p.org_id, auth.uid());
  d := public.write_decision(p, _decision, _role::text, _to, _reason_ids, _reason_other,
    case when _decision = 'conditional_approve' then _summary else _condition end, _comment);
  if _decision = 'conditional_approve' then
    for _c in select e from jsonb_array_elements(_items) e loop
      _i := _i + 1;
      insert into public.approval_conditions (promotion_id, decision_id, submission_id, position, description, required_action,
        evidence_required, responsible_user_id, due_on)
      values (_pid, d.id, p.current_version_id, _i, left(trim(_c->>'description'), 2000), nullif(left(trim(coalesce(_c->>'required_action', '')), 2000), ''),
        coalesce((_c->>'evidence_required')::boolean, false),
        case when (_c->>'responsible_user_id') is not null and public.org_role_of(p.org_id, (_c->>'responsible_user_id')::uuid) is not null
             then (_c->>'responsible_user_id')::uuid end,
        nullif(_c->>'due_on', '')::date);
    end loop;
  end if;
  update public.promotions set
    review_status = _to,
    first_decision_at = coalesce(first_decision_at, now()),
    approved_at = case when _to in ('approved', 'conditionally_approved') then now() else approved_at end,
    approved_version_id = case when _to in ('approved', 'conditionally_approved') then current_version_id else approved_version_id end,
    updated_at = now()
  where id = _pid;
  perform public.log_review_event(_pid, p.current_version_id, 'decided', 'in_review', _to::text,
    jsonb_build_object('decision', _decision, 'decision_id', d.id, 'conditions', _i));
  _uploader := public.promotion_uploader(_pid);
  perform public.notify_user(_uploader, 'review_decided', p.current_version_id,
    jsonb_build_object('promotion_id', _pid, 'title', p.title, 'decision', _decision,
      'version_no', (select version_no from public.submissions where id = p.current_version_id)));
  if p.owner_id is distinct from _uploader then
    perform public.notify_user(p.owner_id, 'review_decided', p.current_version_id, jsonb_build_object('promotion_id', _pid, 'title', p.title,
      'decision', _decision, 'version_no', (select version_no from public.submissions where id = p.current_version_id)));
  end if;
  return d.id;
end $$;
revoke all on function public.decide_promotion(uuid, text, uuid[], text, text, text, jsonb) from public, anon;
grant execute on function public.decide_promotion(uuid, text, uuid[], text, text, text, jsonb) to authenticated;

-- The marketer (or partner) answers one condition; saved as a draft until submitted for verification.
create or replace function public.save_condition_response(_id uuid, _note text, _links text[] default '{}', _paths text[] default '{}')
returns void language plpgsql security definer set search_path = '' as $$
declare c public.approval_conditions; p public.promotions;
begin
  select * into c from public.approval_conditions where id = _id for update;
  if c.id is null or not public.can_read_promotion(c.promotion_id) then raise exception 'code:not_found' using errcode = 'P0001'; end if;
  select * into p from public.promotions where id = c.promotion_id;
  if not public.condition_uploader_side(p) and c.responsible_user_id is distinct from auth.uid() then raise exception 'code:forbidden' using errcode = '42501'; end if;
  if public.org_role_of(p.org_id, auth.uid()) in ('viewer', 'legal', 'external_reviewer') then raise exception 'code:forbidden' using errcode = '42501'; end if;
  if p.review_status <> 'conditionally_approved' or p.current_version_id <> c.submission_id then raise exception 'code:invalid_status' using errcode = 'P0001'; end if;
  if c.status not in ('open', 'more_evidence', 'rejected') then raise exception 'code:invalid_status' using errcode = 'P0001'; end if;
  if coalesce(trim(_note), '') = '' then raise exception 'code:note_required' using errcode = 'P0001'; end if;
  if exists (select 1 from unnest(coalesce(_links, '{}')) l where l !~* '^https?://') then raise exception 'code:invalid_link' using errcode = 'P0001'; end if;
  if exists (select 1 from unnest(coalesce(_paths, '{}')) x where x not like (p.org_id::text || '/conditions/' || p.id::text || '/%')) then
    raise exception 'code:invalid_path' using errcode = 'P0001';
  end if;
  update public.approval_conditions set fulfillment_note = left(trim(_note), 5000), evidence_links = coalesce(_links, '{}'),
    evidence_paths = coalesce(_paths, '{}'), fulfilled_by = auth.uid(), fulfilled_at = now(), updated_at = now()
  where id = _id;
end $$;

-- «إرسال الشروط للتحقق»: every unverified condition must have an answer; no new analysis is needed.
create or replace function public.submit_conditions(_pid uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare p public.promotions; _n int;
begin
  select * into p from public.promotions where id = _pid for update;
  if p.id is null or not public.can_read_promotion(_pid) then raise exception 'code:not_found' using errcode = 'P0001'; end if;
  if not public.condition_uploader_side(p) or public.org_role_of(p.org_id, auth.uid()) in ('viewer', 'legal', 'external_reviewer') then
    raise exception 'code:forbidden' using errcode = '42501';
  end if;
  if p.review_status <> 'conditionally_approved' then raise exception 'code:invalid_status' using errcode = 'P0001'; end if;
  if exists (select 1 from public.approval_conditions c where c.promotion_id = _pid and c.submission_id = p.current_version_id
             and c.status in ('open', 'more_evidence', 'rejected') and coalesce(trim(c.fulfillment_note), '') = '') then
    raise exception 'code:conditions_incomplete' using errcode = 'P0001';
  end if;
  update public.approval_conditions set status = 'submitted', updated_at = now()
  where promotion_id = _pid and submission_id = p.current_version_id and status in ('open', 'more_evidence', 'rejected');
  get diagnostics _n = row_count;
  if _n = 0 then return 0; end if;  -- nothing new: no duplicate event or notification
  perform public.log_review_event(_pid, p.current_version_id, 'conditions_submitted', p.review_status::text, p.review_status::text,
    jsonb_build_object('count', _n));
  if p.assigned_reviewer_id is not null then
    perform public.notify_user(p.assigned_reviewer_id, 'conditions_submitted', p.current_version_id, jsonb_build_object('promotion_id', _pid, 'title', p.title));
  else
    perform public.notify_org(p.org_id, array['owner', 'admin', 'compliance_lead']::public.org_role[], 'conditions_submitted', p.current_version_id,
      jsonb_build_object('promotion_id', _pid, 'title', p.title));
  end if;
  return _n;
end $$;

create or replace function public.verify_condition(_id uuid, _verdict text, _note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare c public.approval_conditions; p public.promotions;
begin
  select * into c from public.approval_conditions where id = _id for update;
  if c.id is null or not public.can_read_promotion(c.promotion_id) then raise exception 'code:not_found' using errcode = 'P0001'; end if;
  select * into p from public.promotions where id = c.promotion_id;
  if not public.condition_decider(p) then raise exception 'code:forbidden' using errcode = '42501'; end if;
  if p.review_status <> 'conditionally_approved' or p.current_version_id <> c.submission_id then raise exception 'code:invalid_status' using errcode = 'P0001'; end if;
  if _verdict not in ('verified', 'more_evidence', 'rejected') then raise exception 'code:invalid_action' using errcode = 'P0001'; end if;
  if c.status <> 'submitted' then raise exception 'code:invalid_status' using errcode = 'P0001'; end if;
  if _verdict <> 'verified' and coalesce(trim(_note), '') = '' then raise exception 'code:note_required' using errcode = 'P0001'; end if;
  update public.approval_conditions set status = _verdict, verified_by = auth.uid(), verified_at = now(),
    verifier_note = nullif(left(trim(coalesce(_note, '')), 5000), ''), updated_at = now()
  where id = _id;
  perform public.log_review_event(p.id, c.submission_id, 'condition_' || _verdict, p.review_status::text, p.review_status::text,
    jsonb_build_object('condition_id', c.id, 'position', c.position, 'note', nullif(trim(coalesce(_note, '')), '')));
  if _verdict <> 'verified' then
    perform public.notify_user(coalesce(c.fulfilled_by, public.promotion_uploader(p.id)), 'condition_returned', c.submission_id,
      jsonb_build_object('promotion_id', p.id, 'title', p.title, 'verdict', _verdict));
  end if;
end $$;

-- The final approval is its own immutable, hash-chained decision (never inherited from the conditional one).
create or replace function public.finalize_conditional_approval(_pid uuid, _comment text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare p public.promotions; d public.review_decisions; _role public.org_role; _cond uuid;
begin
  select * into p from public.promotions where id = _pid for update;
  if p.id is null or not public.can_read_promotion(_pid) then raise exception 'code:not_found' using errcode = 'P0001'; end if;
  if not public.condition_decider(p) then
    raise exception 'code:%', case when public.promotion_uploader(_pid) = auth.uid() then 'separation_of_duties' else 'forbidden' end
      using errcode = '42501';
  end if;
  if p.review_status <> 'conditionally_approved' then raise exception 'code:invalid_status' using errcode = 'P0001'; end if;
  select decision_id into _cond from public.approval_conditions where promotion_id = _pid order by created_at desc limit 1;
  if _cond is null or (select submission_id from public.review_decisions where id = _cond) <> p.current_version_id then
    raise exception 'code:new_version_requires_review' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.approval_conditions c where c.decision_id = _cond and c.status <> 'verified') then
    raise exception 'code:conditions_unverified' using errcode = 'P0001';
  end if;
  _role := public.org_role_of(p.org_id, auth.uid());
  d := public.write_decision(p, 'approve', _role::text, 'approved', '{}', null, null,
    coalesce(nullif(trim(coalesce(_comment, '')), ''), 'final approval after verified conditions'));
  update public.promotions set review_status = 'approved', approved_at = now(), approved_version_id = current_version_id, updated_at = now()
  where id = _pid;
  perform public.log_review_event(_pid, p.current_version_id, 'decided', 'conditionally_approved', 'approved',
    jsonb_build_object('decision', 'approve', 'decision_id', d.id, 'final_after_conditions', true));
  perform public.notify_user(public.promotion_uploader(_pid), 'review_decided', p.current_version_id,
    jsonb_build_object('promotion_id', _pid, 'title', p.title, 'decision', 'approve', 'final', true));
  return d.id;
end $$;

revoke all on function public.save_condition_response(uuid, text, text[], text[]), public.submit_conditions(uuid),
  public.verify_condition(uuid, text, text), public.finalize_conditional_approval(uuid, text) from public, anon;
grant execute on function public.save_condition_response(uuid, text, text[], text[]), public.submit_conditions(uuid),
  public.verify_condition(uuid, text, text), public.finalize_conditional_approval(uuid, text) to authenticated;

-- Condition evidence files live in the private `evidence` bucket under <org>/conditions/<promotion>/…
drop policy if exists "condition evidence write" on storage.objects;
create policy "condition evidence write" on storage.objects for insert to authenticated
  with check (bucket_id = 'evidence' and (storage.foldername(name))[2] = 'conditions'
    and exists (select 1 from public.promotions p where p.id::text = (storage.foldername(name))[3] and p.org_id::text = (storage.foldername(name))[1]
                and p.review_status = 'conditionally_approved' and public.condition_uploader_side(p)));
drop policy if exists "condition evidence read" on storage.objects;
create policy "condition evidence read" on storage.objects for select to authenticated
  using (bucket_id = 'evidence' and (storage.foldername(name))[2] = 'conditions'
    and exists (select 1 from public.promotions p where p.id::text = (storage.foldername(name))[3] and public.can_read_promotion(p.id)));
grant execute on function public.condition_uploader_side(public.promotions) to authenticated;

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'check_done', 'check_failed', 'share_review', 'org_invite',
  'review_submitted', 'review_assigned', 'review_decided', 'review_escalated', 'review_legal_response', 'comment_mention',
  'claim_review_due', 'claim_expired', 'review_step_open', 'review_flow_replaced', 'risk_requested', 'risk_decided',
  'partner_access_requested', 'rereview_due', 'withdrawal_due',
  'conditions_submitted', 'condition_returned', 'partner_access_decided'));

-- ---------------------------------------------------------------------------------------------
-- 7. Partner links: scope, limits, rotation, in-account access (D174)
-- ---------------------------------------------------------------------------------------------
alter table public.partner_links
  add column if not exists campaign_id uuid null references public.campaigns(id) on delete set null,
  add column if not exists instructions_ar text null check (char_length(instructions_ar) <= 5000),
  add column if not exists expires_at timestamptz null,
  add column if not exists max_active_submissions integer not null default 5 check (max_active_submissions between 1 and 100),
  add column if not exists allowed_partner_ids uuid[] not null default '{}',
  add column if not exists allowed_communication_types text[] not null default '{}',
  add column if not exists rotated_at timestamptz null;
grant select (campaign_id, instructions_ar, expires_at, max_active_submissions, allowed_partner_ids, allowed_communication_types, rotated_at)
  on public.partner_links to authenticated;
alter table public.promotions add column if not exists partner_link_id uuid null references public.partner_links(id) on delete set null;

-- Expired links stop resolving, like disabled or rotated ones.
create or replace function public.partner_link_by_token(_token text)
returns public.partner_links language sql stable security definer set search_path = '' as $$
  select l.* from public.partner_links l
  where l.token_hash = public.partner_token_hash(_token) and l.active and (l.expires_at is null or l.expires_at > now())
    and public.org_feature(l.org_id, 'partners')
$$;
revoke all on function public.partner_link_by_token(text) from public, anon, authenticated;

-- A link opened from inside the account (no token): the caller must be an approved partner the link is assigned to.
create or replace function public.partner_link_for_me(_id uuid)
returns public.partner_links language sql stable security definer set search_path = '' as $$
  select l.* from public.partner_links l
  join public.org_members m on m.org_id = l.org_id and m.user_id = auth.uid()
  where l.id = _id and l.active and (l.expires_at is null or l.expires_at > now()) and public.org_feature(l.org_id, 'partners')
    and m.role = 'external_uploader' and m.access_status = 'active' and m.terms_accepted_at is not null
    and (cardinality(l.allowed_partner_ids) = 0 or auth.uid() = any(l.allowed_partner_ids) or m.partner_link_id = l.id)
$$;
revoke all on function public.partner_link_for_me(uuid) from public, anon, authenticated;

-- States that count toward a partner's active-submission limit: everything not finished.
create or replace function public.partner_open_states()
returns public.promotion_review_status[] language sql immutable set search_path = '' as $$
  select array['draft', 'pending_review', 'in_review', 'escalated', 'changes_requested', 'conditionally_approved',
               'reviewing_risk', 'due_for_rereview']::public.promotion_review_status[]
$$;

create or replace function public.partner_link_payload(l public.partner_links)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('ok', true, 'id', l.id,
    'org_id', l.org_id, 'org_name', (select name from public.organizations where id = l.org_id),
    'label', l.label, 'intro_ar', l.intro_ar, 'instructions_ar', l.instructions_ar, 'terms_ar', l.terms_ar,
    'channels', to_jsonb(l.allowed_channels), 'communication_types', to_jsonb(l.allowed_communication_types),
    'campaign', (select jsonb_build_object('id', c.id, 'name', c.name, 'brand', c.brand) from public.campaigns c where c.id = l.campaign_id),
    'expires_at', l.expires_at, 'max_active', l.max_active_submissions,
    'products', coalesce((select jsonb_agg(jsonb_build_object('id', pr.id, 'name_ar', pr.name_ar, 'name_en', pr.name_en, 'sector', pr.sector) order by pr.name_ar)
                          from public.products pr where pr.id = any(l.allowed_product_ids) and pr.org_id = l.org_id and pr.status <> 'archived'), '[]'::jsonb),
    'membership', (select jsonb_build_object('role', m.role, 'access_status', m.access_status, 'terms_accepted', m.terms_accepted_at is not null)
                   from public.org_members m where m.org_id = l.org_id and m.user_id = auth.uid()),
    'my_submissions', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'title', p.title, 'review_status', p.review_status, 'updated_at', p.updated_at)
                                 order by p.updated_at desc)
                                from public.promotions p where p.org_id = l.org_id and p.owner_id = auth.uid() and auth.uid() is not null), '[]'::jsonb),
    'my_active', (select count(*) from public.promotions p where p.org_id = l.org_id and p.owner_id = auth.uid()
                  and p.review_status = any(public.partner_open_states())))
$$;
revoke all on function public.partner_link_payload(public.partner_links) from public, anon, authenticated;

create or replace function public.partner_link_info(_token text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare l public.partner_links;
begin
  l := public.partner_link_by_token(_token);
  if l.id is null then return jsonb_build_object('ok', false); end if;
  return public.partner_link_payload(l);
end $$;

create or replace function public.partner_link_info_by_id(_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare l public.partner_links;
begin
  l := public.partner_link_for_me(_id);
  if l.id is null then return jsonb_build_object('ok', false); end if;
  return public.partner_link_payload(l);
end $$;

-- The partner's own links (never the token, never other partners' links).
create or replace function public.my_partner_links()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(public.partner_link_payload(l) order by l.created_at desc), '[]'::jsonb)
  from public.partner_links l
  where (public.partner_link_for_me(l.id)).id is not null
$$;

create or replace function public.partner_create_promotion_v2(_link uuid, _token text, _title text, _product uuid, _channels text[],
  _communication_type public.communication_type)
returns uuid language plpgsql security definer set search_path = '' as $$
declare l public.partner_links; _me public.org_members; _id uuid; _active int; _blocking jsonb; _sector text;
begin
  if auth.uid() is null then raise exception 'code:sign_in_required' using errcode = '42501'; end if;
  l := case when _token is not null then public.partner_link_by_token(_token) else public.partner_link_for_me(_link) end;
  if l.id is null then raise exception 'code:not_found' using errcode = 'P0001'; end if;
  select * into _me from public.org_members where org_id = l.org_id and user_id = auth.uid();
  if _me.user_id is null or _me.role <> 'external_uploader' or _me.terms_accepted_at is null then raise exception 'code:terms_required' using errcode = 'P0001'; end if;
  if cardinality(l.allowed_partner_ids) > 0 and not (auth.uid() = any(l.allowed_partner_ids)) and _me.partner_link_id is distinct from l.id then
    raise exception 'code:link_not_assigned' using errcode = '42501';
  end if;
  if _me.access_status = 'pending' and exists (select 1 from public.promotions p where p.org_id = l.org_id and p.owner_id = auth.uid()) then
    raise exception 'code:access_pending' using errcode = 'P0001';
  end if;
  if coalesce(trim(_title), '') = '' then raise exception 'code:title_required' using errcode = 'P0001'; end if;
  if _product is not null and not (_product = any(l.allowed_product_ids)) then raise exception 'code:product_not_allowed' using errcode = 'P0001'; end if;
  if cardinality(l.allowed_product_ids) > 0 and _product is null then raise exception 'code:product_required' using errcode = 'P0001'; end if;
  if cardinality(coalesce(_channels, '{}')) = 0 then raise exception 'code:channels_required' using errcode = 'P0001'; end if;
  if cardinality(l.allowed_channels) > 0 and not (_channels <@ l.allowed_channels) then raise exception 'code:channel_not_allowed' using errcode = 'P0001'; end if;
  if cardinality(l.allowed_communication_types) > 0 and not (_communication_type::text = any(l.allowed_communication_types)) then
    raise exception 'code:communication_type_not_allowed' using errcode = 'P0001';
  end if;
  -- Atomic limit: concurrent requests from the same partner in the same organisation serialise here.
  perform pg_advisory_xact_lock(hashtextextended('partner_limit:' || l.org_id::text || ':' || auth.uid()::text, 0));
  select count(*), coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'title', p.title, 'review_status', p.review_status) order by p.updated_at desc), '[]'::jsonb)
  into _active, _blocking
  from public.promotions p where p.org_id = l.org_id and p.owner_id = auth.uid() and p.review_status = any(public.partner_open_states());
  if _active >= l.max_active_submissions then
    raise exception 'code:limit_reached' using errcode = 'P0001',
      detail = jsonb_build_object('limit', l.max_active_submissions, 'active', _active, 'blocking', _blocking)::text;
  end if;
  select sector into _sector from public.products where id = _product;
  insert into public.promotions (org_id, owner_id, title, product_id, channels, communication_type, campaign_id, partner_link_id, sector)
  values (l.org_id, auth.uid(), left(trim(_title), 200), _product, _channels, _communication_type, l.campaign_id, l.id, _sector)
  returning id into _id;
  perform public.log_review_event(_id, null, 'partner_created', null, 'draft', jsonb_build_object('link_id', l.id));
  return _id;
end $$;

-- Old signature keeps working (token links).
create or replace function public.partner_create_promotion(_token text, _title text, _product uuid, _channels text[], _communication_type public.communication_type)
returns uuid language sql security definer set search_path = '' as $$
  select public.partner_create_promotion_v2(null, _token, _title, _product, _channels, _communication_type)
$$;

-- A partner (or any owner) cancels an own draft that was never submitted. History stays.
create or replace function public.cancel_draft_promotion(_pid uuid, _reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare p public.promotions;
begin
  select * into p from public.promotions where id = _pid for update;
  if p.id is null or not public.can_read_promotion(_pid) then raise exception 'code:not_found' using errcode = 'P0001'; end if;
  if p.owner_id is distinct from auth.uid() then raise exception 'code:forbidden' using errcode = '42501'; end if;
  if p.review_status <> 'draft' or p.submitted_at is not null then raise exception 'code:invalid_status' using errcode = 'P0001'; end if;
  update public.promotions set review_status = 'archived', updated_at = now() where id = _pid;
  perform public.log_review_event(_pid, p.current_version_id, 'archived', 'draft', 'archived',
    jsonb_build_object('reason', coalesce(nullif(trim(coalesce(_reason, '')), ''), 'draft_cancelled_by_owner')));
end $$;

create or replace function public.create_partner_link_v2(_org uuid, _payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare _token text := encode(extensions.gen_random_bytes(24), 'hex'); _id uuid; _products uuid[]; _partners uuid[]; _campaign uuid;
begin
  if not public.is_org_member(_org, array['owner', 'admin']::public.org_role[]) then raise exception 'code:forbidden' using errcode = '42501'; end if;
  if not public.org_feature(_org, 'partners') then raise exception 'code:feature_off' using errcode = 'P0001'; end if;
  if coalesce(trim(_payload->>'terms_ar'), '') = '' then raise exception 'code:terms_required' using errcode = 'P0001'; end if;
  if coalesce(trim(_payload->>'label'), '') = '' then raise exception 'code:label_required' using errcode = 'P0001'; end if;
  _products := coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(coalesce(_payload->'product_ids', '[]')) x), '{}');
  _partners := coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(coalesce(_payload->'partner_ids', '[]')) x), '{}');
  _campaign := nullif(_payload->>'campaign_id', '')::uuid;
  if exists (select 1 from unnest(_products) x where not exists (select 1 from public.products pr where pr.id = x and pr.org_id = _org)) then
    raise exception 'code:invalid_product' using errcode = 'P0001';
  end if;
  if exists (select 1 from unnest(_partners) x where not exists (select 1 from public.org_members m where m.org_id = _org and m.user_id = x and m.role = 'external_uploader')) then
    raise exception 'code:invalid_partner' using errcode = 'P0001';
  end if;
  if _campaign is not null and not exists (select 1 from public.campaigns c where c.id = _campaign and c.org_id = _org) then
    raise exception 'code:invalid_campaign' using errcode = 'P0001';
  end if;
  insert into public.partner_links (org_id, token_hash, label, allowed_product_ids, allowed_channels, allowed_communication_types, intro_ar,
    instructions_ar, terms_ar, created_by, campaign_id, expires_at, max_active_submissions, allowed_partner_ids)
  values (_org, public.partner_token_hash(_token), left(trim(_payload->>'label'), 200), _products,
    coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(_payload->'channels', '[]')) x), '{}'),
    coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(_payload->'communication_types', '[]')) x), '{}'),
    nullif(trim(coalesce(_payload->>'intro_ar', '')), ''), nullif(trim(coalesce(_payload->>'instructions_ar', '')), ''),
    trim(_payload->>'terms_ar'), auth.uid(), _campaign, nullif(_payload->>'expires_at', '')::timestamptz,
    coalesce(nullif(_payload->>'max_active', '')::int, 5), _partners)
  returning id into _id;
  insert into public.audit_events (actor, action, target_table, target_id, meta)
  values (auth.uid(), 'partner_link.create', 'partner_links', _id::text, jsonb_build_object('org_id', _org, 'label', _payload->>'label'));
  return jsonb_build_object('id', _id, 'token', _token);
end $$;

create or replace function public.update_partner_link(_id uuid, _payload jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare l public.partner_links; _partners uuid[]; _products uuid[];
begin
  select * into l from public.partner_links where id = _id for update;
  if l.id is null or not public.is_org_member(l.org_id, array['owner', 'admin']::public.org_role[]) then raise exception 'code:forbidden' using errcode = '42501'; end if;
  _products := case when _payload ? 'product_ids' then coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(_payload->'product_ids') x), '{}') else l.allowed_product_ids end;
  _partners := case when _payload ? 'partner_ids' then coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(_payload->'partner_ids') x), '{}') else l.allowed_partner_ids end;
  if exists (select 1 from unnest(_products) x where not exists (select 1 from public.products pr where pr.id = x and pr.org_id = l.org_id)) then
    raise exception 'code:invalid_product' using errcode = 'P0001';
  end if;
  if exists (select 1 from unnest(_partners) x where not exists (select 1 from public.org_members m where m.org_id = l.org_id and m.user_id = x and m.role = 'external_uploader')) then
    raise exception 'code:invalid_partner' using errcode = 'P0001';
  end if;
  update public.partner_links set
    label = coalesce(nullif(trim(_payload->>'label'), ''), label),
    allowed_product_ids = _products,
    allowed_partner_ids = _partners,
    allowed_channels = case when _payload ? 'channels' then coalesce((select array_agg(x) from jsonb_array_elements_text(_payload->'channels') x), '{}') else allowed_channels end,
    allowed_communication_types = case when _payload ? 'communication_types' then coalesce((select array_agg(x) from jsonb_array_elements_text(_payload->'communication_types') x), '{}') else allowed_communication_types end,
    intro_ar = case when _payload ? 'intro_ar' then nullif(trim(coalesce(_payload->>'intro_ar', '')), '') else intro_ar end,
    instructions_ar = case when _payload ? 'instructions_ar' then nullif(trim(coalesce(_payload->>'instructions_ar', '')), '') else instructions_ar end,
    expires_at = case when _payload ? 'expires_at' then nullif(_payload->>'expires_at', '')::timestamptz else expires_at end,
    max_active_submissions = coalesce(nullif(_payload->>'max_active', '')::int, max_active_submissions),
    campaign_id = case when _payload ? 'campaign_id' then (select c.id from public.campaigns c where c.id = nullif(_payload->>'campaign_id', '')::uuid and c.org_id = l.org_id) else campaign_id end
  where id = _id;
  insert into public.audit_events (actor, action, target_table, target_id, meta)
  values (auth.uid(), 'partner_link.update', 'partner_links', _id::text, jsonb_build_object('org_id', l.org_id, 'fields', (select jsonb_agg(k) from jsonb_object_keys(_payload) k)));
end $$;

-- New token; the old one stops working immediately (the raw token is never stored).
create or replace function public.rotate_partner_link(_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare l public.partner_links; _token text := encode(extensions.gen_random_bytes(24), 'hex');
begin
  select * into l from public.partner_links where id = _id for update;
  if l.id is null or not public.is_org_member(l.org_id, array['owner', 'admin']::public.org_role[]) then raise exception 'code:forbidden' using errcode = '42501'; end if;
  update public.partner_links set token_hash = public.partner_token_hash(_token), rotated_at = now() where id = _id;
  insert into public.audit_events (actor, action, target_table, target_id, meta)
  values (auth.uid(), 'partner_link.rotate', 'partner_links', _id::text, jsonb_build_object('org_id', l.org_id));
  return _token;
end $$;

-- Usage per link for admins (submissions and partner accounts), no tokens.
create or replace function public.partner_link_stats(_org uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_org_member(_org, array['owner', 'admin']::public.org_role[]) then raise exception 'code:forbidden' using errcode = '42501'; end if;
  return coalesce((select jsonb_object_agg(l.id, jsonb_build_object(
      'submissions', (select count(*) from public.promotions p where p.partner_link_id = l.id),
      'active', (select count(*) from public.promotions p where p.partner_link_id = l.id and p.review_status = any(public.partner_open_states())),
      'partners', (select count(*) from public.org_members m where m.org_id = l.org_id and m.role = 'external_uploader'
                   and (m.partner_link_id = l.id or m.user_id = any(l.allowed_partner_ids))),
      'last_submission_at', (select max(p.created_at) from public.promotions p where p.partner_link_id = l.id)))
    from public.partner_links l where l.org_id = _org), '{}'::jsonb);
end $$;

-- Partners hear about access decisions.
create or replace function public.decide_partner_access(_org uuid, _user uuid, _approve boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_org_member(_org, array['owner', 'admin']::public.org_role[]) then raise exception 'code:forbidden' using errcode = '42501'; end if;
  if not exists (select 1 from public.org_members where org_id = _org and user_id = _user and role in ('external_uploader', 'external_reviewer')) then
    raise exception 'code:not_found' using errcode = 'P0001';
  end if;
  if _approve then
    update public.org_members set access_status = 'active' where org_id = _org and user_id = _user and access_status <> 'active';
    if found then
      perform public.notify_user(_user, 'partner_access_decided', null, jsonb_build_object('org_id', _org,
        'org_name', (select name from public.organizations where id = _org), 'approved', true));
    end if;
  else
    delete from public.org_members where org_id = _org and user_id = _user;
    perform public.notify_user(_user, 'partner_access_decided', null, jsonb_build_object('org_name', (select name from public.organizations where id = _org), 'approved', false));
  end if;
  insert into public.audit_events (actor, action, target_table, target_id, meta)
  values (auth.uid(), 'partner_access', 'org_members', _user::text, jsonb_build_object('org_id', _org, 'approve', _approve));
end $$;

revoke all on function public.partner_link_info_by_id(uuid), public.my_partner_links(), public.partner_create_promotion_v2(uuid, text, text, uuid, text[], public.communication_type),
  public.cancel_draft_promotion(uuid, text), public.create_partner_link_v2(uuid, jsonb), public.update_partner_link(uuid, jsonb),
  public.rotate_partner_link(uuid), public.partner_link_stats(uuid) from public, anon;
grant execute on function public.partner_link_info_by_id(uuid), public.my_partner_links(), public.partner_create_promotion_v2(uuid, text, text, uuid, text[], public.communication_type),
  public.cancel_draft_promotion(uuid, text), public.create_partner_link_v2(uuid, jsonb), public.update_partner_link(uuid, jsonb),
  public.rotate_partner_link(uuid), public.partner_link_stats(uuid) to authenticated;
grant execute on function public.partner_link_info(text) to anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 8. Assignment: re-assigning the same reviewer is a no-op (no duplicate event or notification)
-- ---------------------------------------------------------------------------------------------
create or replace function public.assign_reviewer(_pid uuid, _user uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare p public.promotions; _role public.org_role; _target public.org_role;
begin
  select * into p from public.promotions where id = _pid for update;
  if p.id is null or p.org_id is null then raise exception 'code:not_found' using errcode = 'P0001'; end if;
  _role := public.org_role_of(p.org_id, auth.uid());
  _target := public.org_role_of(p.org_id, _user);
  if not coalesce(_role in ('owner', 'admin', 'compliance_lead'), false) then raise exception 'code:forbidden' using errcode = '42501'; end if;
  if _target is null or _target not in ('owner', 'admin', 'reviewer', 'compliance_lead') then raise exception 'code:not_a_reviewer' using errcode = 'P0001'; end if;
  if public.promotion_uploader(_pid) = _user then raise exception 'code:separation_of_duties' using errcode = '42501'; end if;
  if p.review_status not in ('pending_review', 'in_review') then raise exception 'code:invalid_status' using errcode = 'P0001'; end if;
  if p.assigned_reviewer_id = _user then return; end if;
  update public.promotions set assigned_reviewer_id = _user, updated_at = now() where id = _pid;
  perform public.log_review_event(_pid, p.current_version_id, 'assigned', p.review_status::text, p.review_status::text,
    jsonb_build_object('assignee', _user, 'previous', p.assigned_reviewer_id));
  perform public.notify_user(_user, 'review_assigned', p.current_version_id, jsonb_build_object('promotion_id', _pid, 'title', p.title));
end $$;

-- Eligible assignees for a case, with workload (owner/admin/lead only).
create or replace function public.eligible_reviewers(_pid uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare p public.promotions;
begin
  select * into p from public.promotions where id = _pid;
  if p.id is null or not coalesce(public.org_role_of(p.org_id, auth.uid()) in ('owner', 'admin', 'compliance_lead'), false) then
    raise exception 'code:forbidden' using errcode = '42501';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object('user_id', m.user_id, 'display_name', m.display_name, 'email', m.email, 'role', m.role,
      'open_cases', (select count(*) from public.promotions x where x.org_id = p.org_id and x.assigned_reviewer_id = m.user_id
                     and x.review_status in ('pending_review', 'in_review', 'escalated'))) order by m.role, coalesce(m.display_name, m.email))
    from public.org_members m
    where m.org_id = p.org_id and m.role in ('owner', 'admin', 'reviewer', 'compliance_lead')
      and m.user_id is distinct from public.promotion_uploader(_pid)), '[]'::jsonb);
end $$;
revoke all on function public.eligible_reviewers(uuid) from public, anon;
grant execute on function public.eligible_reviewers(uuid) to authenticated;
