
-- Enums
create type public.app_role as enum ('admin','user');
create type public.rule_category as enum ('mawthooq','content','ai','commerce');
create type public.check_type as enum ('audio','visual','text','metadata','hybrid');
create type public.severity as enum ('violation','warning');
create type public.submission_kind as enum ('video','image','text');
create type public.submission_status as enum ('queued','extracting','transcribing','analyzing','done','failed');
create type public.overall_status as enum ('ready','needs_fixes','review');
create type public.evidence_type as enum ('transcript','frame','caption','metadata');
create type public.finding_source as enum ('deterministic','llm');
create type public.platform as enum ('snapchat','tiktok','instagram','x','youtube');
create type public.product_category as enum ('food','health','beauty','finance','real_estate','other');
create type public.pipeline_step as enum ('transcribe','deterministic','llm','merge','done');

-- profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  mawthooq_license_no text,
  platforms public.platform[] not null default '{}',
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "own profile read" on public.profiles for select to authenticated using (id = auth.uid());
create policy "own profile insert" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid());

-- roles
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "own roles read" on public.user_roles for select to authenticated using (user_id = auth.uid());

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- new user trigger: profile + first user becomes admin
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name) values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)));
  insert into public.user_roles (user_id, role) values (new.id, 'user');
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- rulebook
create table public.rulebook_versions (
  id uuid primary key default gen_random_uuid(),
  version_label text not null unique,
  notes text,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);
grant select on public.rulebook_versions to anon, authenticated;
grant all on public.rulebook_versions to service_role;
alter table public.rulebook_versions enable row level security;
create policy "public read" on public.rulebook_versions for select to anon, authenticated using (true);

create table public.rules (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  rulebook_version_id uuid not null references public.rulebook_versions(id),
  category public.rule_category not null,
  title_ar text not null, title_en text not null,
  description_ar text not null, description_en text not null,
  source_name text not null, source_url text not null, source_date text,
  check_type public.check_type not null,
  default_severity public.severity not null,
  llm_instructions text not null,
  applies_to_categories public.product_category[] not null default '{}',
  is_active boolean not null default true
);
grant select on public.rules to anon, authenticated;
grant all on public.rules to service_role;
alter table public.rules enable row level security;
create policy "public read" on public.rules for select to anon, authenticated using (true);

-- AI settings (single row)
create table public.ai_settings (
  id int primary key default 1 check (id = 1),
  llm_model text not null default 'openai/gpt-6-astra',
  asr_model text not null default 'openai/gpt-transcribe',
  frames_to_llm int not null default 24,
  prompt_version text not null default 'v1',
  updated_at timestamptz not null default now()
);
grant select on public.ai_settings to authenticated;
grant update on public.ai_settings to authenticated;
grant all on public.ai_settings to service_role;
alter table public.ai_settings enable row level security;
create policy "read settings" on public.ai_settings for select to authenticated using (true);
create policy "admin update settings" on public.ai_settings for update to authenticated using (public.has_role(auth.uid(),'admin'));
insert into public.ai_settings (id) values (1);

-- submissions
create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  is_demo boolean not null default false,
  kind public.submission_kind not null,
  file_path text,
  audio_path text,
  text_content text,
  caption text not null default '',
  platform public.platform not null,
  product_category public.product_category not null,
  is_paid_ad boolean not null default false,
  has_written_contract boolean not null default false,
  ai_used boolean not null default false,
  mawthooq_license_no text,
  parent_id uuid references public.submissions(id) on delete set null,
  sha256 text,
  duration_seconds numeric,
  status public.submission_status not null default 'queued',
  progress int not null default 0,
  current_step public.pipeline_step not null default 'transcribe',
  overall_status public.overall_status,
  error_message text,
  thumbnail_path text,
  title text,
  created_at timestamptz not null default now(),
  analyzed_at timestamptz,
  media_deleted_at timestamptz
);
grant select on public.submissions to anon;
grant select, insert, update, delete on public.submissions to authenticated;
grant all on public.submissions to service_role;
alter table public.submissions enable row level security;
create policy "demo read" on public.submissions for select to anon, authenticated using (is_demo);
create policy "own read" on public.submissions for select to authenticated using (user_id = auth.uid());
create policy "own insert" on public.submissions for insert to authenticated with check (user_id = auth.uid() and not is_demo);
create policy "own update" on public.submissions for update to authenticated using (user_id = auth.uid() and not is_demo);
create policy "own delete" on public.submissions for delete to authenticated using (user_id = auth.uid() and not is_demo);

