-- Demo pair produced by the real pipeline (2026-10-14).
-- Synthetic Saudi-dialect clips (TTS + slides) → browser extraction → whisper-1 → vision model → deterministic → merge.
-- Labelled as demo + synthetic. Additive and idempotent (on conflict do nothing).

insert into public.submissions (id, is_demo, kind, caption, platform, product_category, is_paid_ad, has_written_contract, ai_used,
  mawthooq_license_no, parent_id, sha256, duration_seconds, status, progress, current_step, overall_status, title, file_path, created_at, analyzed_at)
values ('d0000000-0000-0000-0000-000000000003', true, 'video', 'جربت شاي الأعشاب الجديد 🌿', 'snapchat', 'health', true, false, false,
  null, null, '43bd4bfca1b2c77bc2f7a138387b74d3fdd2a9a5ff1ec387572686600aabde61', 21.9, 'done', 100, 'done', 'needs_fixes', 'إعلان شاي التنحيف (مقطع اصطناعي للعرض)',
  'demo:/demo/slimming-tea-ar.webm', now() - interval '90 minutes', now() - interval '89 minutes')
on conflict (id) do nothing;

insert into public.transcripts (submission_id, full_text, segments, language, provider)
values ('d0000000-0000-0000-0000-000000000003', 'هلا والله يا جماعة، اليوم بجرب لكم شاي جديد، صراحة طعمه حلو وريخته تجنن. هذا الشاي ينحث وتنزلين 5 كيلو في أسبوع، ومضمون بدون أعراض جانبية. استخدموا كود سليم 20 والرابط في البيو، اطلبوا الحين قبل لا يخلص.', '[{"start":0,"end":7.679999828338623,"text":"هلا والله يا جماعة، اليوم بجرب لكم شاي جديد، صراحة طعمه حلو وريخته تجنن."},{"start":8.199999809265137,"end":14.9399995803833,"text":"هذا الشاي ينحث وتنزلين 5 كيلو في أسبوع، ومضمون بدون أعراض جانبية."},{"start":15.479999542236328,"end":21.440000534057617,"text":"استخدموا كود سليم 20 والرابط في البيو، اطلبوا الحين قبل لا يخلص."}]'::jsonb, 'ar', 'openai:whisper-1')
on conflict (submission_id) do nothing;

insert into public.analysis_runs (id, submission_id, rulebook_version_id, rulebook_version, llm_model, asr_model, llm_provider, asr_provider,
  prompt_version, started_at, finished_at, status, token_usage, cost_usd, durations_ms, frames_count, on_screen_text, step_outputs)
select 'a0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000003', v.id, v.version_label, 'gpt-6.1-sol', 'whisper-1', 'openai', 'openai',
  'v3-2026-10', now() - interval '90 minutes', now() - interval '89 minutes', 'done',
  '{"input_tokens":5579,"output_tokens":1344,"cached_input_tokens":5576}'::jsonb, 0.01615, '{"extract":3932,"asr":4054,"llm":22049,"total":30041}'::jsonb, 23, '[{"t":0,"text":"تجربتي مع\nشاي الأعشاب الجديد"},{"t":1,"text":"تجربتي مع\nشاي الأعشاب الجديد"},{"t":2,"text":"تجربتي مع\nشاي الأعشاب الجديد"},{"t":3,"text":"تجربتي مع\nشاي الأعشاب الجديد"},{"t":4,"text":"تجربتي مع\nشاي الأعشاب الجديد"},{"t":5,"text":"تجربتي مع\nشاي الأعشاب الجديد"},{"t":6,"text":"تجربتي مع\nشاي الأعشاب الجديد"},{"t":7,"text":"تجربتي مع\nشاي الأعشاب الجديد"},{"t":8,"text":"تجربتي مع\nشاي الأعشاب الجديد"},{"t":9,"text":"ينحف ٥ كيلو\nفي أسبوع — مضمون!"},{"t":10,"text":"ينحف ٥ كيلو\nفي أسبوع — مضمون!"},{"t":11,"text":"ينحف ٥ كيلو\nفي أسبوع — مضمون!"},{"t":12,"text":"ينحف ٥ كيلو\nفي أسبوع — مضمون!"},{"t":13,"text":"ينحف ٥ كيلو\nفي أسبوع — مضمون!"},{"t":14,"text":"ينحف ٥ كيلو\nفي أسبوع — مضمون!"},{"t":15,"text":"ينحف ٥ كيلو\nفي أسبوع — مضمون!"},{"t":16,"text":"كود الخصم: SLIM50\nالرابط في البايو"},{"t":17,"text":"كود الخصم: SLIM50\nالرابط في البايو"},{"t":18,"text":"كود الخصم: SLIM50\nالرابط في البايو"},{"t":19,"text":"كود الخصم: SLIM50\nالرابط في البايو"},{"t":20,"text":"كود الخصم: SLIM50\nالرابط في البايو"},{"t":21,"text":"كود الخصم: SLIM50\nالرابط في البايو"},{"t":21.8,"text":"كود الخصم: SLIM50\nالرابط في البايو"}]'::jsonb, '{"source":"docs/demo/clips/slimming-tea-ar.json","synthetic":true}'::jsonb
