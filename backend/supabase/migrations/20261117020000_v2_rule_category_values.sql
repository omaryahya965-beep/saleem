-- v2 Phase 2: rule categories for the financial packs and system rules. Own migration because a new enum
-- value cannot be used in the transaction that adds it.
alter type public.rule_category add value if not exists 'finance';
alter type public.rule_category add value if not exists 'securities';
alter type public.rule_category add value if not exists 'system';
