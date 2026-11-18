-- Enum values cannot be removed in Postgres. Rolling back M9 leaves 'reviewing_risk', 'risk_accepted',
-- 'due_for_rereview', 'external_uploader' and 'external_reviewer' defined but unused.
select 1;
