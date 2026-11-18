# 03 — Data model and migration plan

The SQL below is a **design sketch**, not paste-ready code. Before writing each migration:

1. Read the migration(s) that created every table you touch (`grep -rn "create table public.<name>"
   backend/supabase/migrations`). Match real column names, types, enums and existing helper functions
   (e.g., `can_read_submission`). Reuse helpers instead of duplicating them.
2. Name files after the latest existing timestamp, e.g. `2026MMDDHHMMSS_v2_promotions.sql`.
3. Write the matching `backend/supabase/rollbacks/<same-name>.down.sql`.
4. Apply with `npx supabase db reset --workdir backend`, run isolation tests, regenerate types.

Rules: additive only; no `drop`/`rename` of existing objects; every new table has RLS and explicit
policies; every `security definer` function has `set search_path = ''` and fully qualified names;
errors raise `code:<snake_case>` messages. `alter type … add value` goes in its **own** migration file,
applied before any migration that uses the new value (a new enum value cannot be used in the same
transaction that adds it). The helper is named `member_role` to avoid clashing with any existing
`org_role` type.

---

## Overview by phase

| Migration | Phase | Adds |
|---|---|---|
| M1 `v2_promotions` | 1 | enums, `promotions`, `submissions.promotion_id/version_no`, backfill, attach trigger, helpers, column privileges |
| M2 `v2_products_org_settings` | 1 | `products`, `org_settings` (sector, brand aliases, defaults) |
| M3 `v2_rules_sources_packs` | 2 | `regulatory_sources`, `rule_packs`, `org_rule_packs`, new `rules` columns, seeds |
| M4 `v2_findings_rule_checks` | 2 | new `findings` columns, `rule_checks`, `analysis_runs.coverage/context_snapshot` |
| M5 `v2_review` | 3 | `review_decisions`, `review_events` (or `audit_events` extension), `rejection_reasons`, `legal` role, review RPCs, org_settings review fields |
| M6 `v2_finding_responses` | 3 | new `finding_feedback` columns + status sync trigger |
| M7 `v2_comments_pdf` | 4 | `comments`, `frames.page_no`, `pdf` kind |
| M8 `v2_libraries` | 5 | `pg_trgm`, `claims`, `promotion_claims`, `disclaimers`, `saved_views`, `org_rule_overrides`, `evidence` bucket |
| M9 `v2_enterprise` | 6 | approval presets/steps, risk acceptance states, partners, `submission_assets`, variation groups, evergreen and lifecycle fields |

---

## M1 — `v2_promotions` (Phase 1)

```sql
-- Enums
create type public.promotion_review_status as enum (
  'draft','pending_review','in_review','changes_requested','conditionally_approved',
  'approved','rejected','escalated','withdrawn','archived');
create type public.communication_type as enum (
  'financial_promotion','general_commercial','creator_sponsored','internal');

-- Helpers (reuse an existing equivalent if Phase 0 found one)
create or replace function public.member_role(_org_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select m.role::text from public.org_members m
  where m.org_id = _org_id and m.user_id = auth.uid()
$$;

create table public.promotions (
  id                   uuid primary key default gen_random_uuid(),
  org_id               uuid null references public.organizations(id) on delete restrict,
  owner_id             uuid not null,                       -- match FK style used by submissions.user_id
  title                text not null check (char_length(title) between 1 and 200),
  product_id           uuid null,                            -- FK added in M2
  sector               text null,                            -- snapshot of org/product sector
  channels             text[] not null default '{}',
  communication_type   public.communication_type not null default 'creator_sponsored',
  audience             text[] not null default '{general}',
  market               text not null default 'SA',
  is_paid              boolean null,
  distribution         text null check (distribution in ('owned','paid_media','influencer')),
  creator_license_no   text null,                            -- Mawthooq licence when distribution = influencer
  caption              text null,                            -- published text, evaluated
  reviewer_notes       text null,                            -- context for reviewers, not evaluated
  campaign_id          uuid null references public.campaigns(id),
  deadline_at          timestamptz null,
  review_status        public.promotion_review_status not null default 'draft',
  current_version_id   uuid null,                            -- FK to submissions below
  assigned_reviewer_id uuid null,
  submitted_at         timestamptz null,
  first_decision_at    timestamptz null,
  approved_at          timestamptz null,
  approved_version_id  uuid null,
  tags                 text[] not null default '{}',
  is_demo              boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

alter table public.submissions
  add column if not exists promotion_id uuid null references public.promotions(id),
  add column if not exists version_no   integer null check (version_no >= 1);
create unique index if not exists submissions_promotion_version_uq
  on public.submissions(promotion_id, version_no) where promotion_id is not null;
alter table public.promotions
  add constraint promotions_current_version_fk  foreign key (current_version_id)  references public.submissions(id),
  add constraint promotions_approved_version_fk foreign key (approved_version_id) references public.submissions(id);

create index promotions_org_status_idx   on public.promotions(org_id, review_status);
create index promotions_owner_idx        on public.promotions(owner_id);
create index promotions_reviewer_idx     on public.promotions(assigned_reviewer_id, review_status);
create index promotions_deadline_idx     on public.promotions(deadline_at) where deadline_at is not null;
```

