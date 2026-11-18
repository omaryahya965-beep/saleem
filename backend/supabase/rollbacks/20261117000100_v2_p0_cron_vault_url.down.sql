-- Rollback: reschedule the job exactly as 20261014000000_pipeline_hardening.sql did (hard-coded URL)
-- and drop the helper. Only use if the Vault-based job cannot be configured.
select cron.unschedule(jobid) from cron.job where jobname = 'saleem-cleanup-media';
select cron.schedule(
  'saleem-cleanup-media',
  '17 * * * *',
  $cron$
  select net.http_post(
    url := 'https://oxspzxtxvtwswdjqfful.supabase.co/functions/v1/cleanup-media',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cleanup_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $cron$
);
drop function if exists public.invoke_cleanup_media();
