<div dir="rtl">

# دليل التعرّف على مشروع سَليم (SALEEM)

> دليل تعريفي لمهندس جديد على المشروع. كل معلومة هنا مأخوذة من ملفات قرأتها فعلاً، ومعها مسار الملف. ما كان استنتاجاً مكتوب أنه استنتاج.

---

## 1. نظرة عامة

**سَليم** أداة تفحص المحتوى **قبل النشر** لصنّاع المحتوى والوكالات والعلامات التجارية في السعودية ([README.md](README.md)).

- **المشكلة:** صانع المحتوى قد يخالف قواعد الإعلان دون أن ينتبه، مثل عدم كتابة «إعلان»، أو ادعاء صحي مطلق، أو ظهور أطفال، أو عدم الإفصاح عن استخدام الذكاء الاصطناعي.
- **الحل:** يرفع المستخدم مقطعاً أو صورة أو نصاً مع بيانات بسيطة (المنصة، هل هو إعلان مدفوع، فئة المنتج...). النظام يفرّغ الكلام، ويقرأ اللقطات، ويقارنها بـ«دليل القواعد» (12 قاعدة في [backend/supabase/seed.sql](backend/supabase/seed.sql))، ثم يعطي تقريراً فيه كل ملاحظة مع توقيتها ودليلها والتعديل المقترح.
- **المستخدمون:** صانع المحتوى (creator)، والوكالة (organization فيها أعضاء بأدوار)، والعلامة التجارية التي تراجع التقرير عبر رابط مشاركة، ومشرف النظام (admin) الذي يدير القواعد والتقييم.
- **أهم الميزات:**
  - تقرير بالملاحظات مع التوقيت والدليل وطريقة الإصلاح ([frontend/src/features/reports/ReportView.tsx](frontend/src/features/reports/ReportView.tsx)).
  - إعادة الفحص (re-check) بعد التعديل، ويُربط الفحص الجديد بالقديم عبر `parent_id`.
  - سجل امتثال مختوم (compliance log) بـ hash، ويمكن التحقق منه علناً عبر `/verify/$id`.
  - مساحات عمل للوكالات وحملات (campaigns)، وروابط مشاركة يوافق فيها البراند أو يرفض.
  - إدارة نسخ دليل القواعد، وصفحة تقييم الدقة (eval)، ومؤشرات للمشرف.
  - حذف الوسائط تلقائياً بعد 24 ساعة، وحذف الحساب بالكامل.
- **ملاحظة مهمة:** النتائج **استرشادية** وليست موافقة رسمية. والقواعد «توضيحية بانتظار مراجعة قانونية» ([docs/saleem-v2/progress/FINAL_REPORT.md](docs/saleem-v2/progress/FINAL_REPORT.md) البند 6 من «Open issues»).

---

## 2. التقنيات المستخدمة

| الطبقة | التقنية (الإصدار) | دورها في المشروع |
|---|---|---|
| اللغة | TypeScript ^5.8 (strict) | كل الكود، في الواجهة وفي Edge Functions |
| الواجهة | React ^19.2 | بناء الواجهة |
| أداة البناء | Vite 8.1.5 (يستخدم rolldown) | خادم التطوير والبناء ([frontend/vite.config.ts](frontend/vite.config.ts)) |
| التوجيه | `@tanstack/react-router` 1.170.41 | توجيه مبني على الملفات (file-based routing): كل ملف في `src/routes` يصبح صفحة، والملف `routeTree.gen.ts` يولَّد تلقائياً |
| جلب البيانات | `@tanstack/react-query` ^5.101 | تخزين مؤقت (cache) لنتائج الاستعلامات، وإعادة المحاولة، والاستطلاع الدوري (polling) |
| التنسيق | Tailwind CSS ^4.2 + `class-variance-authority` + `tailwind-merge` + `clsx` | تنسيق بالـ utility classes، و`cva` لصنع نسخ مختلفة (variants) من المكونات |
| مكونات الواجهة | Radix UI (dialog, tabs, switch, tooltip, direction...) | مكونات تراعي إمكانية الوصول (accessibility)، و`react-direction` يضبط اتجاه RTL |
| أخرى في الواجهة | `lucide-react` (أيقونات)، `sonner` (رسائل toast)، `qrcode` (رمز QR في سجل الامتثال)، `@fontsource/*` (خطوط عربية محلية) | |
| الخلفية | Supabase: PostgreSQL 17 + Auth + Storage + Edge Functions (تعمل على Deno) + `pg_cron` + `pg_net` + Vault | قاعدة البيانات والصلاحيات والتخزين والمعالجة |
| عميل Supabase | `@supabase/supabase-js` ^2.117 (في الواجهة)، و2.49.1 عبر esm.sh (في Edge Functions) | الوصول إلى القاعدة والتخزين والدوال |
| الذكاء الاصطناعي | OpenAI: `whisper-1` للتفريغ الصوتي، و`gpt-6.1-sol` كنموذج رؤية واستدلال يُخرج JSON بصيغة محددة | ([backend/supabase/functions/_shared/providers/index.ts](backend/supabase/functions/_shared/providers/index.ts)) |
| الصور على السيرفر | `imagescript` 1.3.0 (Deno) | تغبيش (pixelate) لقطات الدليل |
| البريد | Resend API | إشعار بانتهاء الفحص ([_shared/notify.ts](backend/supabase/functions/_shared/notify.ts)) |
| الاختبارات | Vitest ^4.1، Testing Library، Playwright ^1.64 | اختبارات الوحدات، وE2E بالعربي والإنجليزي على الحاسوب والجوال |
| الجودة | ESLint 9 + Prettier 3 | |
| النشر | Vercel للواجهة، وSupabase للخلفية، وGitHub Actions لـ CI ([.github/workflows/ci.yml](.github/workflows/ci.yml)) | |