### Backfill (idempotent; every existing re-check chain becomes one promotion)

```sql
create temporary table _v2_chain as
with recursive chain as (
  select s.id as submission_id, s.id as root_id, s.created_at
  from public.submissions s where s.parent_id is null and s.promotion_id is null
  union all
  select c.id, ch.root_id, c.created_at
  from public.submissions c join chain ch on c.parent_id = ch.submission_id
)
select submission_id, root_id,
       row_number() over (partition by root_id order by created_at, submission_id) as version_no
from chain;

create temporary table _v2_roots as
select root_id, gen_random_uuid() as promotion_id from (select distinct root_id from _v2_chain) r;

insert into public.promotions (id, org_id, owner_id, title, campaign_id, communication_type, is_demo, created_at)
select r.promotion_id, s.org_id, s.user_id,
       coalesce(nullif(<existing title/name expression>, ''), 'إعلان ' || to_char(s.created_at, 'YYYY-MM-DD')),
       s.campaign_id, 'creator_sponsored', coalesce(s.is_demo, false), s.created_at
from _v2_roots r join public.submissions s on s.id = r.root_id;

update public.submissions s
   set promotion_id = r.promotion_id, version_no = c.version_no
  from _v2_chain c join _v2_roots r on r.root_id = c.root_id
 where s.id = c.submission_id;

update public.promotions p set current_version_id = x.id
  from (select distinct on (promotion_id) promotion_id, id
          from public.submissions where promotion_id is not null
         order by promotion_id, version_no desc) x
 where p.id = x.promotion_id;

drop table _v2_chain; drop table _v2_roots;
```

Map any existing context columns (platform, paid flag, product category — find them in `submissions`
or its metadata) into `promotions.channels`, `is_paid`, etc. Do **not** invent review decisions for
legacy data: every legacy promotion stays `draft`. Legacy `share_reviews` remain visible in the history.

### Attach trigger (old client code keeps working)

Name it so it fires **after** the existing `submissions_force_initial_state` trigger (Postgres fires
same-timing triggers alphabetically), e.g. `submissions_v2_attach_promotion`.

```sql
create or replace function public.submissions_v2_attach_promotion()
returns trigger language plpgsql security definer set search_path = '' as $$
declare _pid uuid; _next int; _prev uuid;
begin
  _pid := new.promotion_id;
  if _pid is null and new.parent_id is not null then
    select s.promotion_id into _pid from public.submissions s where s.id = new.parent_id;
  end if;
  if _pid is null then
    insert into public.promotions (owner_id, org_id, campaign_id, title, is_demo)
    values (new.user_id, new.org_id, new.campaign_id, 'إعلان جديد', coalesce(new.is_demo, false))
    returning id into _pid;
  end if;
  if not exists (
    select 1 from public.promotions p
    where p.id = _pid
      and (p.owner_id = new.user_id
           or (p.org_id is not null and public.member_role(p.org_id) in ('owner','admin','creator')))
  ) then
    raise exception 'code:promotion_forbidden';
  end if;
  perform 1 from public.promotions where id = _pid for update;   -- serialise version numbers
  select coalesce(max(version_no), 0) + 1 into _next from public.submissions where promotion_id = _pid;
  if new.parent_id is null and _next > 1 then
    select id into _prev from public.submissions where promotion_id = _pid and version_no = _next - 1;
    new.parent_id := _prev;                                         -- keeps the existing re-check comparison working
  end if;
  new.promotion_id := _pid;
  new.version_no := _next;
  return new;
end $$;

create trigger submissions_v2_attach_promotion before insert on public.submissions
for each row execute function public.submissions_v2_attach_promotion();

create or replace function public.submissions_v2_set_current()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.promotions set current_version_id = new.id, updated_at = now() where id = new.promotion_id;
  return new;
end $$;
create trigger submissions_v2_set_current after insert on public.submissions
for each row execute function public.submissions_v2_set_current();
```

