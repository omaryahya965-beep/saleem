-- Rollback of 20261118060600_v2_analytics.sql.
drop function if exists public.org_metrics(uuid, timestamptz, timestamptz, jsonb);
drop function if exists public.business_days_between(timestamptz, timestamptz, integer[]);
