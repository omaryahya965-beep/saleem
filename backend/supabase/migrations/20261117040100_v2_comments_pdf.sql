-- v2 Phase 4 — M7 `v2_comments_pdf`: comments pinned on the asset (threads, mentions, change requests that carry
-- forward until resolved, decision notes), PDF pages as frames. Writes go through RPCs; `external` visibility is
-- reserved for Phase 6 and not readable yet.

create table if not exists public.comments (
  id                      uuid primary key default gen_random_uuid(),
  promotion_id            uuid not null references public.promotions(id) on delete cascade,
  submission_id           uuid not null references public.submissions(id) on delete cascade,
  parent_id               uuid null references public.comments(id) on delete cascade,
  author_id               uuid not null default auth.uid() references auth.users(id) on delete cascade,
  body                    text not null check (char_length(body) between 1 and 5000),
  anchor                  jsonb null,
  mentions                uuid[] not null default '{}',
  kind                    text not null default 'general' check (kind in ('general', 'change_request', 'decision_note', 'system')),
  visibility              text not null default 'internal' check (visibility in ('internal', 'external')),
  resolved_at             timestamptz null,
  resolved_by             uuid null references auth.users(id) on delete set null,
  carried_from_comment_id uuid null references public.comments(id) on delete set null,
  deleted_at              timestamptz null,
  created_at              timestamptz not null default now(),
  edited_at               timestamptz null
);
create index if not exists comments_promotion_idx on public.comments (promotion_id, submission_id, created_at);
alter table public.comments enable row level security;
grant select on public.comments to authenticated;
grant all on public.comments to service_role;
drop policy if exists comments_read on public.comments;
create policy comments_read on public.comments for select to authenticated
  using (visibility = 'internal' and public.can_read_promotion(promotion_id));

/** Anchor shapes: image {kind,x,y} · video {kind,t} · text {kind,start,end,quote} · pdf {kind,page,x,y}; ratios in [0,1]. */
create or replace function public.valid_anchor(a jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select a is null or case a->>'kind'
    when 'image' then (a->>'x')::numeric between 0 and 1 and (a->>'y')::numeric between 0 and 1
    when 'pdf' then (a->>'page')::int >= 1 and (a->>'x')::numeric between 0 and 1 and (a->>'y')::numeric between 0 and 1
    when 'video' then (a->>'t')::numeric >= 0
    when 'text' then (a->>'start')::int >= 0 and (a->>'end')::int > (a->>'start')::int
    else false end
$$;

create or replace function public.add_comment(_pid uuid, _sid uuid, _body text, _anchor jsonb default null,
  _parent uuid default null, _kind text default 'general', _mentions uuid[] default '{}')
returns uuid language plpgsql security definer set search_path = '' as $$
declare p public.promotions; _role public.org_role; _id uuid; _mentions_ok uuid[];
begin
  select * into p from public.promotions where id = _pid;
  if p.id is null or not public.can_read_promotion(_pid) or p.is_demo then raise exception 'code:not_found' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.submissions s where s.id = _sid and s.promotion_id = _pid) then raise exception 'code:not_found' using errcode = 'P0001'; end if;
  if _sid <> p.current_version_id then raise exception 'code:old_version_read_only' using errcode = 'P0001'; end if;
  if coalesce(trim(_body), '') = '' then raise exception 'code:body_required' using errcode = 'P0001'; end if;
  if _kind not in ('general', 'change_request') then raise exception 'code:invalid_kind' using errcode = 'P0001'; end if;
  _role := case when p.org_id is null then null else public.org_role_of(p.org_id, auth.uid()) end;
  if _kind = 'change_request' and (_role is null or _role not in ('owner', 'admin', 'reviewer')) then
    raise exception 'code:forbidden' using errcode = '42501';
  end if;
  if not public.valid_anchor(_anchor) then raise exception 'code:invalid_anchor' using errcode = 'P0001'; end if;
  if _parent is not null and not exists (select 1 from public.comments c where c.id = _parent and c.submission_id = _sid and c.parent_id is null) then
    raise exception 'code:invalid_parent' using errcode = 'P0001';
  end if;
  -- Only members of the promotion's organisation can be mentioned.
  _mentions_ok := array(select distinct m from unnest(coalesce(_mentions, '{}')) m
                        where p.org_id is not null and exists (select 1 from public.org_members om where om.org_id = p.org_id and om.user_id = m));
  insert into public.comments (promotion_id, submission_id, parent_id, author_id, body, anchor, mentions, kind)
  values (_pid, _sid, _parent, auth.uid(), trim(_body), _anchor, _mentions_ok, case when _parent is null then _kind else 'general' end)
  returning id into _id;
  insert into public.notifications (user_id, kind, submission_id, payload)
  select m, 'comment_mention', _sid, jsonb_build_object('promotion_id', _pid, 'title', p.title, 'comment_id', _id)
  from unnest(_mentions_ok) m where m <> auth.uid();
  return _id;