Rule: a new version may only be added while `review_status ∈ {draft, changes_requested, rejected,
conditionally_approved}` (raise `code:promotion_locked` otherwise). Approved promotions need a new
promotion, or (Phase 6) a re-review flow.

### RLS and privileges

```sql
alter table public.promotions enable row level security;

create or replace function public.can_read_promotion(_pid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.promotions p
    where p.id = _pid
      and (p.is_demo
           or p.owner_id = auth.uid()
           or (p.org_id is not null and public.member_role(p.org_id) is not null))
  )
$$;

create policy promotions_select on public.promotions for select to authenticated
  using (public.can_read_promotion(id));
create policy promotions_insert on public.promotions for insert to authenticated
  with check (owner_id = auth.uid()
              and (org_id is null or public.member_role(org_id) in ('owner','admin','creator')));
create policy promotions_update_context on public.promotions for update to authenticated
  using ((owner_id = auth.uid() or public.member_role(org_id) in ('owner','admin'))
         and review_status in ('draft','changes_requested','rejected','conditionally_approved'))
  with check (true);

-- Column privileges: review fields are writable only by security definer RPCs.
revoke update on public.promotions from authenticated;
grant update (title, product_id, channels, communication_type, audience, market, is_paid,
              distribution, creator_license_no, caption, reviewer_notes, campaign_id,
              deadline_at, tags) on public.promotions to authenticated;
```

Also update `can_read_submission` (or the submissions select policy) so that reading a submission is
allowed when `can_read_promotion(promotion_id)` is true — and confirm existing behaviour is unchanged
with tests.

---

## M2 — `v2_products_org_settings` (Phase 1)

```sql
create table public.products (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  name_ar       text not null check (char_length(name_ar) between 1 and 120),
  name_en       text null,
  aliases       text[] not null default '{}',
  sector        text not null check (sector in ('banking','finance_company','payments','capital_market','insurance','other')),
  product_type  text not null,                         -- list in 02_SAUDI_RULES.md §4
  regulator     text not null check (regulator in ('SAMA','CMA','IA','other')),
  currency      text not null default 'SAR',
  key_facts     jsonb not null default '{}'::jsonb,    -- validated in code, schema below
  status        text not null default 'draft' check (status in ('draft','approved','archived')),
  approved_by   uuid null, approved_at timestamptz null,
  version       integer not null default 1,
  supersedes_id uuid null references public.products(id),
  created_by    uuid not null default auth.uid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index products_org_idx on public.products(org_id, status);
alter table public.promotions add constraint promotions_product_fk foreign key (product_id) references public.products(id);
alter table public.products enable row level security;
create policy products_select on public.products for select to authenticated using (public.member_role(org_id) is not null);
create policy products_write  on public.products for all    to authenticated
  using (public.member_role(org_id) in ('owner','admin')) with check (public.member_role(org_id) in ('owner','admin'));
```

`key_facts` shape (validate with a TypeScript schema shared by frontend and functions):

```jsonc
{
  "apr": { "value": 4.5, "type": "fixed" | "variable" | null },   // percent
  "term_months": { "min": 6, "max": 60 },
  "fees": [ { "name_ar": "رسوم إدارية", "amount": 1, "unit": "percent" | "SAR", "cap_sar": 5000, "vat_included": true } ],
  "min_requirements_ar": ["تحويل الراتب"],
  "target_customers_ar": ["الموظفون السعوديون"],
  "sharia_compliant": true,
  "sharia_approval_ref": "قرار الهيئة الشرعية رقم …" | null
}
```

