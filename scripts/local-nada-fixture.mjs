// LOCAL ONLY: recreates the Nada Cream manual-test advertisement in the local demo organisation so the redesigned
// pages can be exercised without a model call. The V1 analysis rows are a FIXTURE copied from the manual test
// (labelled «fixture» in analysis_runs.llm_model) — never presented as a live Gemini run.
// Usage: node scripts/demo-env.mjs node scripts/local-nada-fixture.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL ?? "";
if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(url))
  throw new Error(
    `refusing to run against ${url || "an unknown URL"}: local stack only`,
  );
const db = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
// D207: under scripts/isolated-stack.mjs run, DEMO_STATE_DIR points at .iso/demo; never mix stacks.
const stateDir = process.env.DEMO_STATE_DIR ?? "demo";
if (
  (process.env.SALEEM_ISO === "1" || /[\\/]\.iso[\\/]?/.test(stateDir)) &&
  !/:544\d\d$/.test(new URL(url).host)
)
  throw new Error(
    "refusing: isolated-stack state but the URL is not the isolated stack",
  );
const creds = JSON.parse(
  readFileSync(`${stateDir}/.demo-credentials.json`, "utf8"),
);
const orgId = creds.org_id;
const must = (r) => {
  if (r.error) throw new Error(r.error.message);
  return r.data;
};
const users = must(await db.auth.admin.listUsers({ perPage: 200 })).users;
const uid = (email) => users.find((u) => u.email === email)?.id;
const marketer = uid("marketer@demo.saleem.app");
if (!marketer) throw new Error("run npm run demo:seed first");

// Features used by the upgrade (local demo org only).
const settings = must(
  await db.from("org_settings").select("features").eq("org_id", orgId).single(),
);
must(
  await db
    .from("org_settings")
    .update({
      features: {
        ...(settings.features ?? {}),
        saleem_fix: true,
        partners: true,
      },
    })
    .eq("org_id", orgId),
);