**مفاهيم قد تكون جديدة عليك:**
- **RLS (Row Level Security):** سياسات داخل PostgreSQL تحدد أي صفوف يراها كل مستخدم. لهذا تستطيع الواجهة أن تستعلم من القاعدة **مباشرة** دون backend وسيط، وتبقى آمنة.
- **Edge Function:** دالة TypeScript تعمل على Deno في سحابة Supabase، وتشبه serverless function.
- **RPC:** دالة SQL تستدعيها الواجهة بـ `supabase.rpc("name")`. الدوال المعرّفة بـ `security definer` تعمل بصلاحيات مالكها، فتستطيع تنفيذ منطق مضبوط يتجاوز RLS.
- **npm workspaces:** الملف [package.json](package.json) في الجذر يجمع مشروعي `frontend` و`backend` في مستودع واحد.

---

## 3. هيكل المجلدات

```text
saleem/
├── package.json                 workspaces + أوامر عامة (dev, build, test)
├── AGENTS.md                    إرشادات المشروع المختصرة
├── README.md                    تعريف المشروع بالعربي أولاً
├── roadmap.md                   خطة المراحل الأولى (مربعاتها غير مؤشَّرة رغم أن معظمها نُفّذ)
├── .github/workflows/ci.yml     CI: typecheck, lint, test, audit, build, deno check, e2e
├── docs/                        قرارات، تشغيل، تصميم، تقرير نهائي، صور، تقارير Lighthouse
├── scripts/                     ~21 سكربت مساعد (prerender، صور الشاشة، مقاطع اصطناعية، TTS...)
├── frontend/
│   ├── vite.config.ts           إعداد Vite (envDir = ../backend!)
│   ├── vercel.json, public/     إعداد الاستضافة والملفات الثابتة ومقاطع العرض
│   ├── e2e/                     اختبارات Playwright
│   └── src/
│       ├── main.tsx             نقطة الدخول
│       ├── router.tsx           إنشاء الـ router والـ QueryClient
│       ├── routes/              ملفات المسارات (رقيقة: كل ملف يستدعي صفحة من features)
│       ├── features/            الصفحات الفعلية مقسّمة حسب الميزة
│       │   ├── submissions/     لوحة التحكم + فحص جديد
│       │   ├── reports/         صفحة الفحص: المعالجة، التقرير، الوسائط، model.ts
│       │   ├── compliance-log/  سجل الامتثال القابل للطباعة
│       │   ├── org/ share/ verify/ archive/ settings/ rulebook/ admin/ auth/ landing/ legal/
│       ├── components/ui/       نظام التصميم (Button, Surfaces, VideoTimeline...)
│       ├── lib/
│       │   ├── supabase.ts      عميل Supabase
│       │   ├── api/             طبقة البيانات: data.ts, features.ts, hooks.ts, auth.tsx
│       │   ├── extract.ts       استخراج الإطارات والصوت (WAV) في المتصفح
│       │   ├── speech.ts        فحص وجود كلام في الصوت (probe)
│       │   └── media.ts         التحقق من حجم الملف ومدته
│       ├── i18n/                ar.json, en.json, index.tsx
│       └── types/supabase.ts    أنواع القاعدة (مولَّدة)
└── backend/
    ├── .env.example             متغيرات VITE_* + SUPABASE_URL
    ├── supabase/
    │   ├── config.toml          إعداد Supabase المحلي + verify_jwt لكل دالة
    │   ├── migrations/          9 ملفات SQL هي مصدر الحقيقة للمخطط
    │   ├── seed.sql             دليل القواعد v1 (12 قاعدة) + تقارير العرض
    │   └── functions/
    │       ├── analyze/         خط التحليل (الدالة الأهم)
    │       ├── cleanup-media/   حذف الوسائط (يدوياً أو بالجدولة)
    │       ├── account/         حذف الحساب
    │       ├── diagnostics/     تشخيص (للمشرف، استنتاجاً من الاسم)
    │       └── _shared/         providers/, rules/, pipeline/, media/, notify.ts, http.ts
    ├── eval/                    قياس الدقة: cases.json + run-eval.ts + results/
    ├── scripts/seed-demo-user.ts
    └── tests/                   Vitest: pipeline, speech, blur, isolation, provider-errors
```

---

## 4. البنية المعمارية

