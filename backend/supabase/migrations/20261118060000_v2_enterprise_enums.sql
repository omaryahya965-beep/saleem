-- v2 Phase 6 (M9): enum values for risk acceptance, re-review and external partners.
-- Own migration: a new enum value cannot be used in the transaction that adds it. Rolling back leaves them unused.
alter type public.promotion_review_status add value if not exists 'reviewing_risk';
alter type public.promotion_review_status add value if not exists 'risk_accepted';
alter type public.promotion_review_status add value if not exists 'due_for_rereview';
alter type public.org_role add value if not exists 'external_uploader';
alter type public.org_role add value if not exists 'external_reviewer';