end $$;

create or replace function public.edit_comment(_id uuid, _body text)
returns void language plpgsql security definer set search_path = '' as $$
declare c public.comments;
begin
  select * into c from public.comments where id = _id;
  if c.id is null or c.author_id <> auth.uid() or c.deleted_at is not null then raise exception 'code:forbidden' using errcode = '42501'; end if;
  if c.created_at < now() - interval '15 minutes' then raise exception 'code:edit_window_closed' using errcode = 'P0001'; end if;
  if coalesce(trim(_body), '') = '' then raise exception 'code:body_required' using errcode = 'P0001'; end if;
  update public.comments set body = trim(_body), edited_at = now() where id = _id;
end $$;

create or replace function public.resolve_comment(_id uuid, _resolved boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare c public.comments; p public.promotions;
begin
  select * into c from public.comments where id = _id;
  select * into p from public.promotions where id = c.promotion_id;
  if c.id is null or c.deleted_at is not null then raise exception 'code:not_found' using errcode = 'P0001'; end if;
  if not (p.owner_id = auth.uid() or (p.org_id is not null and public.is_org_member(p.org_id, array['owner', 'admin', 'reviewer']::public.org_role[]))) then
    raise exception 'code:forbidden' using errcode = '42501';
  end if;
  update public.comments set resolved_at = case when _resolved then now() end, resolved_by = case when _resolved then auth.uid() end
  where id = _id or carried_from_comment_id = _id or id = c.carried_from_comment_id;
end $$;

create or replace function public.delete_comment(_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.comments set deleted_at = now(), body = '—' where id = _id and author_id = auth.uid() and deleted_at is null;
  if not found then raise exception 'code:forbidden' using errcode = '42501'; end if;
end $$;

revoke all on function public.add_comment(uuid, uuid, text, jsonb, uuid, text, uuid[]), public.edit_comment(uuid, text),
  public.resolve_comment(uuid, boolean), public.delete_comment(uuid) from public, anon;
grant execute on function public.add_comment(uuid, uuid, text, jsonb, uuid, text, uuid[]), public.edit_comment(uuid, text),
  public.resolve_comment(uuid, boolean), public.delete_comment(uuid) to authenticated;

-- Open change requests carry forward to a new version until a reviewer resolves them.
create or replace function public.comments_carry_change_requests()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.parent_id is null or new.promotion_id is null then return new; end if;
  insert into public.comments (promotion_id, submission_id, author_id, body, anchor, mentions, kind, carried_from_comment_id, created_at)
  select c.promotion_id, new.id, c.author_id, c.body, c.anchor, c.mentions, 'change_request', coalesce(c.carried_from_comment_id, c.id), c.created_at
  from public.comments c
  where c.submission_id = new.parent_id and c.kind = 'change_request' and c.parent_id is null
    and c.resolved_at is null and c.deleted_at is null;
  return new;
end $$;
drop trigger if exists submissions_v2_carry_comments on public.submissions;
create trigger submissions_v2_carry_comments after insert on public.submissions
  for each row execute function public.comments_carry_change_requests();

-- Decision notes: the reviewer's comment/condition appears in the conversation (system kind, not editable).
create or replace function public.comments_decision_note()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(new.comment, new.condition_ar) is not null then
    insert into public.comments (promotion_id, submission_id, author_id, body, kind)
    values (new.promotion_id, new.submission_id, new.actor_id, left(concat_ws(E'\n', new.condition_ar, new.comment), 5000), 'decision_note');
  end if;
  return new;
end $$;
drop trigger if exists review_decisions_note on public.review_decisions;
create trigger review_decisions_note after insert on public.review_decisions
  for each row execute function public.comments_decision_note();

-- PDF pages as frames: t_seconds holds the page number (NOT NULL column, D114) and page_no makes it explicit.
alter table public.frames
  add column if not exists page_no integer null check (page_no >= 1),
  add column if not exists text_source text null check (text_source in ('text_layer', 'model_ocr'));

update storage.buckets
set allowed_mime_types = array['video/mp4', 'video/quicktime', 'video/webm', 'image/jpeg', 'image/png', 'image/webp',
                               'audio/wav', 'audio/x-wav', 'audio/webm', 'application/pdf', 'application/json']
where id = 'media';