Only `approved` products are used for fact matching; draft products produce a `unable_to_verify` rule
check with reason `product_not_approved`.

```sql
create table public.org_settings (
  org_id                      uuid primary key references public.organizations(id) on delete cascade,
  sector                      text null check (sector in ('banking','finance_company','payments','capital_market','insurance','other')),
  brand_aliases               text[] not null default '{}',
  review_sla_business_days    integer not null default 3 check (review_sla_business_days between 1 and 30),
  weekend_days                integer[] not null default '{5,6}',      -- ISO dow: Friday=5, Saturday=6
  require_uploader_responses  boolean not null default true,
  require_reviewer_responses  boolean not null default true,
  media_retention             jsonb not null default '{"unsubmitted_hours":24,"submitted":"retain","approved":"retain"}',
  hide_comments_from_external boolean not null default false,
  features                    jsonb not null default '{}'::jsonb,     -- P2/P3 flags
  updated_by                  uuid null,
  updated_at                  timestamptz not null default now()
);
alter table public.org_settings enable row level security;
create policy org_settings_select on public.org_settings for select to authenticated using (public.member_role(org_id) is not null);
create policy org_settings_write  on public.org_settings for update to authenticated
  using (public.member_role(org_id) in ('owner','admin')) with check (public.member_role(org_id) in ('owner','admin'));
-- insert a default row for every existing organisation, and for new ones via trigger on organizations
```

---

## M3 — `v2_rules_sources_packs` (Phase 2)

```sql
create table public.regulatory_sources (
  id                text primary key,
  authority         text not null check (authority in ('SAMA','CMA','IA','MC','GMEDIA','SDAIA','INTERNAL')),
  title_ar          text not null, title_en text null,
  identifiers       text null,                  -- number, Hijri/Gregorian dates, amendment refs
  url               text not null,
  status            text not null check (status in ('in_force','guideline','draft','superseded','unknown')),
  verification      text not null check (verification in ('official_text_opened','official_status_unconfirmed','secondary_only')),
  verified_at       timestamptz null, verified_by text null, notes text null
);
create table public.rule_packs (
  code            text primary key,
  authority       text not null,
  name_ar         text not null, name_en text not null,
  description_ar  text null,
  default_sectors text[] not null default '{}',
  enabled_by_default boolean not null default true
);
create table public.org_rule_packs (
  org_id               uuid not null references public.organizations(id) on delete cascade,
  pack_code            text not null references public.rule_packs(code),
  enabled              boolean not null default true,
  include_draft_rules  boolean not null default false,
  updated_by uuid null, updated_at timestamptz not null default now(),
  primary key (org_id, pack_code)
);

alter table public.rules
  add column if not exists pack                  text null references public.rule_packs(code),
  add column if not exists regulatory_source_id  text null references public.regulatory_sources(id),
  add column if not exists article_ref           text null,
  add column if not exists additional_citations  jsonb not null default '[]'::jsonb,
  add column if not exists official_text_ar      text null,
  add column if not exists title_ar              text null,
  add column if not exists summary_ar            text null,
  add column if not exists summary_en            text null,
  add column if not exists applicability         jsonb not null default '{}'::jsonb,
  add column if not exists content_triggers      text[] not null default '{}',
  add column if not exists check_type            text null check (check_type in ('deterministic','llm','hybrid','workflow')),
  add column if not exists deterministic_check   text null,
  add column if not exists finding_type_on_fail  text null,
  add column if not exists review_state          text not null default 'active'
                           check (review_state in ('draft','legal_review','active','archived')),
  add column if not exists legal_reviewed_by     text null,
  add column if not exists legal_reviewed_at     timestamptz null,
  add column if not exists change_reason         text null,
  add column if not exists supersedes_rule_id    uuid null references public.rules(id);
```

