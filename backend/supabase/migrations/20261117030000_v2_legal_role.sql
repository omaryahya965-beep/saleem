-- v2 Phase 3: the `legal` organisation role (answers escalations). Own migration: a new enum value cannot be
-- used in the transaction that adds it.
alter type public.org_role add value if not exists 'legal';
