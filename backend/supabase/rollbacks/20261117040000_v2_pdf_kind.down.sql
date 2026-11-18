-- Postgres cannot drop an enum value; PDF rows must be deleted first if a rollback is ever needed.
select 1;