from public.rulebook_versions v where v.is_active
on conflict (id) do nothing;
insert into public.findings (run_id, submission_id, rule_code, severity, t_start, t_end, evidence_type, evidence_text, explanation_ar, explanation_en, fix_ar, fix_en, confidence, source)
select 'a0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000003', 'MAW-01', 'violation', 0, 5, 'frame', 'كود الخصم: SLIM50
الرابط في البايو', 'المحتوى ترويجي (تم تحديد «إعلان مدفوع») دون إفصاح صريح عن الإعلان في الوصف أو في أول 5 ثوانٍ.', 'Promotional content without a clear ad disclosure in the caption or the first 5 seconds.', 'ابدأ المقطع بعبارة «إعلان مدفوع» واكتب #إعلان في بداية الوصف.', 'Open with "paid ad" and put #ad at the start of the caption.', 0.95, 'deterministic'
where not exists (select 1 from public.findings where run_id = 'a0000000-0000-0000-0000-000000000003' and rule_code = 'MAW-01' and coalesce(t_start, -1) = 0);
insert into public.findings (run_id, submission_id, rule_code, severity, t_start, t_end, evidence_type, evidence_text, explanation_ar, explanation_en, fix_ar, fix_en, confidence, source)
select 'a0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000003', 'COM-01', 'violation', 8.2, 14.9, 'transcript', 'هذا الشاي ينحث وتنزلين 5 كيلو في أسبوع، ومضمون بدون أعراض جانبية.', 'يتضمن الإعلان وعدًا قطعيًا بخسارة الوزن وضمانًا لعدم وجود أعراض جانبية.', 'The ad makes an absolute weight-loss promise and guarantees no side effects.', 'احذف وعود خسارة الوزن والضمان وعدم وجود أعراض جانبية من الصوت والنص الظاهر.', 'Remove the weight-loss promises, guarantee, and no-side-effects claim from the audio and on-screen text.', 1, 'llm'
where not exists (select 1 from public.findings where run_id = 'a0000000-0000-0000-0000-000000000003' and rule_code = 'COM-01' and coalesce(t_start, -1) = 8.2);
insert into public.findings (run_id, submission_id, rule_code, severity, t_start, t_end, evidence_type, evidence_text, explanation_ar, explanation_en, fix_ar, fix_en, confidence, source)
select 'a0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000003', 'MAW-02', 'warning', 8.2, 14.9, 'transcript', 'هذا الشاي ينحث وتنزلين 5 كيلو في أسبوع، ومضمون بدون أعراض جانبية.', 'يُروَّج للشاي بوصفه منتجًا للتنحيف، مما يستدعي تأكيد ترخيصه دون افتراض أنه غير مرخّص.', 'The tea is promoted as a weight-loss product, requiring confirmation of its licensing without assuming it is unlicensed.', 'اطلب من المعلن وثيقة ترخيص المنتج وتحقق من صلاحيتها قبل النشر.', 'Request the product’s licensing document from the advertiser and verify its validity before publishing.', 0.95, 'llm'
where not exists (select 1 from public.findings where run_id = 'a0000000-0000-0000-0000-000000000003' and rule_code = 'MAW-02' and coalesce(t_start, -1) = 8.2);
insert into public.findings (run_id, submission_id, rule_code, severity, t_start, t_end, evidence_type, evidence_text, explanation_ar, explanation_en, fix_ar, fix_en, confidence, source)
select 'a0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000003', 'COM-01', 'violation', 12, 13, 'frame', 'ينحف ٥ كيلو
في أسبوع — مضمون!', 'ادعاء صحي مطلق أو مضمون النتيجة في محتوى ترويجي.', 'Absolute or guaranteed health claim in promotional content.', 'احذف وعود النتائج والضمان، واكتفِ بوصف تجربتك الشخصية مع توضيح أن النتائج تختلف.', 'Remove result and guarantee promises; describe your personal experience and note results vary.', 0.9, 'deterministic'
where not exists (select 1 from public.findings where run_id = 'a0000000-0000-0000-0000-000000000003' and rule_code = 'COM-01' and coalesce(t_start, -1) = 12);
insert into public.findings (run_id, submission_id, rule_code, severity, t_start, t_end, evidence_type, evidence_text, explanation_ar, explanation_en, fix_ar, fix_en, confidence, source)
select 'a0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000003', 'MAW-03', 'warning', null, null, 'metadata', 'لا يوجد عقد مكتوب مع العلامة', 'محتوى ترويجي دون عقد أو اتفاق مكتوب مع الجهة المعلنة.', 'Promotional content without a written agreement with the advertiser.', 'وثّق الاتفاق مع العلامة كتابياً قبل النشر.', 'Put the brand agreement in writing before publishing.', 0.9, 'deterministic'
where not exists (select 1 from public.findings where run_id = 'a0000000-0000-0000-0000-000000000003' and rule_code = 'MAW-03' and coalesce(t_start, -1) = -1);
insert into public.findings (run_id, submission_id, rule_code, severity, t_start, t_end, evidence_type, evidence_text, explanation_ar, explanation_en, fix_ar, fix_en, confidence, source)
select 'a0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000003', 'MAW-04', 'warning', null, null, 'metadata', 'لم يُدخل رقم رخصة موثوق', 'لم يُدخل رقم رخصة موثوق لحساب ينشر محتوى ترويجياً.', 'No Mawthooq license number provided for promotional content.', 'تحقق من ربط حسابك برخصة موثوق وأدخل رقمها.', 'Make sure your account is linked to a Mawthooq license and enter its number.', 0.8, 'deterministic'
where not exists (select 1 from public.findings where run_id = 'a0000000-0000-0000-0000-000000000003' and rule_code = 'MAW-04' and coalesce(t_start, -1) = -1);

