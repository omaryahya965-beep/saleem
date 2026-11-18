-- v2 Phase 0: the hourly media-cleanup job no longer hard-codes the project URL.
-- The URL is read at run time from the Vault secret `project_url` (the project API URL).
-- The x-cron-secret mechanism is unchanged. If `project_url` is missing the job does nothing and logs a
-- notice, instead of calling a wrong project. Takes effect only when deployed (see README, Deployment).
create or replace function public.invoke_cleanup_media()
returns void language plpgsql security definer set search_path = '' as $$
declare
  _url text := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url' limit 1);
  _secret text := (select decrypted_secret from vault.decrypted_secrets where name = 'cleanup_cron_secret' limit 1);
begin
  if _url is null or _secret is null then
    raise notice 'saleem-cleanup-media skipped: vault secret project_url or cleanup_cron_secret is missing';
    return;
  end if;
  perform net.http_post(
    url := rtrim(_url, '/') || '/functions/v1/cleanup-media',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', _secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
end $$;
revoke all on function public.invoke_cleanup_media() from public, anon, authenticated;
grant execute on function public.invoke_cleanup_media() to service_role;

select cron.unschedule(jobid) from cron.job where jobname = 'saleem-cleanup-media';
select cron.schedule('saleem-cleanup-media', '17 * * * *', 'select public.invoke_cleanup_media()');
