// Playwright helpers that fake a signed-in session and user-scoped REST data, so signed-in
// screens can be screenshot/E2E-tested without creating real users on the hosted project.
// Public data (rules, demo submissions) still comes from the real backend.
import fs from "node:fs";

export const MOCK_USER_ID = "11111111-2222-4333-8444-555555555555";
const now = Date.now();
const iso = (minsAgo) => new Date(now - minsAgo * 60_000).toISOString();

function readEnv() {
  // Match Vite's production env precedence so local-backend tests seed the right auth key.
  const values = {};
  for (const name of [".env", ".env.local", ".env.production", ".env.production.local"]) {
    const file = new URL(`../backend/${name}`, import.meta.url);
    if (!fs.existsSync(file)) continue;
    const txt = fs.readFileSync(file, "utf8");
    Object.assign(values, Object.fromEntries(
      txt.split(/\r?\n/).filter((l) => l.includes("=") && !l.trim().startsWith("#"))
        .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
    ));
  }
  for (const name of ["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY"])
    if (process.env[name]) values[name] = process.env[name];
  return values;
}

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
function fakeJwt() {
  const exp = Math.floor(now / 1000) + 3600;
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: MOCK_USER_ID, role: "authenticated", exp, email: "creator@example.com" })}.sig`;
}

const base = {
  user_id: MOCK_USER_ID, is_demo: false, file_path: null, audio_path: null, text_content: null,
  has_written_contract: false, ai_used: false, mawthooq_license_no: null, parent_id: null, sha256: "ab".repeat(32),
  error_message: null, thumbnail_path: null, media_deleted_at: null, is_paid_ad: true,
};
export const MOCK_SUBMISSIONS = [
  { ...base, id: "aaaaaaaa-0000-4000-8000-000000000001", kind: "video", title: "إعلان متجر نخلة – النسخة الأولى", caption: "", platform: "snapchat", product_category: "health", duration_seconds: 38, status: "analyzing", progress: 55, current_step: "llm", overall_status: null, created_at: iso(1), analyzed_at: null },
  { ...base, id: "aaaaaaaa-0000-4000-8000-000000000002", kind: "video", title: "مراجعة عطر العود", caption: "", platform: "tiktok", product_category: "beauty", duration_seconds: 61, status: "done", progress: 100, current_step: "done", overall_status: "needs_fixes", created_at: iso(60 * 5), analyzed_at: iso(60 * 5) },
  { ...base, id: "aaaaaaaa-0000-4000-8000-000000000003", kind: "image", title: "بوستر عرض اليوم الوطني", caption: "", platform: "instagram", product_category: "food", duration_seconds: null, status: "done", progress: 100, current_step: "done", overall_status: "review", created_at: iso(60 * 26), analyzed_at: iso(60 * 26) },
  { ...base, id: "aaaaaaaa-0000-4000-8000-000000000004", kind: "text", title: "تغريدة إطلاق التطبيق", caption: "", platform: "x", product_category: "finance", duration_seconds: null, status: "done", progress: 100, current_step: "done", overall_status: "ready", created_at: iso(60 * 50), analyzed_at: iso(60 * 50) },
  { ...base, id: "aaaaaaaa-0000-4000-8000-000000000005", kind: "video", title: "سنابات رحلة العلا", caption: "", platform: "snapchat", product_category: "other", duration_seconds: 84, status: "failed", progress: 40, current_step: "transcribe", overall_status: null, error_message: "تعذّر تفريغ الصوت: الملف لا يحتوي على مسار صوتي.", created_at: iso(60 * 72), analyzed_at: null },
];

export const DEMO_SUBMISSIONS = [
  {
    ...base,
    id: "d0000000-0000-0000-0000-000000000001",
    is_demo: true,
    kind: "video",
    title: "إعلان شاي التنحيف – النسخة الأولى",
    caption: "جربت شاي التنحيف الجديد 🔥 كود الخصم SALEEM20 الرابط في البايو",
    platform: "snapchat",
    product_category: "health",
    duration_seconds: 42,
    status: "done",
    progress: 100,
    current_step: "done",
    overall_status: "needs_fixes",
    created_at: iso(120),
    analyzed_at: iso(120),
  },
  {
    ...base,
    id: "d0000000-0000-0000-0000-000000000002",
    parent_id: "d0000000-0000-0000-0000-000000000001",
    is_demo: true,
    kind: "video",
    title: "إعلان شاي الأعشاب – النسخة المعدّلة",
    caption: "إعلان مدفوع بالتعاون مع متجر نخلة",
    platform: "snapchat",
    product_category: "health",
    duration_seconds: 38,
    status: "done",
    progress: 100,
    current_step: "done",
    overall_status: "ready",
    mawthooq_license_no: "MW-2026-48213",
    has_written_contract: true,
    ai_used: true,
    created_at: iso(60),
    analyzed_at: iso(60),
  },
];

const DEMO_FINDINGS_1 = [
  { id: "f1", run_id: "a0000000-0000-0000-0000-000000000001", rule_code: "MAW-01", severity: "violation", start_seconds: 0, end_seconds: 5, source: "transcript", quote: "لا توجد كلمة «إعلان»", reason_ar: "المحتوى ترويجي دون إفصاح", reason_en: "Promotional without disclosure", suggestion_ar: "ابدأ المقطع بعبارة إعلان مدفوع", suggestion_en: "Open with paid ad", confidence: 0.95 },
  { id: "f2", run_id: "a0000000-0000-0000-0000-000000000001", rule_code: "COM-01", severity: "violation", start_seconds: 12, end_seconds: 24, source: "transcript", quote: "هذا الشاي ينحف", reason_ar: "ادعاء صحي مطلق", reason_en: "Absolute health claim", suggestion_ar: "احذف وعود الوزن", suggestion_en: "Remove weight claims", confidence: 0.90 },
  { id: "f3", run_id: "a0000000-0000-0000-0000-000000000001", rule_code: "AI-01", severity: "violation", start_seconds: null, end_seconds: null, source: "metadata", quote: null, reason_ar: "ذكاء اصطناعي دون إفصاح", reason_en: "AI without disclosure", suggestion_ar: "أضف معدل بالذكاء الاصطناعي", suggestion_en: "Add AI edited", confidence: 0.95 },
  { id: "f4", run_id: "a0000000-0000-0000-0000-000000000001", rule_code: "MAW-03", severity: "warning", start_seconds: null, end_seconds: null, source: "metadata", quote: null, reason_ar: "لا يوجد عقد مكتوب", reason_en: "No written contract", suggestion_ar: "وثق الاتفاق كتابيا", suggestion_en: "Put agreement in writing", confidence: 0.90 },
  { id: "f5", run_id: "a0000000-0000-0000-0000-000000000001", rule_code: "MAW-04", severity: "warning", start_seconds: null, end_seconds: null, source: "metadata", quote: null, reason_ar: "لم يدخل رقم رخصة موثوق", reason_en: "No license number", suggestion_ar: "أدخل رخصة موثوق", suggestion_en: "Enter license", confidence: 0.80 },
  { id: "f6", run_id: "a0000000-0000-0000-0000-000000000001", rule_code: "MAW-02", severity: "warning", start_seconds: 24, end_seconds: 33, source: "transcript", quote: "منتج تنحيف", reason_ar: "منتج صحي يحتاج ترخيص", reason_en: "Health product requires license", suggestion_ar: "تأكد من الترخيص", suggestion_en: "Confirm license", confidence: 0.60 },
];

const DEMO_TRANSCRIPT_1 = {
  submission_id: "d0000000-0000-0000-0000-000000000001",
  language: "ar",
  text: "هلا والله يا جماعة، اليوم بجرب لكم شاي جديد... هذا الشاي ينحف وتنزلين خمس كيلو في أسبوع ومضمون بدون أعراض جانبية. استخدموا كود SALEEM20 والرابط في البايو، اطلبوا الحين.",
  segments: [
    { start: 0, end: 12, text: "هلا والله يا جماعة، اليوم بجرب لكم شاي جديد..." },
    { start: 12, end: 24, text: "هذا الشاي ينحف وتنزلين خمس كيلو في أسبوع ومضمون بدون أعراض جانبية." },
    { start: 24, end: 33, text: "استخدموا كود SALEEM20 والرابط في البايو، اطلبوا الحين." },
    { start: 33, end: 42, text: "تنبيهات استرشادية وليست موافقة رسمية" },
  ],
};

/** Adds REST mocks for public demo checks, reports, rulebook, and verification. */
export async function installMockPublic(context) {
  const json = (route, body, headers = {}) => route.fulfill({ status: 200, contentType: "application/json", headers, body: JSON.stringify(body) });
  const allSubs = [...MOCK_SUBMISSIONS, ...DEMO_SUBMISSIONS];

  await context.route("**/rest/v1/submissions**", async (route) => {
    const u = new URL(route.request().url());
    const idEq = u.searchParams.get("id")?.replace(/^eq\./, "");
    if (idEq) {
      const row = allSubs.find((s) => s.id === idEq);
      if (!row) return route.fallback ? route.fallback() : route.continue();
      return json(route, route.request().headers()["accept"]?.includes("vnd.pgrst.object") ? row : [row]);
    }
    const parentEq = u.searchParams.get("parent_id")?.replace(/^eq\./, "");
    if (parentEq) {
      const rows = allSubs.filter((s) => s.parent_id === parentEq);
      return json(route, rows);
    }
    if (u.searchParams.get("is_demo") === "eq.true") {
      return json(route, DEMO_SUBMISSIONS);
    }
    return route.fallback ? route.fallback() : route.continue();
  });

  await context.route("**/rest/v1/analysis_runs**", async (route) => {
    const u = new URL(route.request().url());
    const sid = u.searchParams.get("submission_id")?.replace(/^eq\./, "");
    if (sid === "d0000000-0000-0000-0000-000000000001") {
      return json(route, [{ id: "a0000000-0000-0000-0000-000000000001", submission_id: sid, prompt_version: "v1", llm_model: "gemini-2.0-flash", started_at: iso(120), completed_at: iso(120) }]);
    }
    if (sid === "d0000000-0000-0000-0000-000000000002") {
      return json(route, [{ id: "a0000000-0000-0000-0000-000000000002", submission_id: sid, prompt_version: "v1", llm_model: "gemini-2.0-flash", started_at: iso(60), completed_at: iso(60) }]);
    }
    return json(route, []);
  });

  await context.route("**/rest/v1/findings**", async (route) => {
    const u = new URL(route.request().url());
    const rid = u.searchParams.get("run_id")?.replace(/^eq\./, "");
    if (rid === "a0000000-0000-0000-0000-000000000001") {
      return json(route, DEMO_FINDINGS_1);
    }
    return json(route, []);
  });

  await context.route("**/rest/v1/transcripts**", async (route) => {
    const u = new URL(route.request().url());
    const sid = u.searchParams.get("submission_id")?.replace(/^eq\./, "");
    if (sid === "d0000000-0000-0000-0000-000000000001") {
      return json(route, DEMO_TRANSCRIPT_1);
    }
    return json(route, { submission_id: sid, language: "ar", text: "", segments: [] });
  });

  await context.route("**/rest/v1/compliance_logs**", async (route) => {
    const u = new URL(route.request().url());
    const sid = u.searchParams.get("submission_id")?.replace(/^eq\./, "");
    if (sid === "d0000000-0000-0000-0000-000000000002") {
      return json(route, {
        submission_id: sid,
        content_hash: "e7b9d1f3a5c7e9b1d3f5a7c9e1b3d5f7a9c1e3b5d7f9a1c3e5b7d9f1a3c5e7b9",
        created_at: iso(60),
      });
    }
    return route.fulfill({ status: 406, contentType: "application/json", body: JSON.stringify({ code: "PGRST116", message: "0 rows" }) });
  });

  await context.route("**/rest/v1/rpc/verify_compliance_log**", async (route) => {
    const post = route.request().postDataJSON?.() ?? {};
    if (post._sid === "d0000000-0000-0000-0000-000000000002") {
      return json(route, {
        valid: true,
        content_hash: "e7b9d1f3a5c7e9b1d3f5a7c9e1b3d5f7a9c1e3b5d7f9a1c3e5b7d9f1a3c5e7b9",
        platform: "snapchat",
        product_category: "health",
        duration_seconds: 38,
        created_at: iso(60),
        analyzed_at: iso(60),
        sealed_at: iso(60),
        findings_count: 0,
        overall_status: "ready",
      });
    }
    return json(route, null);
  });

  await context.route("**/rest/v1/evidence_frames**", (route) => json(route, []));
  await context.route("**/rest/v1/sources**", (route) => json(route, []));
}

/** Adds the fake session + REST mocks to a Playwright BrowserContext. */
export async function installMockAuth(context, { empty = false } = {}) {
  await installMockPublic(context);
  const env = readEnv();
  // An explicit VITE_SUPABASE_URL (e.g. an offline build) wins over backend/.env.
  const rawUrl = process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL;
  const url = (rawUrl && rawUrl.startsWith("http")) ? rawUrl : "http://127.0.0.1:54321";
  const ref = new URL(url).hostname.split(".")[0];
  const session = {
    access_token: fakeJwt(), token_type: "bearer", expires_in: 3600, expires_at: Math.floor(now / 1000) + 3600, refresh_token: "mock-refresh",
    user: { id: MOCK_USER_ID, aud: "authenticated", role: "authenticated", email: "creator@example.com", user_metadata: { display_name: "نورة" }, app_metadata: {}, created_at: iso(10000) },
  };
  await context.addInitScript(([key, value]) => {
    localStorage.setItem(key, value);
    localStorage.setItem("sb-127-auth-token", value);
    localStorage.setItem("sb-demo-auth-token", value);
  }, [`sb-${ref}-auth-token`, JSON.stringify(session)]);

  // Catch-all (registered first = lowest priority): forward un-mocked REST calls anonymously,
  // so public data (rules, demo rows) still loads without the fake JWT.
  await context.route("**/rest/v1/**", async (route) => {
    const headers = { ...route.request().headers() };
    delete headers["authorization"];
    try {
      const res = await route.fetch({ headers });
      return route.fulfill({ response: res });
    } catch {
      // Offline run (no reachable backend): answer like RLS would for rows the caller can't see.
      const single = headers["accept"]?.includes("vnd.pgrst.object");
      return single
        ? route.fulfill({ status: 406, contentType: "application/json", body: JSON.stringify({ code: "PGRST116", message: "0 rows" }) })
        : route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    }
  });
  const json = (route, body, headers = {}) => route.fulfill({ status: 200, contentType: "application/json", headers, body: JSON.stringify(body) });
  await context.route("**/auth/v1/**", (route) => json(route, session.user));
  await context.route("**/rest/v1/profiles**", (route) =>
    json(route, route.request().headers()["accept"]?.includes("vnd.pgrst.object") ? { id: MOCK_USER_ID, display_name: "نورة", mawthooq_license_no: "MW-2026-48213", platforms: ["snapchat", "tiktok"], created_at: iso(10000) } : [{ id: MOCK_USER_ID, display_name: "نورة", mawthooq_license_no: "MW-2026-48213", platforms: ["snapchat", "tiktok"], created_at: iso(10000) }]),
  );
  await context.route("**/rest/v1/user_roles**", (route) => json(route, [{ role: "admin" }]));
  // Admin evaluation page: serve the real harness output (backend/eval/results/latest.json) as an eval_runs row.
  await context.route("**/rest/v1/eval_runs**", (route) => {
    const file = new URL("../backend/eval/results/latest.json", import.meta.url);
    if (!fs.existsSync(file)) return json(route, []);
    const r = JSON.parse(fs.readFileSync(file, "utf8"));
    return json(route, [{ id: "eval-latest", created_at: r.at, label: "latest", llm_model: r.llm_model, prompt_version: r.prompt_version, mode: "text", summary: r.summary, per_rule: r.per_rule, cases: r.cases }]);
  });
  // --- Phase 5 mocks -------------------------------------------------------------
  const ORG = "bbbbbbbb-0000-4000-8000-000000000001";
  const CAMP = "cccccccc-0000-4000-8000-000000000001";
  const BATCH = "dddddddd-0000-4000-8000-000000000001";
  const members = [
    { org_id: ORG, user_id: MOCK_USER_ID, role: "owner", display_name: "نورة", email: "creator@example.com", created_at: iso(9000) },
    { org_id: ORG, user_id: "22222222-0000-4000-8000-000000000002", role: "creator", display_name: "فهد", email: "fahad@example.com", created_at: iso(8000) },
    { org_id: ORG, user_id: "22222222-0000-4000-8000-000000000003", role: "reviewer", display_name: "سارة", email: "sara@example.com", created_at: iso(7000) },
  ];
  const orgSubs = MOCK_SUBMISSIONS.map((m, i) => ({ ...m, org_id: ORG, campaign_id: i < 3 ? CAMP : null, user_id: members[i % 3].user_id }));
  await context.route("**/rest/v1/rpc/my_usage**", (route) => json(route, { plan: "agency", plan_name_ar: "وكالة", plan_name_en: "Agency", monthly_checks: 1000, max_batch: 20, orgs_allowed: true, used: 37, period_start: iso(14 * 1440), period_end: iso(-17 * 1440) }));
  await context.route("**/rest/v1/notifications**", (route) =>
    json(route, [
      { id: "n1", user_id: MOCK_USER_ID, kind: "check_done", submission_id: MOCK_SUBMISSIONS[1].id, payload: { title: MOCK_SUBMISSIONS[1].title, overall_status: "needs_fixes" }, read_at: null, created_at: iso(3) },
      { id: "n2", user_id: MOCK_USER_ID, kind: "share_review", submission_id: MOCK_SUBMISSIONS[3].id, payload: { decision: "approved", reviewer: "متجر نخلة" }, read_at: iso(30), created_at: iso(90) },
    ]),
  );
  await context.route("**/rest/v1/organizations**", (route) => {
    const org = { id: ORG, name: "وكالة نخلة للتسويق", created_by: MOCK_USER_ID, created_at: iso(9000) };
    return json(route, route.request().headers()["accept"]?.includes("vnd.pgrst.object") ? org : [{ ...org, org_members: members }]);
  });
  await context.route("**/rest/v1/org_members**", (route) => json(route, members));
  await context.route("**/rest/v1/org_invites**", (route) => json(route, [{ id: "i1", org_id: ORG, email: "khalid@example.com", role: "creator", token: "x", invited_by: MOCK_USER_ID, created_at: iso(60), expires_at: iso(-7 * 1440), accepted_at: null, accepted_by: null, revoked_at: null }]));
  await context.route("**/rest/v1/campaigns**", (route) => json(route, [{ id: CAMP, org_id: ORG, name: "حملة اليوم الوطني", brand: "متجر نخلة", starts_on: "2026-09-15", ends_on: "2026-09-30", created_by: MOCK_USER_ID, created_at: iso(3000) }]));
  await context.route("**/rest/v1/batches**", (route) => {
    const u = new URL(route.request().url());
    const b = { id: BATCH, user_id: MOCK_USER_ID, name: "إعلانات رمضان", created_at: iso(2000) };
    if (u.searchParams.get("id")) return json(route, route.request().headers()["accept"]?.includes("vnd.pgrst.object") ? b : [b]);
    return json(route, [{ ...b, submissions: MOCK_SUBMISSIONS.map((m) => ({ id: m.id, status: m.status, overall_status: m.overall_status })) }]);
  });
  await context.route("**/rest/v1/submissions**", async (route) => {
    const u = new URL(route.request().url());
    const idEq = u.searchParams.get("id")?.replace(/^eq\./, "");
    if (idEq) {
      const row = MOCK_SUBMISSIONS.find((s) => s.id === idEq);
      if (!row) return route.continue(); // demo rows come from the real backend
      return json(route, route.request().headers()["accept"]?.includes("vnd.pgrst.object") ? row : [row]);
    }
    if (u.searchParams.get("org_id")) return json(route, orgSubs);
    if (u.searchParams.get("batch_id")) return json(route, MOCK_SUBMISSIONS.map((m) => ({ ...m, findings: m.overall_status === "needs_fixes" ? [{ rule_code: "MAW-01", severity: "violation", run_id: "r" }, { rule_code: "COM-01", severity: "violation", run_id: "r" }] : m.overall_status === "review" ? [{ rule_code: "CNT-03", severity: "warning", run_id: "r" }] : [], analysis_runs: [{ id: "r", started_at: m.created_at }] })));
    if (u.searchParams.get("user_id")) {
      let rows = empty ? [] : MOCK_SUBMISSIONS;
      const st = u.searchParams.get("overall_status")?.replace(/^eq\./, "");
      if (st) rows = rows.filter((r) => r.overall_status === st && r.status === "done");
      return json(route, rows, { "content-range": `0-${Math.max(rows.length - 1, 0)}/${rows.length}` });
    }
    return route.continue();
  });
}
