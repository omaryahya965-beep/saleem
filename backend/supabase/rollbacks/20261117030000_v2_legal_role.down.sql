-- Postgres cannot drop an enum value. Before rolling back M5, reassign legal members:
--   update public.org_members set role = 'reviewer' where role = 'legal';
select 1;