`review_state` defaults to `active` so the existing 12 rules keep running. New SAMA/CMA rules are
inserted with `review_state = 'draft'`. RLS: everyone authenticated can read sources/packs/rules (rules
already readable); only platform admins (`user_roles.role = 'admin'`) write; org admins write their own
`org_rule_packs` rows. Seeds come from `02_SAUDI_RULES.md` (§2 sources, §3 packs, §5–6 rules) — follow
the existing rulebook-version mechanism (read how `seed.sql` and the rulebook admin create versions) to
publish a new rulebook release that contains the old rules plus the drafts.

---

## M4 — `v2_findings_rule_checks` (Phase 2)

```sql
alter table public.findings
  add column if not exists rule_id                   uuid null references public.rules(id),
  add column if not exists finding_type              text null check (finding_type in
      ('confirmed_mismatch','potential_risk','missing_required','needs_evidence','unable_to_verify')),
  add column if not exists location                  jsonb null,
  add column if not exists evidence_text             text null,
  add column if not exists explanation_ar            text null,
  add column if not exists explanation_en            text null,
  add column if not exists missing_information_ar    text null,
  add column if not exists suggested_fix_ar          text null,   -- reuse the existing suggested-fix column if there is one
  add column if not exists citation                  jsonb null,  -- {rule_code, rule_id, source_id, article_ref, review_state}
  add column if not exists rule_draft                boolean not null default false,
  add column if not exists carried_from_finding_id   uuid null references public.findings(id),
  add column if not exists resolved_in_submission_id uuid null references public.submissions(id),
  add column if not exists status                    text not null default 'open'
      check (status in ('open','actioned','disputed','dismissed','not_required','resolved'));
create index if not exists findings_submission_status_idx on public.findings(submission_id, status);
create index if not exists findings_rule_idx on public.findings(rule_id);

create table public.rule_checks (
  id            bigint generated always as identity primary key,
  run_id        uuid not null references public.analysis_runs(id) on delete cascade,
  submission_id uuid not null references public.submissions(id) on delete cascade,
  rule_id       uuid not null references public.rules(id),
  outcome       text not null check (outcome in ('passed','failed','not_applicable','unable_to_verify')),
  reason_code   text null,            -- e.g. context:product_type, trigger_absent:mentions_free, coverage:no_audio, pack_not_available
  finding_ids   uuid[] not null default '{}',
  created_at    timestamptz not null default now(),
  unique (run_id, rule_id)
);
create index rule_checks_submission_idx on public.rule_checks(submission_id);
alter table public.rule_checks enable row level security;
create policy rule_checks_select on public.rule_checks for select to authenticated
  using (public.can_read_submission(submission_id));          -- or the promotion-based equivalent
-- writes only from the analyze function (service role)

alter table public.analysis_runs
  add column if not exists coverage         jsonb null,   -- {status:'complete'|'partial', items:[{modality, state, detail_code}]}
  add column if not exists context_snapshot jsonb null;   -- the AnalysisContext used for this run
```

Legacy findings keep `finding_type = null`; the UI shows them with the legacy label «ملاحظة (إصدار
سابق من المحرك)». Do not guess types for legacy rows.

---

## M5 — `v2_review` (Phase 3)

