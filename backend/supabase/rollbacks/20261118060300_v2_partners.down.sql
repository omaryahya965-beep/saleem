-- Rollback of 20261118060300_v2_partners.sql. Remove external members first: once is_org_member is restored,
-- an external_* member would count as an ordinary member again.
delete from public.org_members where role in ('external_uploader', 'external_reviewer');
drop function if exists public.decide_partner_access(uuid, uuid, boolean);
drop function if exists public.partner_create_promotion(text, text, uuid, text[], public.communication_type);
drop function if exists public.partner_join(text, boolean);
drop function if exists public.partner_link_info(text);
drop function if exists public.partner_link_by_token(text);
drop function if exists public.set_partner_link_active(uuid, boolean);
drop function if exists public.create_partner_link(uuid, text, uuid[], text[], text, text);
drop function if exists public.partner_token_hash(text);
drop policy if exists comments_external_hidden on public.comments;
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'check_done', 'check_failed', 'share_review', 'org_invite',
  'review_submitted', 'review_assigned', 'review_decided', 'review_escalated', 'review_legal_response', 'comment_mention',
  'claim_review_due', 'claim_expired', 'review_step_open', 'review_flow_replaced', 'risk_requested', 'risk_decided'));
drop table if exists public.partner_links;
alter table public.org_members drop column if exists terms_accepted_at, drop column if exists partner_link_id, drop column if exists access_status;
drop function if exists public.is_external_member(uuid);
create or replace function public.is_org_member(_org uuid, _roles public.org_role[] default null)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.org_members
    where org_id = _org and user_id = auth.uid() and (_roles is null or role = any(_roles))
  )
$$;