```text
┌──────────────────────── المتصفح (React SPA على Vercel) ────────────────────────┐
│ NewCheckPage → createSubmission():                                             │
│   SHA-256 + استخراج الإطارات (1/ث، حتى 768px) + WAV ‏16kHz + probe للكلام      │
│ CheckPage → polling كل 1.5 ث على submissions → ProcessingView / ReportView     │
└───────┬──────────────────────┬──────────────────────────┬──────────────────────┘
        │ upload               │ insert/select (RLS)      │ functions.invoke("analyze")
        ▼                      ▼                          ▼
┌──────────────┐   ┌─────────────────────────┐   ┌──────────────────────────────┐
│ Storage      │   │ PostgreSQL + RLS        │◄──│ Edge Function: analyze (Deno)│
│ bucket media │◄──│ triggers (quota, state) │   │ service_role، يعمل بالخلفية   │
│ {uid}/{sid}/ │   │ RPCs (seal, verify,...) │   │ EdgeRuntime.waitUntil        │
└──────────────┘   │ pg_cron: cleanup / stuck│   └───────┬──────────────────────┘
        ▲          └─────────────────────────┘           │ HTTPS
        │ cron كل ساعة (pg_net + vault secret)            ▼
┌──────────────────────┐                        ┌──────────────────────┐
│ cleanup-media        │                        │ OpenAI: whisper-1    │
└──────────────────────┘                        │ + gpt-6.1-sol (JSON) │
                                                └──────────────────────┘  + Resend (بريد)
```

- **لا يوجد خادم API خاص.** الواجهة تتعامل مع Supabase مباشرة، وRLS هو ما يحمي البيانات. المنطق الحساس موجود في Triggers ودوال RPC وEdge Functions.
- **العمل الثقيل موزّع:** استخراج الإطارات والصوت يحدث **في المتصفح** ([frontend/src/lib/extract.ts](frontend/src/lib/extract.ts)). أما استدعاء النماذج فيحدث **في الخادم** فقط، فلا يصل مفتاح OpenAI إلى المتصفح.
- **ملاحظة:** الملف docs/ARCHITECTURE.md (حُذف) **قديم** ويذكر Anthropic وRealtime وملفات غير موجودة (`llm.ts` و`transcription.ts`). الملف [docs/saleem-v2/progress/FINAL_REPORT.md](docs/saleem-v2/progress/FINAL_REPORT.md) نفسه يقول إنه outdated. اعتمد على الكود.

---

## 5. المسارات الرئيسية (end to end)

