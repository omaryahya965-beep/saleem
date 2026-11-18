-- v2 Phase 0: make a fresh `supabase db reset` work.
-- 20261014040000_demo_pipeline_pair.sql selects the active rulebook version, which on a fresh database
-- only exists after seed.sql runs (seed runs after all migrations), so its inserts failed on the
-- findings → analysis_runs foreign key. This migration creates the same v1 rulebook row seed.sql uses,
-- only when no version exists. On the hosted project the row already exists, so this is a no-op there.
-- Additive and idempotent. Note: its timestamp precedes migrations already applied remotely, so a later
-- deploy needs `supabase db push --include-all` (see docs/DECISIONS.md D71).
insert into public.rulebook_versions (id, version_label, notes, is_active, status, published_at, effective_from)
select '11111111-1111-1111-1111-111111111111', '2026.10-a',
       'Illustrative – pending legal review / توضيحية – بانتظار المراجعة القانونية', true, 'published', now(), current_date
where not exists (select 1 from public.rulebook_versions);