insert into public.compliance_logs (submission_id, content_hash) values ('d0000000-0000-0000-0000-000000000003', '43bd4bfca1b2c77bc2f7a138387b74d3fdd2a9a5ff1ec387572686600aabde61') on conflict (submission_id) do nothing;
update public.compliance_logs set report_hash = public.compute_report_hash(submission_id), generated_at = now()
where submission_id = 'd0000000-0000-0000-0000-000000000003' and report_hash is null;

insert into public.submissions (id, is_demo, kind, caption, platform, product_category, is_paid_ad, has_written_contract, ai_used,
  mawthooq_license_no, parent_id, sha256, duration_seconds, status, progress, current_step, overall_status, title, file_path, created_at, analyzed_at)
values ('d0000000-0000-0000-0000-000000000004', true, 'video', '#إعلان | شاي الأعشاب من متجر نخلة', 'snapchat', 'food', true, true, false,
  'MW-2026-48213', 'd0000000-0000-0000-0000-000000000003', 'f3344828436d462544ab160b7d393d061b9be2b7b7655be03d79205d8641ea01', 13.3, 'done', 100, 'done', 'ready', 'إعلان شاي الأعشاب – النسخة المعدّلة (مقطع اصطناعي للعرض)',
  'demo:/demo/herbal-tea-fixed-ar.webm', now() - interval '30 minutes', now() - interval '29 minutes')