create or replace function public.can_read_submission(_sid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.submissions s where s.id = _sid and (s.is_demo or s.user_id = auth.uid()))
$$;
create or replace function public.owns_submission(_sid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.submissions s where s.id = _sid and s.user_id = auth.uid() and not s.is_demo)
$$;

-- transcripts
create table public.transcripts (
  submission_id uuid primary key references public.submissions(id) on delete cascade,
  full_text text not null default '',
  segments jsonb not null default '[]',
  language text default 'ar',
  provider text
);
grant select on public.transcripts to anon;
grant select, insert, update, delete on public.transcripts to authenticated;
grant all on public.transcripts to service_role;
alter table public.transcripts enable row level security;
create policy "read" on public.transcripts for select to anon, authenticated using (public.can_read_submission(submission_id));
create policy "write" on public.transcripts for all to authenticated using (public.owns_submission(submission_id)) with check (public.owns_submission(submission_id));

-- frames
create table public.frames (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  t_seconds numeric not null,
  image_path text,
  ocr_text text
);
grant select on public.frames to anon;
grant select, insert, update, delete on public.frames to authenticated;
grant all on public.frames to service_role;
alter table public.frames enable row level security;
create policy "read" on public.frames for select to anon, authenticated using (public.can_read_submission(submission_id));
create policy "write" on public.frames for all to authenticated using (public.owns_submission(submission_id)) with check (public.owns_submission(submission_id));

-- analysis runs
create table public.analysis_runs (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  rulebook_version_id uuid references public.rulebook_versions(id),
  rulebook_version text,
  llm_model text, asr_model text, prompt_version text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  step_outputs jsonb not null default '{}',
  raw_llm_output jsonb,
  token_usage jsonb
);
grant select on public.analysis_runs to anon;
grant select, insert, update, delete on public.analysis_runs to authenticated;
grant all on public.analysis_runs to service_role;
alter table public.analysis_runs enable row level security;
create policy "read" on public.analysis_runs for select to anon, authenticated using (public.can_read_submission(submission_id));
create policy "write" on public.analysis_runs for all to authenticated using (public.owns_submission(submission_id)) with check (public.owns_submission(submission_id));

-- findings
create table public.findings (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.analysis_runs(id) on delete cascade,
  submission_id uuid not null references public.submissions(id) on delete cascade,
  rule_code text not null,
  severity public.severity not null,
  t_start numeric, t_end numeric,
  evidence_type public.evidence_type not null,
  evidence_text text,
  evidence_frame_id uuid references public.frames(id) on delete set null,
  explanation_ar text, explanation_en text,
  fix_ar text, fix_en text,
  confidence numeric not null default 0.5,
  source public.finding_source not null
);
grant select on public.findings to anon;
grant select, insert, update, delete on public.findings to authenticated;
grant all on public.findings to service_role;
alter table public.findings enable row level security;
create policy "read" on public.findings for select to anon, authenticated using (public.can_read_submission(submission_id));
create policy "write" on public.findings for all to authenticated using (public.owns_submission(submission_id)) with check (public.owns_submission(submission_id));

-- compliance logs
create table public.compliance_logs (
  submission_id uuid primary key references public.submissions(id) on delete cascade,
  content_hash text not null,
  generated_at timestamptz not null default now()
);
grant select on public.compliance_logs to anon;
grant select, insert, update, delete on public.compliance_logs to authenticated;
grant all on public.compliance_logs to service_role;
alter table public.compliance_logs enable row level security;
create policy "read" on public.compliance_logs for select to anon, authenticated using (public.can_read_submission(submission_id));
create policy "write" on public.compliance_logs for all to authenticated using (public.owns_submission(submission_id)) with check (public.owns_submission(submission_id));

