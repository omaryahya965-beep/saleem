-- Postgres cannot drop enum values. Rolling back M3 (which removes every row using them) is enough;
-- the unused values are harmless. Intentionally a no-op.
select 1;