on conflict (id) do nothing;

insert into public.transcripts (submission_id, full_text, segments, language, provider)
values ('d0000000-0000-0000-0000-000000000004', 'إعلان مدفوع بالتعاون مع متجر نحلة هذا شاي أعشاب أشربه بعد العشاء، وأحس فيه بالراحة. وهذه تجربتي الشخصية، والنتائج تختلف من شخص لشخص.', '[{"start":1,"end":3,"text":"إعلان مدفوع بالتعاون مع متجر نحلة"},{"start":3,"end":8,"text":"هذا شاي أعشاب أشربه بعد العشاء، وأحس فيه بالراحة."},{"start":8,"end":13,"text":"وهذه تجربتي الشخصية، والنتائج تختلف من شخص لشخص."}]'::jsonb, 'ar', 'openai:whisper-1')
on conflict (submission_id) do nothing;

insert into public.analysis_runs (id, submission_id, rulebook_version_id, rulebook_version, llm_model, asr_model, llm_provider, asr_provider,
  prompt_version, started_at, finished_at, status, token_usage, cost_usd, durations_ms, frames_count, on_screen_text, step_outputs)
select 'a0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000004', v.id, v.version_label, 'gpt-6.1-sol', 'whisper-1', 'openai', 'openai',
  'v3-2026-10', now() - interval '30 minutes', now() - interval '29 minutes', 'done',
  '{"input_tokens":4127,"output_tokens":442,"cached_input_tokens":4124}'::jsonb, 0.00613, '{"extract":2052,"asr":3442,"llm":8945,"total":14441}'::jsonb, 15, '[{"t":0,"text":"إعلان مدفوع\nبالتعاون مع متجر نخلة"},{"t":1,"text":"إعلان مدفوع\nبالتعاون مع متجر نخلة"},{"t":2,"text":"إعلان مدفوع\nبالتعاون مع متجر نخلة"},{"t":3,"text":"إعلان مدفوع\nبالتعاون مع متجر نخلة"},{"t":4,"text":"إعلان مدفوع\nبالتعاون مع متجر نخلة"},{"t":5,"text":"إعلان مدفوع\nبالتعاون مع متجر نخلة"},{"t":6,"text":"شاي أعشاب\nبعد العشاء"},{"t":7,"text":"شاي أعشاب\nبعد العشاء"},{"t":8,"text":"شاي أعشاب\nبعد العشاء"},{"t":9,"text":"شاي أعشاب\nبعد العشاء"},{"t":10,"text":"شاي أعشاب\nبعد العشاء"},{"t":11,"text":"شاي أعشاب\nبعد العشاء"},{"t":12,"text":"شاي أعشاب\nبعد العشاء"},{"t":13,"text":"شاي أعشاب\nبعد العشاء"},{"t":13.3,"text":"شاي أعشاب\nبعد العشاء"}]'::jsonb, '{"source":"docs/demo/clips/herbal-tea-fixed-ar.json","synthetic":true}'::jsonb
from public.rulebook_versions v where v.is_active
on conflict (id) do nothing;

insert into public.compliance_logs (submission_id, content_hash) values ('d0000000-0000-0000-0000-000000000004', 'f3344828436d462544ab160b7d393d061b9be2b7b7655be03d79205d8641ea01') on conflict (submission_id) do nothing;
update public.compliance_logs set report_hash = public.compute_report_hash(submission_id), generated_at = now()
where submission_id = 'd0000000-0000-0000-0000-000000000004' and report_hash is null;