-- evaluation
create table public.eval_cases (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  submission_id uuid references public.submissions(id) on delete set null,
  expected jsonb not null default '[]',
  created_by uuid not null,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.eval_cases to authenticated;
grant all on public.eval_cases to service_role;
alter table public.eval_cases enable row level security;
create policy "admin all" on public.eval_cases for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- storage policies for private media bucket (bucket created separately)
create policy "own media read" on storage.objects for select to authenticated using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own media write" on storage.objects for insert to authenticated with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own media delete" on storage.objects for delete to authenticated using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

-- SEED rulebook
insert into public.rulebook_versions (id, version_label, notes, is_active) values
('11111111-1111-1111-1111-111111111111','2026.10-a','Illustrative – pending legal review / توضيحية – بانتظار المراجعة القانونية', true);

insert into public.rules (code, rulebook_version_id, category, title_ar, title_en, description_ar, description_en, source_name, source_url, source_date, check_type, default_severity, llm_instructions) values
('MAW-01','11111111-1111-1111-1111-111111111111','mawthooq','الإفصاح الواضح عن الإعلان قبل بدايته','Disclose advertising clearly before the ad','يجب الإفصاح كتابةً أو صوتاً أن المحتوى إعلان قبل عرضه.','Content must be disclosed as an ad, in writing or speech, before it begins.','شروط منصة موثوق','https://mawthooq.gcam.gov.sa','2024','hybrid','violation','Look for promotional content (brand mentions, discount codes, "link in bio", calls to buy). If promotional, check whether a disclosure word (إعلان، إعلان مدفوع، برعاية، #إعلان) appears in the caption, spoken in the first 5 s, or as on-screen text in the first 5 s.'),
('MAW-02','11111111-1111-1111-1111-111111111111','mawthooq','المنتج أو الخدمة المعلن عنها يجب أن تكون مرخّصة','Advertised product/service must be licensed','على المعلن التأكد من ترخيص المنتج أو الخدمة.','The advertiser should confirm the product or service is licensed.','شروط منصة موثوق','https://mawthooq.gcam.gov.sa','2024','hybrid','warning','If a product in a regulated category (health, supplements, finance, real estate) is advertised, raise a warning asking the user to confirm licensing.'),
('MAW-03','11111111-1111-1111-1111-111111111111','mawthooq','لا إعلان دون عقد أو اتفاق مكتوب','No advertising without a written contract','يجب وجود عقد مكتوب مع الجهة المعلنة.','A written agreement with the brand is required.','شروط منصة موثوق','https://mawthooq.gcam.gov.sa','2024','metadata','warning','Metadata rule: promotional content while has_written_contract=false.'),
('MAW-04','11111111-1111-1111-1111-111111111111','mawthooq','الإعلان عبر حساب مرتبط برخصة موثوق','Ads only via an account linked to a Mawthooq license','يجب أن يكون الحساب المعلن مرتبطاً برخصة موثوق.','The publishing account must be linked to a Mawthooq license.','شروط منصة موثوق','https://mawthooq.gcam.gov.sa','2024','metadata','warning','Metadata rule: promotional content and no license number provided.'),
('CNT-01','11111111-1111-1111-1111-111111111111','content','عدم تصوير الأطفال في المحتوى اليومي','No filming children in daily content','يُمنع إظهار الأطفال في المحتوى اليومي.','Children must not appear in daily-life content.','ضوابط المحتوى – الهيئة العامة لتنظيم الإعلام','TODO-verify','2025-09','visual','violation','In frames, look for a person who appears to be a minor. Describe neutrally ("a person who appears to be a child"). Never identify anyone. If unsure, warning with confidence ≤ 0.6.'),
('CNT-02','11111111-1111-1111-1111-111111111111','content','عدم تصوير العمالة المنزلية','No filming domestic workers','يُمنع تصوير العمالة المنزلية في المحتوى اليومي.','Domestic workers must not be filmed in daily content.','ضوابط المحتوى – الهيئة العامة لتنظيم الإعلام','TODO-verify','2025-09','hybrid','violation','Look for speech or visuals suggesting a domestic worker is filmed (e.g. addressing a housemaid/driver). Neutral description only.'),
('CNT-03','11111111-1111-1111-1111-111111111111','content','حماية خصوصية الأسرة','Protect family privacy','تجنب كشف تفاصيل الحياة الأسرية الخاصة.','Avoid exposing private family life details.','ضوابط المحتوى – الهيئة العامة لتنظيم الإعلام','TODO-verify','2025-09','hybrid','warning','Subjective: private family moments, house interior details tied to family members. Always warning, confidence ≤ 0.6.'),
('CNT-04','11111111-1111-1111-1111-111111111111','content','عدم التفاخر أو الاستعراض غير الدقيق','No flaunting wealth','تجنّب استعراض الثراء بشكل مبالغ أو مضلل.','Avoid exaggerated or misleading displays of wealth.','ضوابط المحتوى – الهيئة العامة لتنظيم الإعلام','TODO-verify','2025-09','hybrid','warning','Subjective: piles of cash, bragging about prices. Warning only, confidence ≤ 0.6.'),
('CNT-05','11111111-1111-1111-1111-111111111111','content','عدم التنمر أو الإساءة أو الألفاظ الخادشة','No bullying, insults or vulgar language','يُمنع التنمر والإساءة والألفاظ البذيئة.','Bullying, insults and vulgar language are prohibited.','ضوابط المحتوى – الهيئة العامة لتنظيم الإعلام','TODO-verify','2025-09','audio','violation','Detect insults, mockery or vulgar words in transcript (Saudi dialect aware). Quote the words with timestamp.'),
('CNT-06','11111111-1111-1111-1111-111111111111','content','اللباس المتوافق مع إرشادات المحتوى','Attire consistent with content guidelines','الالتزام بإرشادات اللباس المنشورة.','Follow published attire guidelines.','ضوابط المحتوى – الهيئة العامة لتنظيم الإعلام','TODO-verify','2025-09','visual','warning','Human review: if attire may conflict with guidelines, warning with confidence ≤ 0.5. Neutral description.'),
('AI-01','11111111-1111-1111-1111-111111111111','ai','الإفصاح عن المحتوى المولّد أو المعدّل بالذكاء الاصطناعي','Disclose AI-generated or AI-edited content','يجب الإفصاح عن استخدام الذكاء الاصطناعي في إنشاء المحتوى أو تعديله.','AI use in creating or editing content must be disclosed.','مبادئ الذكاء الاصطناعي في الإعلام – وزارة الإعلام وسدايا','TODO-verify','2026-05','hybrid','violation','If ai_used=true or frames look AI-generated, check for disclosure (مولّد بالذكاء الاصطناعي، AI) in caption or first 5 s.'),
('COM-01','11111111-1111-1111-1111-111111111111','commerce','عدم الادعاءات الكاذبة أو المضللة في الإعلانات','No false or misleading claims in ads','يُمنع الادعاء الصحي أو المالي المطلق أو المضلل.','Absolute or misleading health/finance claims are prohibited.','ضوابط الإعلان في وسائل التواصل – وزارة التجارة','TODO-verify','2024','hybrid','warning','Detect absolute claims: weight loss promises, cures, "guaranteed", "no side effects", guaranteed profit. Violation only if clearly absolute and promotional.');

-- SEED demo reports
insert into public.submissions (id, is_demo, kind, caption, platform, product_category, is_paid_ad, has_written_contract, ai_used, sha256, duration_seconds, status, progress, current_step, overall_status, title, created_at, analyzed_at) values
('d0000000-0000-0000-0000-000000000001', true, 'video', 'جربت شاي التنحيف الجديد 🔥 كود الخصم SALEEM20 الرابط في البايو', 'snapchat','health', true, false, true, '9f2c4a1e7b3d5f60a8c1e2b4d6f8091a3c5e7f9b1d3f5a7c9e1b3d5f7a9c1e3b', 42, 'done',100,'done','needs_fixes','إعلان شاي التنحيف – النسخة الأولى', now() - interval '2 hours', now() - interval '2 hours'),
('d0000000-0000-0000-0000-000000000002', true, 'video', 'إعلان مدفوع | شاي الأعشاب من متجر نخلة 🌿 كود SALEEM20 · المحتوى معدّل بالذكاء الاصطناعي', 'snapchat','health', true, true, true, '4b8e1d2c9a7f3e5b6d0c1a2f4e8b9d7c3a5f1e2d4c6b8a0f9e7d5c3b1a2f4e6d', 38, 'done',100,'done','ready','إعلان شاي الأعشاب – النسخة المعدّلة', now() - interval '1 hour', now() - interval '1 hour');
update public.submissions set parent_id = 'd0000000-0000-0000-0000-000000000001' where id = 'd0000000-0000-0000-0000-000000000002';
update public.submissions set mawthooq_license_no = 'MW-2026-48213' where id = 'd0000000-0000-0000-0000-000000000002';

insert into public.transcripts (submission_id, full_text, segments, provider) values
('d0000000-0000-0000-0000-000000000001','هلا والله يا جماعة، اليوم بجرب لكم شاي جديد... هذا الشاي ينحف وتنزلين خمس كيلو في أسبوع ومضمون بدون أعراض جانبية. استخدموا كود SALEEM20 والرابط في البايو، اطلبوا الحين.',
 '[{"start":0,"end":4.5,"text":"هلا والله يا جماعة، اليوم بجرب لكم شاي جديد"},{"start":4.5,"end":12,"text":"صراحة طعمه حلو وريحته تجنن"},{"start":12,"end":19,"text":"هذا الشاي ينحف وتنزلين خمس كيلو في أسبوع"},{"start":19,"end":24,"text":"ومضمون بدون أعراض جانبية"},{"start":24,"end":33,"text":"استخدموا كود SALEEM20 والرابط في البايو"},{"start":33,"end":42,"text":"اطلبوا الحين قبل لا يخلص"}]','demo'),
('d0000000-0000-0000-0000-000000000002','إعلان مدفوع بالتعاون مع متجر نخلة. هذا شاي أعشاب أشربه بعد العشاء وأحس فيه بالراحة. استخدموا كود SALEEM20.',
 '[{"start":0,"end":4,"text":"إعلان مدفوع بالتعاون مع متجر نخلة"},{"start":4,"end":14,"text":"هذا شاي أعشاب أشربه بعد العشاء"},{"start":14,"end":24,"text":"وأحس فيه بالراحة، وهذي تجربتي الشخصية"},{"start":24,"end":38,"text":"استخدموا كود SALEEM20 والتفاصيل في البايو"}]','demo');

insert into public.analysis_runs (id, submission_id, rulebook_version_id, rulebook_version, llm_model, asr_model, prompt_version, finished_at) values
('a0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','2026.10-a','openai/gpt-6-astra','openai/gpt-transcribe','v1', now() - interval '2 hours'),
('a0000000-0000-0000-0000-000000000002','d0000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','2026.10-a','openai/gpt-6-astra','openai/gpt-transcribe','v1', now() - interval '1 hour');

insert into public.findings (run_id, submission_id, rule_code, severity, t_start, t_end, evidence_type, evidence_text, explanation_ar, explanation_en, fix_ar, fix_en, confidence, source) values
('a0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000001','MAW-01','violation',0,5,'transcript','لا توجد كلمة «إعلان» في الوصف أو في أول ٥ ثوانٍ رغم وجود كود خصم','المحتوى ترويجي (كود خصم ورابط في البايو) دون إفصاح عن الإعلان قبل بدايته.','Promotional content (discount code, link in bio) without an ad disclosure before it starts.','ابدأ المقطع بعبارة «إعلان مدفوع» وأضف #إعلان في بداية الوصف.','Open with "paid ad" and add #إعلان at the start of the caption.',0.95,'deterministic'),
('a0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000001','COM-01','violation',12,24,'transcript','«هذا الشاي ينحف وتنزلين خمس كيلو في أسبوع ومضمون بدون أعراض جانبية»','ادعاء صحي مطلق ومضمون النتيجة في إعلان منتج صحي.','Absolute, guaranteed health claim in a health-product ad.','احذف وعود الوزن والضمان، واكتفِ بوصف تجربتك الشخصية دون نتائج.','Remove weight and guarantee claims; describe your personal experience only.',0.9,'llm'),
('a0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000001','AI-01','violation',null,null,'metadata','تم تحديد «استخدمت الذكاء الاصطناعي» دون إفصاح في الوصف','استُخدم الذكاء الاصطناعي في المحتوى دون إفصاح.','AI was used without disclosure.','أضف «المحتوى معدّل بالذكاء الاصطناعي» في الوصف.','Add "AI-edited content" to the caption.',0.95,'deterministic'),
('a0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000001','MAW-03','warning',null,null,'metadata','لا يوجد عقد مكتوب مع الماركة','إعلان مدفوع دون عقد مكتوب مع الجهة المعلنة.','Paid ad without a written contract with the brand.','وثّق الاتفاق مع الماركة كتابياً قبل النشر.','Put the brand agreement in writing before publishing.',0.9,'deterministic'),
('a0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000001','MAW-04','warning',null,null,'metadata','لم يُدخل رقم رخصة موثوق','لم يتم إدخال رقم رخصة موثوق لحساب ينشر إعلاناً.','No Mawthooq license number provided for a promotional post.','تحقق من ربط حسابك برخصة موثوق وأدخل رقمها.','Verify your account is linked to a Mawthooq license and enter it.',0.8,'deterministic'),
('a0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000001','MAW-02','warning',24,33,'transcript','منتج تنحيف (فئة صحية) يُعلن عنه','منتج صحي يحتاج تأكيد الترخيص من الجهة المختصة.','A health product requires confirmation of licensing.','تأكد من ترخيص المنتج من هيئة الغذاء والدواء.','Confirm the product is licensed by the SFDA.',0.6,'llm');

insert into public.compliance_logs (submission_id, content_hash) values
('d0000000-0000-0000-0000-000000000001','c1a9e3b5d7f9a1c3e5b7d9f1a3c5e7b9d1f3a5c7e9b1d3f5a7c9e1b3d5f7a9c1'),
('d0000000-0000-0000-0000-000000000002','e7b9d1f3a5c7e9b1d3f5a7c9e1b3d5f7a9c1e3b5d7f9a1c3e5b7d9f1a3c5e7b9');
