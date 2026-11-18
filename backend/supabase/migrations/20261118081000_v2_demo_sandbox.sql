-- One-click demo (broker `demo-login`). Additive. Service-role only: no client can read or write these tables.
-- demo_sandbox_orgs: organisations that are demo sandboxes (fictional data). The broker only signs in users whose
--   EVERY membership is in a sandbox org, so a demo login can never reach a real customer organisation.
-- demo_sessions: one row per demo session issued (rate limit by hashed IP, audit). No credential is stored.
create table if not exists public.demo_sandbox_orgs (
  org_id     uuid primary key references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.demo_sessions (
  id         bigint generated always as identity primary key,
  persona    text not null,
  user_id    uuid not null,
  ip_hash    text not null,
  created_at timestamptz not null default now()
);
create index if not exists demo_sessions_ip_time on public.demo_sessions (ip_hash, created_at desc);
alter table public.demo_sandbox_orgs enable row level security;
alter table public.demo_sessions enable row level security;
revoke all on public.demo_sandbox_orgs, public.demo_sessions from anon, authenticated;
grant all on public.demo_sandbox_orgs, public.demo_sessions to service_role;
