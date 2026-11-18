-- v2 Phase 8 (step 5): two new organisation roles. Enum values must be committed before use, hence a separate migration.
alter type public.org_role add value if not exists 'compliance_lead';
alter type public.org_role add value if not exists 'viewer';