```sql
-- Role: check whether org_members.role is an enum or text+check; add 'legal' accordingly.
alter type public.org_role_enum add value if not exists 'legal';   -- adapt to the real type name

create table public.rejection_reasons (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid null references public.organizations(id) on delete cascade,  -- null = platform default
  kind       text not null check (kind in ('promotion','claim')),
  label_ar   text not null, label_en text not null,
  is_default boolean not null default false,
  archived   boolean not null default false,
  sort_order integer not null default 100
);
-- seed platform defaults (05_UX_SPEC.md §6.6)

create table public.review_decisions (
  id                 uuid primary key default gen_random_uuid(),
  promotion_id       uuid not null references public.promotions(id),
  submission_id      uuid not null references public.submissions(id),
  decision           text not null check (decision in
                     ('approve','conditional_approve','request_changes','reject','escalate','legal_response')),
  actor_id           uuid not null,
  actor_role         text not null,
  reason_ids         uuid[] not null default '{}',
  reason_other       text null,
  condition_ar       text null,
  comment            text null,
  from_status        public.promotion_review_status not null,
  to_status          public.promotion_review_status not null,
  findings_snapshot  jsonb not null,   -- [{finding_id, rule_code, finding_type, status, last_response}]
  asset_sha256       text not null,
  rulebook_version_id uuid null,
  prev_hash          text null,
  hash               text not null,
  created_at         timestamptz not null default now()
);
create index review_decisions_promotion_idx on public.review_decisions(promotion_id, created_at);

create or replace function public.forbid_mutation() returns trigger language plpgsql as $$
begin raise exception 'code:immutable_record'; end $$;
create trigger review_decisions_immutable before update or delete on public.review_decisions
for each row execute function public.forbid_mutation();

-- Events: prefer extending audit_events if Phase 0 found a generic, append-only shape; otherwise:
create table public.review_events (
  id            bigint generated always as identity primary key,
  org_id        uuid null,
  promotion_id  uuid not null references public.promotions(id),
  submission_id uuid null references public.submissions(id),
  event_type    text not null,   -- created, version_added, analysis_done, analysis_failed, submitted, opened,
                                 -- decided, escalated, legal_responded, assigned, archived, withdrawn, sla_breached
  actor_id      uuid null,
  from_status   text null, to_status text null,
  payload       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index review_events_promotion_idx on public.review_events(promotion_id, created_at);
create index review_events_org_type_idx  on public.review_events(org_id, event_type, created_at);
create trigger review_events_immutable before update or delete on public.review_events
for each row execute function public.forbid_mutation();
```

Decision hash (mirror how `compute_report_hash` uses pgcrypto; `jsonb::text` has deterministic key order):

```sql
create or replace function public.decision_hash(_prev text, _payload jsonb)
returns text language sql immutable set search_path = '' as $$
  select encode(extensions.digest(convert_to(coalesce(_prev, '') || '|' || _payload::text, 'UTF8'), 'sha256'), 'hex')
$$;
```

Payload = `{promotion_id, submission_id, decision, actor_id, actor_role, reason_ids, condition_ar,
from_status, to_status, asset_sha256, rulebook_version_id, findings_snapshot, created_at}`.
`verify_decision_chain(_promotion_id)` recomputes the chain and returns `{valid, broken_at}`.

### Review RPCs (all `security definer`, `set search_path = ''`, raise `code:*` errors)

| Function | Effect | Key checks |
|---|---|---|
| `can_submit(_pid) returns jsonb` | `{ok, reasons[]}` preflight for the UI | same checks as submit, no writes |
| `submit_promotion(_pid, _note)` | → `pending_review`, sets `submitted_at` on first submit, event | caller can upload; analysis `done` (or `failed` acknowledged → event payload flag); uploader responses complete if required; version newer than last decided version (except `changes_requested`) |
| `open_review(_pid)` | `pending_review` → `in_review`; assigns caller if unassigned | caller is reviewer/admin/owner; not uploader of current version |
| `assign_reviewer(_pid, _user)` | set `assigned_reviewer_id`, event, notification | admin/owner, or reviewer self-assign; target is a reviewer-capable member |
| `can_decide(_pid) returns jsonb` | preflight | — |
| `decide_promotion(_pid, _decision, _reason_ids, _reason_other, _condition, _comment)` | writes decision with hash chain, updates promotion (`first_decision_at`, `approved_at`, `approved_version_id`), event, notification | status `in_review`; separation of duties; reasons for reject/request_changes; condition for conditional; reviewer responses complete if required |
| `escalate_promotion(_pid, _legal_user, _question)` | → `escalated`, decision row `escalate` | target has role `legal` |
| `respond_escalation(_pid, _response)` | → `in_review`, decision row `legal_response` | caller is the chosen legal user |
| `archive_promotion(_pid, _reason)` | → `archived` | owner/admin; not from `approved` in P1 (use withdraw in Phase 6) |

Add the review fields to `org_settings` defaults if not added in M2. Update `cleanup-media` to respect
`media_retention` (never delete media of org versions that were submitted or approved; personal creators
keep the 24 h rule).

---

## M6 — `v2_finding_responses` (Phase 3)

