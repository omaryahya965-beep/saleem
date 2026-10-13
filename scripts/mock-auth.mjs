// Playwright helpers that fake a signed-in session and user-scoped REST data, so signed-in
// screens can be screenshot/E2E-tested without creating real users on the hosted project.
// Public data (rules, demo submissions) still comes from the real backend.
import fs from "node:fs";

export const MOCK_USER_ID = "11111111-2222-4333-8444-555555555555";
const now = Date.now();
const iso = (minsAgo) => new Date(now - minsAgo * 60_000).toISOString();

function readEnv() {
  const txt = fs.readFileSync(new URL("../backend/.env", import.meta.url), "utf8");
  return Object.fromEntries(
    txt.split(/\r?\n/).filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
  );
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

/** Adds the fake session + REST mocks to a Playwright BrowserContext. */
export async function installMockAuth(context, { empty = false } = {}) {
  const env = readEnv();
  const url = env.VITE_SUPABASE_URL;
  const ref = new URL(url).hostname.split(".")[0];
  const session = {
    access_token: fakeJwt(), token_type: "bearer", expires_in: 3600, expires_at: Math.floor(now / 1000) + 3600, refresh_token: "mock-refresh",
    user: { id: MOCK_USER_ID, aud: "authenticated", role: "authenticated", email: "creator@example.com", user_metadata: { display_name: "نورة" }, app_metadata: {}, created_at: iso(10000) },
  };
  await context.addInitScript(([key, value]) => localStorage.setItem(key, value), [`sb-${ref}-auth-token`, JSON.stringify(session)]);

  const json = (route, body, headers = {}) => route.fulfill({ status: 200, contentType: "application/json", headers, body: JSON.stringify(body) });
  await context.route(`${url}/auth/v1/**`, (route) => json(route, session.user));
  await context.route(`${url}/rest/v1/profiles**`, (route) =>
    json(route, route.request().headers()["accept"]?.includes("vnd.pgrst.object") ? { id: MOCK_USER_ID, display_name: "نورة", mawthooq_license_no: "MW-2026-48213", platforms: ["snapchat", "tiktok"], created_at: iso(10000) } : [{ id: MOCK_USER_ID, display_name: "نورة", mawthooq_license_no: "MW-2026-48213", platforms: ["snapchat", "tiktok"], created_at: iso(10000) }]),
  );
  await context.route(`${url}/rest/v1/submissions**`, async (route) => {
    const u = new URL(route.request().url());
    const idEq = u.searchParams.get("id")?.replace(/^eq\./, "");
    if (idEq) {
      const row = MOCK_SUBMISSIONS.find((s) => s.id === idEq);
      if (!row) return route.continue(); // demo rows come from the real backend
      return json(route, route.request().headers()["accept"]?.includes("vnd.pgrst.object") ? row : [row]);
    }
    if (u.searchParams.get("user_id")) {
      let rows = empty ? [] : MOCK_SUBMISSIONS;
      const st = u.searchParams.get("overall_status")?.replace(/^eq\./, "");
      if (st) rows = rows.filter((r) => r.overall_status === st && r.status === "done");
      return json(route, rows, { "content-range": `0-${Math.max(rows.length - 1, 0)}/${rows.length}` });
    }
    return route.continue();
  });
}