### 5.1 إنشاء فحص جديد
1. **الواجهة:** في `/new` ([routes/_app/new.tsx](frontend/src/routes/_app/new.tsx))، تعرّف الصفحة [NewCheckPage.tsx:113](frontend/src/features/submissions/NewCheckPage.tsx#L113) دالة `useMutation` تستدعي `createSubmission`.
2. **`createSubmission`** في [lib/api/data.ts:292](frontend/src/lib/api/data.ts#L292):
   - تحسب `sha256Hex` للملف (أو للنص).
   - `extractFrames` / `extractAudioWithProbe` من [lib/extract.ts](frontend/src/lib/extract.ts): إطارات JPEG وملف WAV وprobe لوجود الكلام.
   - ترفع الملفات إلى bucket `media` في المسارات: `{userId}/{id}/original.ext` و`frames/0001234.jpg` (اسم الإطار هو الزمن بالملّي ثانية) و`audio.wav` و`thumb.jpg`.
   - تنفّذ `insert` في `submissions`.
3. **القاعدة:** الـ trigger `submissions_force_initial_state` يفرض الحالة الأولى (`queued`، `user_id = auth.uid()`، `is_demo=false`) حتى لا يزوّر المستخدم النتيجة. ويتحقق من الحصة الشهرية (`quota_exceeded`) ومن مدة المقطع (`clip_too_long`) ومن عضوية المنظمة ([migrations/20261014020000_product_features.sql](backend/supabase/migrations/20261014020000_product_features.sql) قرب السطر 257).
4. بعدها `void triggerAnalysis(id)` ([data.ts:393](frontend/src/lib/api/data.ts#L393)) تستدعي `functions.invoke("analyze")`، ثم ينتقل المستخدم إلى `/checks/$id`.

### 5.2 خط التحليل (analyze)
الملف: [backend/supabase/functions/analyze/index.ts](backend/supabase/functions/analyze/index.ts)
1. **`Deno.serve`** (سطر 351): يتحقق من الـ JWT عبر `db.auth.getUser`، ويتأكد أن المستخدم يملك الـ submission، ويطبّق rate limit (30 في الساعة افتراضياً)، ويستخدم heartbeat لمنع تشغيل عاملَين معاً. ثم ينشئ أو يستأنف صفاً في `analysis_runs`، ويرد بـ `202` ويكمل العمل في الخلفية عبر `EdgeRuntime.waitUntil`.
2. **`runPipeline`** (سطر 109)، وخطواتها:
   - **prepare** (بالتوازي مع التفريغ): تحميل القواعد الفعّالة، وقائمة الإطارات، و`signed URLs` صالحة 900 ثانية.
   - **transcribe:** `shouldTranscribe` تتخطى المقطع إن لم يكن فيه صوت. بعد ذلك `OpenAITranscription` ثم `filterSegments` التي تحذف «الهلوسات» (مقاطع يخترعها Whisper حين لا يوجد كلام)، ثم `decideAudioMode` التي تحدد إن كان الصوت `speech` أو `music_no_speech` أو `no_audio` ([_shared/rules/speech.ts](backend/supabase/functions/_shared/rules/speech.ts)).
   - **llm:** `OpenAIAnalysis.analyze` ([providers/openai.ts:164](backend/supabase/functions/_shared/providers/openai.ts#L164)) ترسل الإطارات على دفعات (32 إطاراً في كل دفعة) مع التفريغ وقائمة القواعد ([providers/prompt.ts](backend/supabase/functions/_shared/providers/prompt.ts)). الناتج JSON يُتحقق منه بـ `validateAnalysis` ([pipeline/schema.ts](backend/supabase/functions/_shared/pipeline/schema.ts)).
   - **deterministic:** `runDeterministicChecks` ([rules/deterministic.ts](backend/supabase/functions/_shared/rules/deterministic.ts)) تعمل بالـ regex على نص عربي «مُطبَّع» (`normalizeArabic`)، وتكشف الإفصاح وأكواد الخصم والادعاءات الصحية والمالية.
   - **merge:** `mergeAndFilterFindings` ([pipeline/merge.ts](backend/supabase/functions/_shared/pipeline/merge.ts)) تحذف رموز القواعد غير المعروفة، وتحوّل `violation` إلى `warning` إذا كانت الثقة أقل من 0.7، وتدمج الملاحظات المكررة ضمن 3 ثوانٍ، ثم تحسب `overallStatus`.
   - **حفظ النتائج:** `blurEvidenceFrames` تغبّش لقطات الدليل، ثم insert في `findings`، ثم upsert في `compliance_logs`، ثم حساب التكلفة (`cost.ts`)، ثم `status='done'`. بعدها RPC `seal_compliance_log` وإشعار المستخدم.
3. **الأخطاء:** تُخزَّن كرمز مثل `code:...` تترجمه الواجهة. والإلغاء يتم عبر RPC `cancel_submission`، ويُفحص بين الخطوات بـ `assertNotCancelled`.

### 5.3 متابعة التقدم وعرض التقرير
- [CheckPage.tsx](frontend/src/features/reports/CheckPage.tsx) تستخدم `useSubmissionStatus`، وهي **polling كل 1.5 ثانية** ([hooks.ts](frontend/src/lib/api/hooks.ts)) يتوقف عند `done` أو `failed`، وليست Realtime. إذا لم ينتهِ الفحص تعرض `ProcessingView`، وإذا انتهى تعرض `ReportView`.
- `fetchReport` ([data.ts:161](frontend/src/lib/api/data.ts#L161)) تجلب في جولة واحدة متوازية: الـ submission، وآخر run مع findings، والتفريغ، والقواعد، والسجل، والإطارات **المغبّشة فقط** (`blurred = true`). وإذا وُجد `parent_id` تجلب ملاحظات الفحص السابق لتقارن «ما أُصلح وما بقي».

### 5.4 سجل الامتثال والتحقق العلني
- `compute_report_hash` تحسب SHA-256 لهذه القيم مجتمعة: id + sha256 + الحالة + نسخة القواعد + الملاحظات. و`seal_compliance_log` تخزّنه.
- `/verify/$id` ([features/verify/VerifyPage.tsx](frontend/src/features/verify/VerifyPage.tsx)) تستدعي RPC `verify_compliance_log`، وهي متاحة لـ `anon`. تُرجع حقائق غير معرِّفة بالشخص، وحقل `unchanged` يبيّن هل التقرير ما زال يطابق الختم.

### 5.5 حذف الوسائط (الخصوصية)
- [cleanup-media/index.ts](backend/supabase/functions/cleanup-media/index.ts) لها مستدعيان: المالك (بالـ JWT) يحذف وسائط فحص واحد، و**pg_cron** كل ساعة (الدقيقة 17) يرسل header اسمه `x-cron-secret` محفوظاً في Vault، فتُحذف وسائط الفحوص التي مر عليها أكثر من 24 ساعة. الملاحظات والتفريغ والـ hash تبقى.
- وهناك cron آخر هو `fail_stuck_submissions`، يعمل كل 5 دقائق ويُفشل الفحوص التي توقف heartbeat فيها أكثر من 10 دقائق.

---

## 6. البيانات وقاعدة البيانات

**مكان تعريف المخطط:** [backend/supabase/migrations/](backend/supabase/migrations/)، بالترتيب الزمني. والبيانات الأولية في [seed.sql](backend/supabase/seed.sql). الأنواع في الواجهة مولَّدة في [frontend/src/types/supabase.ts](frontend/src/types/supabase.ts).

**طريقة الوصول:** لا يوجد ORM. يُستخدم query builder الخاص بـ `supabase-js` (مثل `.from().select().eq()`) فوق PostgREST، إضافة إلى دوال RPC بلغة SQL/plpgsql.

| الجدول | المفتاح الأساسي | المفاتيح الأجنبية وأهم الحقول |
|---|---|---|
| `profiles` | `id` → `auth.users` | `plan_id` → `plans`, `preferred_lang`, `notify_email`, `mawthooq_license_no` |
| `user_roles` | `id` | `user_id`, `role` (`admin`/`user`) |
| `rulebook_versions` | `id` | `version_label`, `is_active`, `status` |
| `rules` | `id` (uuid) | `code` فريد (مثل `MAW-01`)، `rulebook_version_id`، `category`، `default_severity`، `llm_instructions`، `source_url` |
| `submissions` | `id` | `user_id`, `parent_id` (يشير إلى الجدول نفسه، لإعادة الفحص), `org_id`, `campaign_id`, `batch_id`, `kind`, `status`, `progress`, `current_step`, `overall_status`, `sha256`, `file_path`, `audio_path`, `audio_probe`, `heartbeat_at`, `attempts`, `media_deleted_at`, `is_demo` |
| `transcripts` | `submission_id` | `segments` (jsonb), `full_text`, `provider` |
| `frames` | `id` | `submission_id`, `t_seconds`, `image_path`, `ocr_text`, `blurred` |
| `analysis_runs` | `id` | `submission_id`, `rulebook_version_id`, `step_outputs`, `token_usage`, `cost_usd`, `durations_ms`, `raw_llm_output`, `prompt_version` |
| `findings` | `id` | `run_id`, `submission_id`, `evidence_frame_id` → `frames`، `rule_code` (نص وليس FK)، `severity`، `t_start/t_end`، `confidence`، `source` |
| `compliance_logs` | `submission_id` | `content_hash`, `report_hash`, `generated_at` |
| `plans` | `id` (text) | `monthly_checks`, `max_batch`, `orgs_allowed` |
| `organizations`, `org_members` (PK مركّب)، `org_invites`، `campaigns` | | أدوار: `owner/admin/reviewer/creator` |
| `batches` | `id` | `user_id` |
| `share_links`, `share_reviews` | `id` | `token`، والقرار والتعليق من البراند |
| `notifications` | `id` | `user_id`, `kind`, `payload` |
| `finding_feedback` | `id` | `finding_id`, `user_id` (رأي المستخدم في صحة الملاحظة) |
| `audit_events`, `eval_cases`, `eval_runs`, `ai_settings` | | تدقيق وتقييم (`ai_settings` غير مستخدم في الكود، انظر القسم 9) |

```text
auth.users 1─N submissions 1─N analysis_runs 1─N findings N─1 frames
                 │  └─ parent_id (self)          findings.rule_code ~ rules.code
                 ├─1 transcripts, 1 compliance_logs, N frames, N share_links 1─N share_reviews
organizations 1─N org_members / campaigns 1─N submissions
rulebook_versions 1─N rules
```

**أهم الاستعلامات والدوال:**
- سياسات RLS: كل جدول مرتبط بالمستخدم يُحمى بشرط `auth.uid()`، أو بدالة `can_read_submission` (للمالك أو عضو المنظمة أو العرض التجريبي).
- `compute_report_hash` / `verify_compliance_log`: الختم والتحقق.
- `my_usage`: عدد الفحوص في الشهر الحالي.
- `get_shared_report` / `submit_share_review`: الوصول برابط مشاركة دون حساب.
- `admin_metrics`: مؤشرات المشرف.

---

## 7. أهم 10 ملفات

| # | الملف | لماذا هو مهم |
|---|---|---|
| 1 | [analyze/index.ts](backend/supabase/functions/analyze/index.ts) | قلب المنتج: خط التحليل القابل للاستئناف |
| 2 | [_shared/rules/deterministic.ts](backend/supabase/functions/_shared/rules/deterministic.ts) | القواعد العربية الثابتة (regex) التي لا تحتاج نموذجاً |
| 3 | [_shared/pipeline/merge.ts](backend/supabase/functions/_shared/pipeline/merge.ts) | يحدد الحالة النهائية ويدمج ملاحظات المصدرين |
| 4 | [_shared/providers/openai.ts](backend/supabase/functions/_shared/providers/openai.ts) + [prompt.ts](backend/supabase/functions/_shared/providers/prompt.ts) | التكامل مع OpenAI والـ prompt وإعادة المحاولة |
| 5 | [migrations/20261013000000_saleem_schema.sql](backend/supabase/migrations/20261013000000_saleem_schema.sql) | المخطط الأساسي وRLS والتخزين |
| 6 | [migrations/20261014020000_product_features.sql](backend/supabase/migrations/20261014020000_product_features.sql) | الخطط، والمنظمات، والمشاركة، والختم، والحصص |
| 7 | [frontend/src/lib/api/data.ts](frontend/src/lib/api/data.ts) | كل وصول الواجهة إلى البيانات، ويشمل `createSubmission` و`fetchReport` |
| 8 | [frontend/src/lib/extract.ts](frontend/src/lib/extract.ts) | تجهيز الإطارات والصوت داخل المتصفح |
| 9 | [frontend/src/features/reports/ReportView.tsx](frontend/src/features/reports/ReportView.tsx) + [model.ts](frontend/src/features/reports/model.ts) | عرض التقرير ومنطقه |
| 10 | [frontend/src/features/submissions/NewCheckPage.tsx](frontend/src/features/submissions/NewCheckPage.tsx) | نموذج بدء الفحص |

---

## 8. التشغيل

**المتطلبات:** Node 22، ومشروع Supabase، ومفتاح OpenAI، وSupabase CLI عبر `npx` ([README.md](README.md)). وDeno إذا أردت تشغيل `deno check`.

**متغيرات البيئة** (الأسماء فقط):
- `backend/.env`: الواجهة تقرأ منه لأن `envDir: "../backend"` في [vite.config.ts](frontend/vite.config.ts).
  - `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`: الاتصال العام بـ Supabase.
  - `VITE_DEMO_MODE`: وضع العرض التجريبي.
  - `VITE_SHOW_TEST_ACCOUNTS`: إظهار حسابات الاختبار في صفحة الدخول ([auth.tsx](frontend/src/lib/api/auth.tsx)).
  - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (اختياري، للسكربتات الإدارية فقط).
- `backend/supabase/functions/.env` (أسرار الدوال):
  - `OPENAI_API_KEY` (مطلوب).
  - `TRANSCRIPTION_PROVIDER`, `TRANSCRIPTION_MODEL`, `LLM_PROVIDER`, `LLM_MODEL`, `LLM_REASONING_EFFORT`.
  - اختيارية: `ANALYZE_RATE_LIMIT_PER_HOUR`، و`PRICE_<MODEL>`.
  - تُقرأ أيضاً في الكود: `APP_URL`، ومفتاح Resend للبريد (انظر [notify.ts](backend/supabase/functions/_shared/notify.ts))، و`SUPABASE_SERVICE_ROLE_KEY` (توفره Supabase تلقائياً للدوال).

**الخطوات:**
```bash
npm ci
cp backend/.env.example backend/.env
cp backend/supabase/functions/.env.example backend/supabase/functions/.env
npx supabase link --project-ref <ref> --workdir backend
npx supabase db push --workdir backend          # يطبّق migrations (يكتب في القاعدة)
npx supabase secrets set --env-file backend/supabase/functions/.env --workdir backend
npx supabase functions deploy --workdir backend
npm run dev                                      # http://localhost:3000
```

| الأمر | الوظيفة |
|---|---|
| `npm test` | Vitest للواجهة ثم للخلفية |
| `npm run lint` | ESLint |
| `npm run build` | `vite build` ثم `scripts/prerender.mjs` (يولّد HTML ثابتاً للصفحات العامة) |
| `npm --workspace frontend run e2e` | Playwright |
| `npm --workspace backend run eval` | قياس الدقة على `eval/cases.json` (يستدعي OpenAI ويكلّف مالاً إلا مع `--deterministic-only`) |
| `npm run seed:backend` | إنشاء حساب العرض |

> ⚠️ ملف الـ migration [20261014000000_pipeline_hardening.sql](backend/supabase/migrations/20261014000000_pipeline_hardening.sql) يكتب **رابط مشروع Supabase مباشرة في الكود** داخل `cron.schedule`. إذا نشرت على مشروع آخر فعدّل هذا الرابط.

---

## 9. الحالة الحالية

**مكتمل** (حسب [docs/saleem-v2/progress/FINAL_REPORT.md](docs/saleem-v2/progress/FINAL_REPORT.md) والكود): خط تحليل حقيقي، وتقرير، وإعادة فحص، وسجل مختوم، ومنظمات، ومشاركة، وإدارة القواعد، وتقييم، وإشعارات، وحصص، وحذف حساب، وCI، وE2E. لا توجد تعليقات `TODO` أو `FIXME` في الكود (بحثت بـ grep).

**غير مكتمل أو مفتوح** (من FINAL_REPORT، قسم Open issues):
- أداء Lighthouse على الجوال حوالي 70.
- لم يُختبر التدفق كاملاً على النسخة المنشورة بمستخدم حقيقي مسجّل.
- اختبارات عزل RLS الحية `skipped` ([backend/tests/isolation.test.ts](backend/tests/isolation.test.ts)).
- مصادر القواعد `source_verified=false`.
- CI لم يعمل على GitHub (لا يوجد remote).

**عدم اتساق ونقاط خطرة لاحظتها:**
1. docs/ARCHITECTURE.md (حُذف) قديم: يذكر Anthropic وRealtime وحالات `needs_review/needs_fix` بينما الكود يستخدم `ready/review/needs_fixes`، ويقول إن `rules.id` نص بينما هو uuid ويوجد عمود `code` منفصل، ويرتّب خطوات الـ pipeline بغير ترتيبها الفعلي (الفعلي: transcribe ثم llm ثم deterministic ثم merge).
2. وكذلك [roadmap.md](roadmap.md) كل مربعاته غير مؤشَّرة، وفيه أرقام قديمة (640px وغيرها).
3. **جدول `ai_settings`** غير مستخدم: الجدول موجود، لكن الكود يقرأ النماذج من متغيرات البيئة فقط ([providers/index.ts](backend/supabase/functions/_shared/providers/index.ts)). هذا شبه dead schema.
4. **Rate limit** في [analyze/index.ts:382](backend/supabase/functions/analyze/index.ts#L382) يعدّ الـ submissions **المنشأة** في الساعة، لا مرات التحليل، ويستخدم `>` لا `>=`، فيسمح فعلياً بـ 31.
5. `fail_stuck_submissions` تكتب رسالة خطأ عربية حرفية، بينما بقية المسار يكتب رموزاً بصيغة `code:...` تترجمها الواجهة، فقد تظهر الرسالة بالعربية في الواجهة الإنجليزية.
6. `findings.rule_code` نص بلا FK إلى `rules`، والتحقق منه يتم في `merge.ts` فقط.
7. `triggerAnalysis` تطبع تحذيراً فقط إذا فشل الاستدعاء، فيبقى الفحص `queued` حتى يُفشله الـ watchdog بعد 10 دقائق.
8. بيانات دخول حساب العرض مكتوبة في [auth.tsx](frontend/src/lib/api/auth.tsx). هذا مقصود لحساب تجريبي، لكن انتبه ألا يُستخدم الحساب لبيانات حقيقية.
9. Edge Functions تستخدم `supabase-js@2.49.1` من esm.sh، وهو إصدار أقدم بكثير من إصدار الواجهة.
10. الملف `docs/SALEEM_AUDIT.md` غير متتبَّع في git (untracked).

---

## 10. التاريخ والملكية

- **مساهم واحد:** `omaryahya965-beep`، وله كل الـ 45 commit.
- **المدة:** من 2026-10-13 إلى 2026-10-15.
- **مراحل العمل** (رسائل الـ commits مقسمة إلى Phases، كل مرحلة في فرع ثم merge):
  - Phase 1–3: التصميم، والمسارات، والواجهة.
  - Phase 4: خط التحليل الحقيقي.
  - Phase 5: المنظمات، والمشاركة، والقواعد، والتحقق، والإشعارات، والحصص.
  - Phase 6: سجل التدقيق، والـ watchdog، وprerender، وE2E، وCI.
  - Phase 7: بيانات العرض.
- **أحدث التغييرات المهمة:**
  - تغبيش لقطات الدليل على السيرفر.
  - أوضاع الصوت (probe وفلتر الهلوسة).
  - تسريع تحميل التقرير (جولة متوازية واحدة).
  - النشر على Vercel وإزالة بقايا Lovable (أداة بناء الواجهة الأصلية).
  - رابط `/sample`.
  - تحسين README.
- قرارات التصميم موثقة في [docs/DECISIONS.md](docs/DECISIONS.md) (من D1 إلى D64 تقريباً).

---

## 11. المصطلحات

| المصطلح | المعنى |
|---|---|
| **موثوق (Mawthooq)** | منصة ترخيص المعلنين على مواقع التواصل في السعودية. قواعدها `MAW-01..04` |
| **GCAM** | الهيئة العامة لتنظيم الإعلام. قواعدها `CNT-01..06` |
| **SDAIA** | الهيئة السعودية للبيانات والذكاء الاصطناعي. قاعدتها `AI-01` |
| **MC (وزارة التجارة)** | الادعاءات المضللة. قاعدتها `COM-01` |
| `submission` / «فحص» | عملية فحص واحدة لمقطع أو صورة أو نص |
| `finding` / «ملاحظة» | مخالفة أو تنبيه مربوط بقاعدة |
| `violation` / `warning` | مخالفة واضحة / تحتاج مراجعة |
| `overall_status` | `ready` (جاهز) أو `review` (يحتاج مراجعة) أو `needs_fixes` (يحتاج تعديلات) |
| `run` / `analysis_run` | تشغيل واحد لخط التحليل. قد يكون للفحص الواحد أكثر من تشغيل (re-run) |
| `re-check` | فحص جديد بـ `parent_id` يشير إلى الفحص الأصلي |
| `deterministic` vs `llm` | مصدر الملاحظة: regex ثابت أو نموذج ذكاء اصطناعي |
| `audio_mode` | `speech` / `music_no_speech` / `no_audio` |
| `probe` | فحص سريع في المتصفح لوجود كلام في الصوت قبل إرساله للتفريغ |
| `seal` / `report_hash` | ختم السجل بـ hash لإثبات أنه لم يتغير |
| `WHOLE_POST_RULES` | قواعد تخص المنشور كله، فتظهر مرة واحدة فقط |
| `normalizeArabic` | توحيد الهمزات والألف المقصورة والأرقام قبل مطابقة الـ regex |
| `is_demo` | بيانات العرض العامة |
| `SLM-XXXX-XXXX-XXXX` | رقم تحقق مقروء مشتق من UUID ([model.ts:63](frontend/src/features/reports/model.ts#L63)) |
| **اصطلاحات التسمية** | `snake_case` في القاعدة، و`camelCase` في TS، ومعاملات دوال RPC تبدأ بـ `_` (مثل `_sid`)، والحقول ثنائية اللغة تنتهي بـ `_ar` / `_en`، وفي مسارات TanStack: `_app` تعني layout بلا مقطع في الرابط، و`$id` تعني parameter |

---

## 12. ترتيب القراءة المقترح

1. [README.md](README.md) ثم [docs/saleem-v2/progress/FINAL_REPORT.md](docs/saleem-v2/progress/FINAL_REPORT.md)، وتجاهل ARCHITECTURE.md.
2. [backend/supabase/seed.sql](backend/supabase/seed.sql) لتفهم القواعد الـ 12.
3. [migrations/20261013000000_saleem_schema.sql](backend/supabase/migrations/20261013000000_saleem_schema.sql)، ثم بقية ملفات migrations بالترتيب.
4. [_shared/types.ts](backend/supabase/functions/_shared/types.ts) ثم [analyze/index.ts](backend/supabase/functions/analyze/index.ts).
5. [rules/arabic.ts](backend/supabase/functions/_shared/rules/arabic.ts) ثم `deterministic.ts` ثم `speech.ts` ثم `pipeline/merge.ts` ثم `schema.ts`.
6. `providers/index.ts` ثم `prompt.ts` ثم `openai.ts`.
7. [backend/tests/pipeline.test.ts](backend/tests/pipeline.test.ts) (أمثلة حية على السلوك).
8. الواجهة: `main.tsx` ثم `router.tsx` ثم `routes/__root.tsx` ثم `lib/supabase.ts` ثم `lib/api/data.ts` ثم `hooks.ts`.
9. `NewCheckPage.tsx` ثم `lib/extract.ts` ثم `CheckPage.tsx` ثم `ReportView.tsx` ثم `model.ts`.
10. الميزات الإضافية حسب الحاجة: org، وshare، وverify، وadmin.

---

## 13. أسئلة متوقعة من مراجع أو مدرّس

1. **لماذا لا يوجد backend مستقل (Express مثلاً)؟**
   لأن Supabase مع RLS يسمح للواجهة بالوصول المباشر بأمان. المنطق الحساس موجود في triggers وRPC، والعمل الثقيل وأسرار OpenAI في Edge Functions.
2. **كيف تمنعون المستخدم من تزوير نتيجة «جاهز»؟**
   الـ trigger `submissions_force_initial_state` يعيد ضبط الحالة عند الإنشاء، والكتابة في `findings` وغيرها تتم بـ `service_role` من الدالة. والختم بـ `report_hash` يكشف أي تعديل لاحق (`unchanged`).
3. **لماذا قواعد ثابتة (regex) إلى جانب النموذج؟**
   لأنها رخيصة وقابلة للشرح ومختبرة، وتغطي الحالات الواضحة مثل غياب كلمة «إعلان» وأكواد الخصم. وفي الدمج تفوز للقواعد الخاصة بالمنشور كله (`merge.ts`).
4. **كيف تمنعون النموذج من اختراع قواعد؟**
   الـ prompt يمنع ذلك، و`mergeAndFilterFindings` تحذف أي `rule_code` غير موجود في القواعد الفعّالة، والـ schema صارم (strict JSON).
5. **ماذا يحدث إذا انقطع التحليل في منتصفه؟**
   كل خطوة تحفظ ناتجها في `analysis_runs.step_outputs` و`transcripts`، فإعادة الاستدعاء تستأنف من حيث توقفت. والـ heartbeat يمنع تشغيل عاملَين معاً، والـ watchdog يُفشل الفحص العالق بعد 10 دقائق.
6. **لماذا تُستخرج الإطارات والصوت في المتصفح؟**
   لتقليل الحجم المرفوع وتكلفة الخادم: إطارات حتى 768px، وWAV أحادي 16kHz. والـ probe يتجنب استدعاء Whisper للمقاطع الصامتة، فيقلل الهلوسة والتكلفة.
7. **كيف تحمون خصوصية الأشخاص والأطفال في اللقطات؟**
   لقطات الدليل تُغبَّش على السيرفر (`blurEvidenceFrames`)، والواجهة لا تطلب إلا الإطارات التي فيها `blurred=true`. والوسائط تُحذف بعد 24 ساعة، والـ prompt يمنع التعرف على هوية الأشخاص.
8. **كيف تتابع الواجهة التقدم؟**
   بـ polling عبر React Query كل 1.5 ثانية حتى تصل الحالة إلى `done` أو `failed`، والتقدم الفعلي (`progress`، `current_step`) يكتبه الخادم.
9. **كيف تقيسون دقة النظام؟**
   [backend/eval/run-eval.ts](backend/eval/run-eval.ts) يشغّل حالات معروفة من `cases.json` على نفس وحدات الإنتاج، ويحفظ النتائج في `eval/results/`، ويرفعها إلى `eval_runs` لتظهر في صفحة المشرف.
10. **هل يمكن تغيير مزوّد الذكاء الاصطناعي؟**
    نعم من حيث التصميم: توجد واجهتان `TranscriptionProvider` و`AnalysisProvider` ([providers/types.ts](backend/supabase/functions/_shared/providers/types.ts))، والاختيار يتم بمتغيرات البيئة. لكن Gemini وAnthropic حالياً `DisabledProvider` فقط.

</div>
