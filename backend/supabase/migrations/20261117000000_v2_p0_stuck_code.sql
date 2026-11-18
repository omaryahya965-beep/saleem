-- v2 Phase 0: the watchdog stores an error code the UI translates (Arabic/English) instead of literal
-- Arabic text. Same signature, same grants, same schedule. Existing rows keep their old message (the UI
-- shows legacy plain text as-is).
create or replace function public.fail_stuck_submissions()
returns int language plpgsql security definer set search_path = public as $$
declare _n int;
begin
  update public.submissions
  set status = 'failed',
      error_message = 'code:stuck_timeout'
  where status in ('queued', 'extracting', 'transcribing', 'analyzing')
    and coalesce(heartbeat_at, created_at) < now() - interval '10 minutes'
    and not is_demo;
  get diagnostics _n = row_count;
  return _n;
end $$;
revoke all on function public.fail_stuck_submissions() from public, anon, authenticated;
