-- UX pass: every user can read their OWN membership rows (role, status), including external partners and reviewers,
-- who cannot read the organisation's other members. Needed so the app knows a partner's role (navigation, home).
-- Additive; exposes nothing beyond the caller's own row.
drop policy if exists "members read own membership" on public.org_members;
create policy "members read own membership" on public.org_members for select to authenticated
  using (user_id = auth.uid());
