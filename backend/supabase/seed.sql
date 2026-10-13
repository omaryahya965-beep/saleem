-- SALEEM Seed Data
-- supabase/seed.sql

-- 1. Rulebook Version
insert into public.rulebook_versions (id, version_label, notes, is_active) values
('11111111-1111-1111-1111-111111111111', '2026.10-a', 'Illustrative – pending legal review / توضيحية – بانتظار المراجعة القانونية', true)
on conflict (id) do nothing;

-- 2. Rules
insert into public.rules (code, rulebook_version_id, category, title_ar, title_en, description_ar, description_en, source_name, source_url, source_date, check_type, default_severity, llm_instructions) values
('MAW-01', '11111111-1111-1111-1111-111111111111', 'mawthooq', 'الإفصاح الواضح عن الإعلان قبل بدايته', 'Disclose advertising clearly before the ad', 'يجب الإفصاح كتابةً أو صوتاً أن المحتوى إعلان قبل عرضه.', 'Content must be disclosed as an ad, in writing or speech, before it begins.', 'شروط منصة موثوق', 'https://mawthooq.gcam.gov.sa', '2024', 'hybrid', 'violation', 'Look for promotional content (brand mentions, discount codes, "link in bio", calls to buy). If promotional, check whether a disclosure word (إعلان، إعلان مدفوع، برعاية، #إعلان) appears in the caption, spoken in the first 5 s, or as on-screen text in the first 5 s.'),
('MAW-02', '11111111-1111-1111-1111-111111111111', 'mawthooq', 'المنتج أو الخدمة المعلن عنها يجب أن تكون مرخّصة', 'Advertised product/service must be licensed', 'على المعلن التأكد من ترخيص المنتج أو الخدمة.', 'The advertiser should confirm the product or service is licensed.', 'شروط منصة موثوق', 'https://mawthooq.gcam.gov.sa', '2024', 'hybrid', 'warning', 'If a product in a regulated category (health, supplements, finance, real estate) is advertised, raise a warning asking the user to confirm licensing.'),
('MAW-03', '11111111-1111-1111-1111-111111111111', 'mawthooq', 'لا إعلان دون عقد أو اتفاق مكتوب', 'No advertising without a written contract', 'يجب وجود عقد مكتوب مع الجهة المعلنة.', 'A written agreement with the brand is required.', 'شروط منصة موثوق', 'https://mawthooq.gcam.gov.sa', '2024', 'metadata', 'warning', 'Metadata rule: promotional content while has_written_contract=false.'),
('MAW-04', '11111111-1111-1111-1111-111111111111', 'mawthooq', 'الإعلان عبر حساب مرتبط برخصة موثوق', 'Ads only via an account linked to a Mawthooq license', 'يجب أن يكون الحساب المعلن مرتبطاً برخصة موثوق.', 'The publishing account must be linked to a Mawthooq license.', 'شروط منصة موثوق', 'https://mawthooq.gcam.gov.sa', '2024', 'metadata', 'warning', 'Metadata rule: promotional content and no license number provided.'),
('CNT-01', '11111111-1111-1111-1111-111111111111', 'content', 'عدم تصوير الأطفال في المحتوى اليومي', 'No filming children in daily content', 'يُمنع إظهار الأطفال في المحتوى اليومي.', 'Children must not appear in daily-life content.', 'ضوابط المحتوى – الهيئة العامة لتنظيم الإعلام', 'https://gcam.gov.sa', '2025-09', 'visual', 'violation', 'In frames, look for a person who appears to be a minor. Describe neutrally ("a person who appears to be a child"). Never identify anyone. If unsure, warning with confidence ≤ 0.6.'),
('CNT-02', '11111111-1111-1111-1111-111111111111', 'content', 'عدم تصوير العمالة المنزلية', 'No filming domestic workers', 'يُمنع تصوير العمالة المنزلية في المحتوى اليومي.', 'Domestic workers must not be filmed in daily content.', 'ضوابط المحتوى – الهيئة العامة لتنظيم الإعلام', 'https://gcam.gov.sa', '2025-09', 'hybrid', 'violation', 'Look for speech or visuals suggesting a domestic worker is filmed (e.g. addressing a housemaid/driver). Neutral description only.'),
('CNT-03', '11111111-1111-1111-1111-111111111111', 'content', 'حماية خصوصية الأسرة', 'Protect family privacy', 'تجنب كشف تفاصيل الحياة الأسرية الخاصة.', 'Avoid exposing private family life details.', 'ضوابط المحتوى – الهيئة العامة لتنظيم الإعلام', 'https://gcam.gov.sa', '2025-09', 'hybrid', 'warning', 'Subjective: private family moments, house interior details tied to family members. Always warning, confidence ≤ 0.6.'),
('CNT-04', '11111111-1111-1111-1111-111111111111', 'content', 'عدم التفاخر أو الاستعراض غير الدقيق', 'No flaunting wealth', 'تجنّب استعراض الثراء بشكل مبالغ أو مضلل.', 'Avoid exaggerated or misleading displays of wealth.', 'ضوابط المحتوى – الهيئة العامة لتنظيم الإعلام', 'https://gcam.gov.sa', '2025-09', 'hybrid', 'warning', 'Subjective: piles of cash, bragging about prices. Warning only, confidence ≤ 0.6.'),
('CNT-05', '11111111-1111-1111-1111-111111111111', 'content', 'عدم التنمر أو الإساءة أو الألفاظ الخادشة', 'No bullying, insults or vulgar language', 'يُمنع التنمر والإساءة والألفاظ البذيئة.', 'Bullying, insults and vulgar language are prohibited.', 'ضوابط المحتوى – الهيئة العامة لتنظيم الإعلام', 'https://gcam.gov.sa', '2025-09', 'audio', 'violation', 'Detect insults, mockery or vulgar words in transcript (Saudi dialect aware). Quote the words with timestamp.'),
('CNT-06', '11111111-1111-1111-1111-111111111111', 'content', 'اللباس المتوافق مع إرشادات المحتوى', 'Attire consistent with content guidelines', 'الالتزام بإرشادات اللباس المنشورة.', 'Follow published attire guidelines.', 'ضوابط المحتوى – الهيئة العامة لتنظيم الإعلام', 'https://gcam.gov.sa', '2025-09', 'visual', 'warning', 'Human review: if attire may conflict with guidelines, warning with confidence ≤ 0.5. Neutral description.'),
('AI-01', '11111111-1111-1111-1111-111111111111', 'ai', 'الإفصاح عن المحتوى المولّد أو المعدّل بالذكاء الاصطناعي', 'Disclose AI-generated or AI-edited content', 'يجب الإفصاح عن استخدام الذكاء الاصطناعي في إنشاء المحتوى أو تعديله.', 'AI use in creating or editing content must be disclosed.', 'مبادئ الذكاء الاصطناعي في الإعلام – وزارة الإعلام وسدايا', 'https://sdaia.gov.sa', '2026-05', 'hybrid', 'violation', 'If ai_used=true or frames look AI-generated, check for disclosure (مولّد بالذكاء الاصطناعي، AI) in caption or first 5 s.'),
('COM-01', '11111111-1111-1111-1111-111111111111', 'commerce', 'عدم الادعاءات الكاذبة أو المضللة في الإعلانات', 'No false or misleading claims in ads', 'يُمنع الادعاء الصحي أو المالي المطلق أو المضلل.', 'Absolute or misleading health/finance claims are prohibited.', 'ضوابط الإعلان في وسائل التواصل – وزارة التجارة', 'https://mc.gov.sa', '2024', 'hybrid', 'warning', 'Detect absolute claims: weight loss promises, cures, "guaranteed", "no side effects", guaranteed profit. Violation only if clearly absolute and promotional.')
on conflict (code) do nothing;

