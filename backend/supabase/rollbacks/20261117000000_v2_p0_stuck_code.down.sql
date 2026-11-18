-- Restores the previous watchdog body (literal message) from 20261014030000_quality.sql.
create or replace function public.fail_stuck_submissions()
returns int language plpgsql security definer set search_path = public as $$
declare _n int;
begin
  update public.submissions
  set status = 'failed',
      error_message = 'توقف الفحص دون استجابة. أعد المحاولة. (worker timeout)'
  where status in ('queued', 'extracting', 'transcribing', 'analyzing')
    and coalesce(heartbeat_at, created_at) < now() - interval '10 minutes'
    and not is_demo;
  get diagnostics _n = row_count;
  return _n;
end $$;
revoke all on function public.fail_stuck_submissions() from public, anon, authenticated;