```sql
alter table public.finding_feedback
  add column if not exists action        text null check (action in
      ('agree_will_action','dispute','reply','agree_please_action','not_required','dismiss')),
  add column if not exists actor_role    text null check (actor_role in ('uploader','reviewer')),
  add column if not exists comment       text null,
  add column if not exists submission_id uuid null references public.submissions(id);
```

Trigger after insert: update `findings.status` — uploader `agree_will_action` → `actioned`, `dispute` →
`disputed`; reviewer `agree_please_action` → `actioned`, `not_required` → `not_required`, `dismiss` →
`dismissed`; a reviewer response always overrides an uploader response. Require `comment` for `dispute`,
`not_required`, `dismiss` (check constraint or RPC). Keep the existing columns and UI behaviour working.

---

## M7 — `v2_comments_pdf` (Phase 4)

```sql
create table public.comments (
  id                      uuid primary key default gen_random_uuid(),
  promotion_id            uuid not null references public.promotions(id),
  submission_id           uuid not null references public.submissions(id),
  parent_id               uuid null references public.comments(id),
  author_id               uuid not null default auth.uid(),
  body                    text not null check (char_length(body) between 1 and 5000),
  anchor                  jsonb null,  -- {kind:'image',x,y} | {kind:'video',t} | {kind:'text',start,end,quote} | {kind:'pdf',page,x,y}
  mentions                uuid[] not null default '{}',
  kind                    text not null default 'general' check (kind in ('general','change_request','decision_note','system')),
  visibility              text not null default 'internal' check (visibility in ('internal','external')),
  resolved_at             timestamptz null, resolved_by uuid null,
  carried_from_comment_id uuid null references public.comments(id),
  deleted_at              timestamptz null,
  created_at              timestamptz not null default now(),
  edited_at               timestamptz null
);
create index comments_promotion_idx on public.comments(promotion_id, submission_id, created_at);
alter table public.comments enable row level security;
-- select: can_read_promotion(promotion_id) and (visibility = 'internal' → org members only)
-- insert: author_id = auth.uid() and can_read_promotion(promotion_id)
-- update: author edits body (sets edited_at); reviewers/owner resolve; soft delete only

alter table public.frames add column if not exists page_no integer null;   -- PDF pages
-- extend submissions.kind (enum or check) with 'pdf'
```

---

## M8 — `v2_libraries` (Phase 5)

```sql
create extension if not exists pg_trgm with schema extensions;

create table public.claims (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organizations(id) on delete cascade,
  claim_key        uuid not null default gen_random_uuid(),   -- stable across versions
  version          integer not null default 1,
  supersedes_id    uuid null references public.claims(id),
  name             text not null,
  text_ar          text not null, text_en text null,
  normalized_text  text not null,                              -- normalizeArabic + digit normalisation
  numbers          jsonb not null default '[]'::jsonb,         -- extracted numbers with units
  product_ids      uuid[] not null default '{}',
  channels         text[] not null default '{}',
  communication_types text[] not null default '{}',
  substantiation   jsonb not null default '[]'::jsonb,         -- [{kind:'file',path}|{kind:'url',url,title}]
  status           text not null default 'draft' check (status in
                   ('draft','pending_review','approved','rejected','changes_requested','expired','archived')),
  next_review_at   date null, expires_at date null,
  reviewed_by      uuid null, reviewed_at timestamptz null,
  created_by       uuid not null default auth.uid(),
  created_at       timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (org_id, claim_key, version)
);
create index claims_trgm_idx on public.claims using gin (normalized_text extensions.gin_trgm_ops);

create table public.promotion_claims (
  promotion_id uuid not null references public.promotions(id),
  claim_id     uuid not null references public.claims(id),
  link_source  text not null check (link_source in ('manual','auto','finding_fix')),
  linked_by    uuid null, linked_at timestamptz not null default now(),
  primary key (promotion_id, claim_id)
);

create table public.disclaimers (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid null references public.organizations(id) on delete cascade,  -- null = platform template
  disclaimer_key   uuid not null default gen_random_uuid(),
  version          integer not null default 1,
  supersedes_id    uuid null references public.disclaimers(id),
  text_ar          text not null, text_en text null,
  normalized_text  text not null,
  product_types    text[] not null default '{}',
  channels         text[] not null default '{}',
  communication_types text[] not null default '{}',
  required_by_rule_codes text[] not null default '{}',
  check_prominence boolean not null default false,
  status           text not null default 'active' check (status in ('draft','active','archived')),
  created_by       uuid not null default auth.uid(),
  created_at       timestamptz not null default now()
);

create table public.saved_views (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid null, owner_id uuid not null default auth.uid(),
  scope      text not null check (scope in ('promotions','queue','claims')),
  name       text not null, filters jsonb not null, shared boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.org_rule_overrides (     -- org narrows a rule's scope; never changes logic
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  rule_code  text not null,
  applicability_patch jsonb not null,        -- may only add exclusions / narrow lists
  reason     text not null,
  created_by uuid not null default auth.uid(), created_at timestamptz not null default now(),
  archived_at timestamptz null
);
```

