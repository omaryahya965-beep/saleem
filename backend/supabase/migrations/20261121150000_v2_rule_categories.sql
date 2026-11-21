-- V2 completion §7 — Company Rules categories (D200). Internal organisational policies are grouped by what they
-- govern (compliance policy, approved language, prohibited claims, brand guidelines, logo, brand colours, required
-- disclosures). The category is descriptive: it never turns an internal rule into a Saudi regulatory requirement and
-- does not change the approval workflow (drafts stay drafts until a second person approves). Existing rows keep
-- working with the default category; AI/heuristic drafts get a keyword guess the editor can change before approval.
alter table public.internal_rules add column if not exists category text not null default 'compliance_policy';
alter table public.internal_rules drop constraint if exists internal_rules_category_check;
alter table public.internal_rules add constraint internal_rules_category_check check (category in (
  'compliance_policy', 'approved_language', 'prohibited_claim', 'brand_guideline', 'logo', 'brand_colors', 'required_disclosure'));
alter table public.internal_rule_versions add column if not exists category text;

create or replace function public.guess_rule_category(_title text, _instruction text)
returns text language sql immutable set search_path = '' as $$
  select case
    when t ~ '(شعار|لوقو|لوغو|logo)' then 'logo'
    when t ~ '(لون|ألوان|الوان|colou?r|hex|#[0-9a-f]{6})' then 'brand_colors'
    when t ~ '(إفصاح|افصاح|إعلان مدفوع|اعلان مدفوع|إخلاء|اخلاء|disclos|disclaimer)' then 'required_disclosure'
    when t ~ '(يمنع|يُمنع|ممنوع|لا يجوز|يحظر|يُحظر|محظور|prohibit|must not|never)' then 'prohibited_claim'
    when t ~ '(عبارة معتمدة|العبارات المعتمدة|صياغة معتمدة|approved (wording|language|phrase))' then 'approved_language'
    when t ~ '(الهوية|هوية العلامة|نبرة|brand|tone)' then 'brand_guideline'
    else 'compliance_policy' end
  from (select lower(coalesce(_title, '') || ' ' || coalesce(_instruction, '')) as t) x
$$;

create or replace function public.internal_rule_category_default()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.source <> 'manual' and new.category = 'compliance_policy' then
    new.category := public.guess_rule_category(new.title_ar, new.instruction_ar);
  end if;
  return new;
end $$;
drop trigger if exists internal_rule_category_default on public.internal_rules;
create trigger internal_rule_category_default before insert on public.internal_rules
  for each row execute function public.internal_rule_category_default();

-- Approved versions record the category the rule had when it was approved.
create or replace function public.internal_rule_version_category()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.category is null then select category into new.category from public.internal_rules where id = new.rule_id; end if;
  return new;
end $$;
drop trigger if exists internal_rule_version_category on public.internal_rule_versions;
create trigger internal_rule_version_category before insert on public.internal_rule_versions
  for each row execute function public.internal_rule_version_category();
revoke all on function public.internal_rule_version_category(), public.internal_rule_category_default() from public, anon, authenticated;

-- Save with a category. Changing the category of an active rule is an edit like any other: it returns to draft and
-- needs a second person's approval again.
create or replace function public.save_internal_rule_v2(_org uuid, _id uuid, _code text, _title text, _instruction text, _severity text,
  _category text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare _rid uuid;
begin
  if _category is not null and _category not in ('compliance_policy', 'approved_language', 'prohibited_claim', 'brand_guideline', 'logo',
      'brand_colors', 'required_disclosure') then
    raise exception 'code:invalid_category' using errcode = 'P0001';
  end if;
  _rid := public.save_internal_rule(_org, _id, _code, _title, _instruction, _severity);
  if _category is not null then update public.internal_rules set category = _category where id = _rid and org_id = _org; end if;
  return _rid;
end $$;
revoke all on function public.save_internal_rule_v2(uuid, uuid, text, text, text, text, text) from public, anon;
grant execute on function public.save_internal_rule_v2(uuid, uuid, text, text, text, text, text) to authenticated;