-- 3. Demo Submissions
insert into public.submissions (id, is_demo, kind, caption, platform, product_category, is_paid_ad, has_written_contract, ai_used, sha256, duration_seconds, status, progress, current_step, overall_status, title, created_at, analyzed_at) values
('d0000000-0000-0000-0000-000000000001', true, 'video', 'جربت شاي التنحيف الجديد 🔥 كود الخصم SALEEM20 الرابط في البايو', 'snapchat', 'health', true, false, true, '9f2c4a1e7b3d5f60a8c1e2b4d6f8091a3c5e7f9b1d3f5a7c9e1b3d5f7a9c1e3b', 42, 'done', 100, 'done', 'needs_fixes', 'إعلان شاي التنحيف – النسخة الأولى', now() - interval '2 hours', now() - interval '2 hours'),
('d0000000-0000-0000-0000-000000000002', true, 'video', 'إعلان مدفوع | شاي الأعشاب من متجر نخلة 🌿 كود SALEEM20 · المحتوى معدّل بالذكاء الاصطناعي', 'snapchat', 'health', true, true, true, '4b8e1d2c9a7f3e5b6d0c1a2f4e8b9d7c3a5f1e2d4c6b8a0f9e7d5c3b1a2f4e6d', 38, 'done', 100, 'done', 'ready', 'إعلان شاي الأعشاب – النسخة المعدّلة', now() - interval '1 hour', now() - interval '1 hour')
on conflict (id) do nothing;

