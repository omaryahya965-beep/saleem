-- Run: npx supabase test db --workdir backend   (pgTAP; assertions raise inside DO blocks)
begin;
create extension if not exists pgtap with schema extensions;
select plan(1);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1', 'stuck@test.local');
insert into public.submissions (id, user_id, kind, caption, platform, product_category, status, heartbeat_at, created_at)
values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', 'text', 'x', 'x', 'other', 'analyzing',
        now() - interval '11 minutes', now() - interval '11 minutes');
do $$ begin
  perform public.fail_stuck_submissions();
  if (select error_message from public.submissions where id = '00000000-0000-0000-0000-0000000000b1') is distinct from 'code:stuck_timeout'
    then raise exception 'stuck code not written'; end if;
end $$;

select pass('watchdog writes code:stuck_timeout');
select * from finish();
rollback;