let product = must(
  await db
    .from("products")
    .select("id")
    .eq("org_id", orgId)
    .eq("name_ar", "كريم ندى")
    .maybeSingle(),
);
if (!product) {
  product = must(
    await db
      .from("products")
      .insert({
        org_id: orgId,
        name_ar: "كريم ندى",
        name_en: "Nada Cream",
        sector: "cosmetics",
        product_type: "skincare",
        regulator: "SFDA",
        key_facts: {
          cosmetics: { intended_use_ar: "العناية اليومية بالبشرة" },
        },
        status: "approved",
        created_by: marketer,
      })
      .select("id")
      .single(),
  );
}
const title = "كريم ندى — بيانات اختبار محلية";
const existing = must(
  await db
    .from("promotions")
    .select("id")
    .eq("org_id", orgId)
    .eq("title", title)
    .maybeSingle(),
);
if (existing) {
  console.log(
    JSON.stringify({ promotion: existing.id, note: "already present" }),
  );
  process.exit(0);
}
const promo = must(
  await db
    .from("promotions")
    .insert({
      org_id: orgId,
      owner_id: marketer,
      title,
      product_id: product.id,
      sector: "cosmetics",
      channels: ["snapchat"],
      communication_type: "general_commercial",
      distribution: "owned",
      is_paid: true,
      caption:
        "ودّعي التصبغات مع كريم ندى! بشرة صافية خلال 3 أيام فقط، ونتائج مضمونة لجميع أنواع البشرة.",
    })
    .select("id")
    .single(),
);
const sid = crypto.randomUUID();
const path = `${marketer}/${sid}/original.mp4`;
must(
  await db.storage
    .from("media")
    .upload(path, readFileSync("frontend/public/sample/nada-cream-v1.mp4"), {
      contentType: "video/mp4",
      upsert: true,
    }),
);
must(
  await db.from("submissions").insert({
    id: sid,
    user_id: marketer,
    kind: "video",
    title,
    caption:
      "ودّعي التصبغات مع كريم ندى! بشرة صافية خلال 3 أيام فقط، ونتائج مضمونة لجميع أنواع البشرة.",
    platform: "snapchat",
    product_category: "beauty",
    is_paid_ad: true,
    has_written_contract: false,
    ai_used: true,
    promotion_id: promo.id,
    org_id: orgId,
    sha256: "fixture-nada-v1",
    duration_seconds: 15,
    file_path: path,
  }),
);
must(
  await db
    .from("submissions")
    .update({
      status: "done",
      overall_status: "needs_fixes",
      analyzed_at: new Date().toISOString(),
      progress: 100,
    })
    .eq("id", sid),
);
const rb = must(
  await db
    .from("rulebook_versions")
    .select("id")
    .eq("status", "published")
    .single(),
);
const run = must(
  await db
    .from("analysis_runs")
    .insert({
      submission_id: sid,
      status: "done",
      rulebook_version_id: rb.id,
      llm_model: "fixture (manual test copy)",
      asr_model: "fixture",
    })
    .select("id")
    .single(),
);
must(
  await db.from("transcripts").upsert({
    submission_id: sid,
    language: "ar",
    provider: "fixture",
    full_text:
      "كريم ندى التجريبي يزيل التصبغات تماما خلال ثلاثة أيام فقط والنتيجة مضمونة لكل أنواع البشرة والنتيجة مضمونة لكل أنواع البشرة بلا أي آثار جانبية",
    segments: [
      {
        start: 0,
        end: 5.4,
        text: "كريم ندى التجريبي يزيل التصبغات تماما خلال ثلاثة أيام فقط والنتيجة مضمونة لكل أنواع البشرة",
      },
      {
        start: 5.461,
        end: 10,
        text: "والنتيجة مضمونة لكل أنواع البشرة بلا أي آثار جانبية",
      },
    ],
  }),
);
const com = {
  explanation_ar: "ادعاء مطلق بنتيجة مضمونة في محتوى ترويجي.",
  explanation_en: "Absolute, guaranteed-outcome claim in promotional content.",
  fix_ar:
    "احذف وعد النتيجة المضمونة، واذكر الشروط أو العوامل التي تؤثر في النتيجة.",
  fix_en: "Remove the guaranteed-outcome promise.",
};
const rows = [
  [
    "COM-01",
    "violation",
    "transcript",
    "كريم ندى التجريبي يزيل التصبغات تماما خلال ثلاثة أيام فقط والنتيجة مضمونة لكل أنواع البشرة",
    0,
    com,
  ],
  [
    "COM-01",
    "violation",
    "caption",
    "ودّعي التصبغات مع كريم ندى! بشرة صافية خلال 3 أيام فقط، ونتائج مضمونة لجميع أنواع البشرة",
    null,
    com,
  ],
  ["COM-01", "violation", "frame", "النتيجة مضمونة خلال ٣ أيام", 11, com],
  [
    "COM-01",
    "violation",
    "transcript",
    "والنتيجة مضمونة لكل أنواع البشرة بلا أي آثار جانبية",
    5.461,
    com,
  ],
  ["COM-01", "violation", "frame", "النتيجة مضمونة خلال ٣ أيام", 15, com],
  [
    "MAW-01",
    "violation",
    "metadata",
    "تم تحديد «إعلان مدفوع»، ولا توجد كلمة «إعلان» في الوصف أو أول 5 ثوانٍ",
    0,
    {
      explanation_ar:
        "المحتوى ترويجي دون إفصاح صريح عن الإعلان في الوصف أو في أول 5 ثوانٍ.",
      explanation_en: "Promotional content without a clear ad disclosure.",
      fix_ar: "ابدأ المقطع بعبارة «إعلان مدفوع» واكتب #إعلان في بداية الوصف.",
      fix_en: 'Open with "paid ad".',
    },
  ],
  [
    "AI-01",
    "warning",
    "metadata",
    "تم تحديد «استخدمت الذكاء الاصطناعي» دون إفصاح في الوصف",
    null,
    {
      explanation_ar:
        "استُخدم الذكاء الاصطناعي في إنشاء المحتوى أو تعديله دون إفصاح واضح.",
      explanation_en: "AI was used without a clear disclosure.",
      fix_ar:
        "أضف «المحتوى معدّل بالذكاء الاصطناعي» في الوصف أو على الشاشة في البداية.",
      fix_en: "Add an AI disclosure.",
    },
  ],
];
must(
  await db.from("findings").insert(
    rows.map(
      ([rule_code, severity, evidence_type, evidence_text, t_start, x]) => ({
        run_id: run.id,
        submission_id: sid,
        rule_code,
        severity,
        evidence_type,
        evidence_text,
        t_start,
        t_end: t_start == null ? null : Number(t_start) + 1,
        source: "deterministic",
        finding_type:
          rule_code === "MAW-01" || rule_code === "AI-01"
            ? "missing_required"
            : "potential_risk",
        confidence: 0.9,
        ...x,
      }),
    ),
  ),
);
console.log(
  JSON.stringify({
    promotion: promo.id,
    submission: sid,
    note: "fixture (MAW-03/04 not included: own-channel ad, D171)",
  }),
);