Storage: create a private bucket `evidence` for claim substantiation with object paths
`{org_id}/claims/{claim_id}/{file}` and storage RLS that mirrors `claims` access. The media cleanup job
must never touch this bucket.

---

## M9 — `v2_enterprise` (Phase 6)

```sql
alter type public.promotion_review_status add value if not exists 'reviewing_risk';
alter type public.promotion_review_status add value if not exists 'risk_accepted';
alter type public.promotion_review_status add value if not exists 'due_for_rereview';

create table public.approval_presets (id uuid pk, org_id uuid not null, name text not null,
  mode text not null check (mode in ('sequential','parallel')), is_default boolean default false,
  active boolean default true, created_at timestamptz default now());
create table public.approval_preset_steps (id uuid pk, preset_id uuid not null references approval_presets(id),
  position integer not null, role text null, user_ids uuid[] not null default '{}', label_ar text not null);
create table public.preset_auto_apply (org_id uuid, market text, product_type text null, preset_id uuid,
  primary key (org_id, market, coalesce(product_type,'*')));   -- adapt (expression PK not allowed; use unique index)
create table public.promotion_review_steps (id uuid pk, promotion_id uuid not null, submission_id uuid not null,
  step_no integer not null, assignee_ids uuid[] not null, status text not null check (status in
  ('waiting','open','approved','changes_requested','rejected','skipped','carried_forward')),
  decided_by uuid null, decided_at timestamptz null, decision_id uuid null references review_decisions(id));

alter table public.org_members add column if not exists can_accept_risk boolean not null default false;
alter table public.promotions
  add column if not exists evergreen          boolean not null default false,
  add column if not exists next_review_at     date null,
  add column if not exists published_at       timestamptz null,
  add column if not exists withdrawn_at       timestamptz null,
  add column if not exists withdrawal_reason  text null,
  add column if not exists withdrawal_due_at  timestamptz null,   -- e.g., one Saudi business day after a regulator request
  add column if not exists upload_type        text not null default 'single'
                           check (upload_type in ('single','carousel','variations','batch')),
  add column if not exists variation_group_id uuid null;

create table public.submission_assets (id uuid pk, submission_id uuid not null references submissions(id),
  position integer not null, kind text not null, file_path text not null, sha256 text not null,
  width integer null, height integer null, duration_s numeric null, page_count integer null);
alter table public.frames add column if not exists asset_id uuid null references public.submission_assets(id);

create table public.partner_links (id uuid pk, org_id uuid not null, token_hash text not null unique,
  label text, allowed_product_ids uuid[] default '{}', allowed_channels text[] default '{}',
  intro_ar text null, active boolean default true, created_by uuid, created_at timestamptz default now());
-- org_members role values: add 'external_uploader', 'external_reviewer'
```

Design each Phase 6 table's RLS in the phase plan; external users only ever see promotions they
submitted (uploader) or were explicitly assigned (reviewer).

---

## Rollback policy

Each `.down.sql` drops, in reverse order, only what its migration created: policies, triggers,
functions, indexes, tables, then `alter table … drop column if exists` for added columns, then types.
Enum values cannot be removed: rolling back M9 leaves extra enum values unused (document this). Test a
rollback once per phase on a local database: apply → seed → down → re-apply.
