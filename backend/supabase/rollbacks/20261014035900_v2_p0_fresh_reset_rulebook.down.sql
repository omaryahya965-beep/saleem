-- Rollback: nothing to undo safely. The row may be referenced by rules and analysis runs, and on the
-- hosted project the migration inserted nothing. Intentionally a no-op.
select 1;
