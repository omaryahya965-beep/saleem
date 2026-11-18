-- Rollback of 20261117030200_v2_finding_responses.sql (the table itself is dropped by the M5 rollback).
drop function if exists public.respond_finding(uuid, text, text);
drop function if exists public.response_status(text);