update public.submissions set parent_id = 'd0000000-0000-0000-0000-000000000001' where id = 'd0000000-0000-0000-0000-000000000002';
update public.submissions set mawthooq_license_no = 'MW-2026-48213' where id = 'd0000000-0000-0000-0000-000000000002';

-- 4. Demo Transcripts
insert into public.transcripts (submission_id, full_text, segments, provider) values
('d0000000-0000-0000-0000-000000000001',
 'هلا والله يا جماعة، اليوم بجرب لكم شاي جديد... هذا الشاي ينحف وتنزلين خمس كيلو في أسبوع ومضمون بدون أعراض جانبية. استخدموا كود SALEEM20 والرابط في البايو، اطلبوا الحين.',
 '[{"start":0,"end":4.5,"text":"هلا والله يا جماعة، اليوم بجرب لكم شاي جديد"},{"start":4.5,"end":12,"text":"صراحة طعمه حلو وريحته تجنن"},{"start":12,"end":19,"text":"هذا الشاي ينحف وتنزلين خمس كيلو في أسبوع"},{"start":19,"end":24,"text":"ومضمون بدون أعراض جانبية"},{"start":24,"end":33,"text":"استخدموا كود SALEEM20 والرابط في البايو"},{"start":33,"end":42,"text":"اطلبوا الحين قبل لا يخلص"}]'::jsonb,
 'demo'),
('d0000000-0000-0000-0000-000000000002',
 'إعلان مدفوع بالتعاون مع متجر نخلة. هذا شاي أعشاب أشربه بعد العشاء وأحس فيه بالراحة. استخدموا كود SALEEM20.',
 '[{"start":0,"end":4,"text":"إعلان مدفوع بالتعاون مع متجر نخلة"},{"start":4,"end":14,"text":"هذا شاي أعشاب أشربه بعد العشاء"},{"start":14,"end":24,"text":"وأحس فيه بالراحة، وهذي تجربتي الشخصية"},{"start":24,"end":38,"text":"استخدموا كود SALEEM20 والتفاصيل في البايو"}]'::jsonb,
 'demo')
on conflict (submission_id) do nothing;

