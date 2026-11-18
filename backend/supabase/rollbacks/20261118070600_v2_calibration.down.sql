-- Rollback of 20261118070600_v2_calibration.sql.
drop function if exists public.add_calibration_note(text, text);
drop function if exists public.calibration_report(timestamptz, timestamptz);
drop table if exists public.calibration_notes;
