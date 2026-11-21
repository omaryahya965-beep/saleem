// V2 completion §16 (D203): governance half of the Nada Cream acceptance scenario, run as the real role users through
// the same RPCs the UI calls. ISOLATED STACK ONLY (refuses any URL that is not 127.0.0.1:544xx).
//
//   node scripts/isolated-stack.mjs run -- node scripts/nada-acceptance.mjs --promo <id> --creds <file.json>
//
// Honest by construction: the marketer answers each open finding truthfully (it will be corrected), no evidence
// document is invented, and the reviewer's decision is whatever can_decide allows for the current version.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const arg = (k) => process.argv[process.argv.indexOf(`--${k}`) + 1];
const url = process.env.SUPABASE_URL ?? "";
if (!/^http:\/\/127\.0\.0\.1:544\d\d$/.test(url))
  throw new Error(`refusing: ${url} is not the isolated stack`);
const anon = process.env.SUPABASE_ANON_KEY;
const promo = arg("promo");
const { password, domain = "demo.saleem.app" } = JSON.parse(
  readFileSync(arg("creds"), "utf8"),
);
const log = [];
const step = (n, what, data) => {
  log.push({ step: n, what, ...data });
  console.log(`${n}. ${what}`, JSON.stringify(data));
};

async function as(user) {
  const c = createClient(url, anon, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({
    email: `${user}@${domain}`,
    password,
  });
  if (error) throw error;
  return { c, id: data.user.id };
}
const rpc = async (c, fn, args) => {
  const { data, error } = await c.rpc(fn, args);
  return error ? { error: error.message } : { data };
};

const mk = await as("marketer");
const { data: p } = await mk.c
  .from("promotions")
  .select("id,title,review_status,current_version_id")
  .eq("id", promo)
  .single();
const { data: runs } = await mk.c
  .rpc("latest_run_id", { _sid: p.current_version_id })
  .then(
    (r) => r,
    () => ({ data: null }),
  );
const { data: findings } = await mk.c
  .from("findings")
  .select("id,rule_code,severity,finding_type,status,run_id")
  .eq("submission_id", p.current_version_id);
const latest =
  runs ??
  findings
    ?.map((f) => f.run_id)
    .sort()
    .at(-1);
const open = (findings ?? []).filter((f) => !latest || f.run_id === latest);
step(11, "current version findings", {
  status: p.review_status,
  findings: open.map((f) => `${f.rule_code}:${f.severity}`),
});

for (const f of open) {
  const r = await rpc(mk.c, "respond_finding", {
    _finding: f.id,
    _action: "agree_will_action",
    _comment: "سيُعدَّل في الإصدار التالي؛ لا يوجد دليل يدعم هذا الادعاء.",
  });
  if (r.error) step(11, `respond ${f.rule_code}`, r);
}
step(12, "can_submit", await rpc(mk.c, "can_submit", { _pid: promo }));
step(
  12,
  "submit_promotion",
  await rpc(mk.c, "submit_promotion", {
    _pid: promo,
    _note: "الإصدار 2 بعد تصحيح الفيديو داخل سليم.",
  }),
);

const lead = await as("lead");
const rv = await as("reviewer");
step(
  13,
  "assign_reviewer",
  await rpc(lead.c, "assign_reviewer", { _pid: promo, _user: rv.id }),
);

step(
  14,
  "open_review (reviewer)",
  await rpc(rv.c, "open_review", { _pid: promo }),
);
for (const f of open) {
  const r = await rpc(rv.c, "respond_finding", {
    _finding: f.id,
    _action:
      f.rule_code === "AI-01"
        ? "clarification_required"
        : "agree_please_action",
    _comment:
      f.rule_code === "AI-01"
        ? "وضّحوا هل استُخدم الذكاء الاصطناعي في إنتاج الإعلان."
        : "الادعاء المطلق ما زال مسموعاً أو ظاهراً في الإصدار 2.",
  });
  if (r.error) step(14, `reviewer response ${f.rule_code}`, r);
}
const can = await rpc(rv.c, "can_decide", { _pid: promo });
step(14, "can_decide (reviewer)", can);
const decision = can.data?.approve_ok
  ? await rpc(rv.c, "decide_promotion", {
      _pid: promo,
      _decision: "conditional_approve",
      _conditions: [
        {
          description: "إظهار عبارة «إعلان» في نص المنشور عند النشر",
          evidence_required: false,
        },
      ],
    })
  : await rpc(rv.c, "decide_promotion", {
      _pid: promo,
      _decision: "request_changes",
      _reason_other:
        "الإصدار 2 أزال غياب الإفصاح (MAW-01) لكن ادعاءات النتيجة المطلقة ما زالت قائمة (COM-01). احذفها أو قدّم دليلاً علمياً معتمداً.",
    });
step(
  14,
  can.data?.approve_ok ? "conditional approval" : "requested changes",
  decision,
);

const { data: after } = await mk.c
  .from("promotions")
  .select("review_status")
  .eq("id", promo)
  .single();
step(15, "status after decision", { review_status: after?.review_status });
// Steps 15–16 continue only with a legitimate v3 (claims removed or real evidence); nothing is fabricated here.
console.log(JSON.stringify({ log }, null, 1).length > 0 ? "done" : "");