-- 5. Demo Analysis Runs
insert into public.analysis_runs (id, submission_id, rulebook_version_id, rulebook_version, llm_model, asr_model, prompt_version, finished_at) values
('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '2026.10-a', 'claude-3-5-sonnet-20241022', 'whisper-1', 'v1', now() - interval '2 hours'),
('a0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', '2026.10-a', 'claude-3-5-sonnet-20241022', 'whisper-1', 'v1', now() - interval '1 hour')
on conflict (id) do nothing;

-- 6. Demo Findings
insert into public.findings (run_id, submission_id, rule_code, severity, t_start, t_end, evidence_type, evidence_text, explanation_ar, explanation_en, fix_ar, fix_en, confidence, source) values
('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'MAW-01', 'violation', 0, 5, 'transcript', 'لا توجد كلمة «إعلان» في الوصف أو في أول ٥ ثوانٍ رغم وجود كود خصم', 'المحتوى ترويجي (كود خصم ورابط في البايو) دون إفصاح عن الإعلان قبل بدايته.', 'Promotional content (discount code, link in bio) without an ad disclosure before it starts.', 'ابدأ المقطع بعبارة «إعلان مدفوع» وأضف #إعلان في بداية الوصف.', 'Open with "paid ad" and add #إعلان at the start of the caption.', 0.95, 'deterministic'),
('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'COM-01', 'violation', 12, 24, 'transcript', '«هذا الشاي ينحف وتنزلين خمس كيلو في أسبوع ومضمون بدون أعراض جانبية»', 'ادعاء صحي مطلق ومضمون النتيجة في إعلان منتج صحي.', 'Absolute, guaranteed health claim in a health-product ad.', 'احذف وعود الوزن والضمان، واكتفِ بوصف تجربتك الشخصية دون نتائج.', 'Remove weight and guarantee claims; describe your personal experience only.', 0.90, 'llm'),
('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'AI-01', 'violation', null, null, 'metadata', 'تم تحديد «استخدمت الذكاء الاصطناعي» دون إفصاح في الوصف', 'استُخدم الذكاء الاصطناعي في المحتوى دون إفصاح.', 'AI was used without disclosure.', 'أضف «المحتوى معدّل بالذكاء الاصطناعي» في الوصف.', 'Add "AI-edited content" to the caption.', 0.95, 'deterministic'),
('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'MAW-03', 'warning', null, null, 'metadata', 'لا يوجد عقد مكتوب مع الماركة', 'إعلان مدفوع دون عقد مكتوب مع الجهة المعلنة.', 'Paid ad without a written contract with the brand.', 'وثّق الاتفاق مع الماركة كتابياً قبل النشر.', 'Put the brand agreement in writing before publishing.', 0.90, 'deterministic'),
('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'MAW-04', 'warning', null, null, 'metadata', 'لم يُدخل رقم رخصة موثوق', 'لم يتم إدخال رقم رخصة موثوق لحساب ينشر إعلاناً.', 'No Mawthooq license number provided for a promotional post.', 'تحقق من ربط حسابك برخصة موثوق وأدخل رقمها.', 'Verify your account is linked to a Mawthooq license and enter it.', 0.80, 'deterministic'),
('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'MAW-02', 'warning', 24, 33, 'transcript', 'منتج تنحيف (فئة صحية) يُعلن عنه', 'منتج صحي يحتاج تأكيد الترخيص من الجهة المختصة.', 'A health product requires confirmation of licensing.', 'تأكد من ترخيص المنتج من هيئة الغذاء والدواء.', 'Confirm the product is licensed by the SFDA.', 0.60, 'llm');

-- 7. Demo Compliance Logs
insert into public.compliance_logs (submission_id, content_hash) values
('d0000000-0000-0000-0000-000000000001', 'c1a9e3b5d7f9a1c3e5b7d9f1a3c5e7b9d1f3a5c7e9b1d3f5a7c9e1b3d5f7a9c1'),
('d0000000-0000-0000-0000-000000000002', 'e7b9d1f3a5c7e9b1d3f5a7c9e1b3d5f7a9c1e3b5d7f9a1c3e5b7d9f1a3c5e7b9')
on conflict (submission_id) do nothing;
