// Builds an additive seed migration for the demo pair from REAL pipeline results
// (docs/demo/clips/*.json produced by `npm --workspace backend run clips`), and copies the
// synthetic clips to frontend/public/demo/ so demo reports have a playable video.
// Usage: node scripts/build-demo-seed.mjs
import crypto from "node:crypto";
import fs from "node:fs";

const FIX = "backend/tests/fixtures/synthetic";
const OUT = "backend/supabase/migrations/20261014040000_demo_pipeline_pair.sql";
const pair = [
  { id: "d0000000-0000-0000-0000-000000000003", clip: "slimming-tea-ar", parent: null, title: "إعلان شاي التنحيف (مقطع اصطناعي للعرض)" },
  { id: "d0000000-0000-0000-0000-000000000004", clip: "herbal-tea-fixed-ar", parent: "d0000000-0000-0000-0000-000000000003", title: "إعلان شاي الأعشاب – النسخة المعدّلة (مقطع اصطناعي للعرض)" },
];

const q = (v) => (v === null || v === undefined ? "null" : `'${String(v).replace(/'/g, "''")}'`);
const j = (v) => `${q(JSON.stringify(v))}::jsonb`;
fs.mkdirSync("frontend/public/demo", { recursive: true });

let sql = `-- Demo pair produced by the real pipeline (${new Date().toISOString().slice(0, 10)}).
-- Synthetic Saudi-dialect clips (TTS + slides) → browser extraction → ${"whisper-1"} → vision model → deterministic → merge.
-- Labelled as demo + synthetic. Additive and idempotent (on conflict do nothing).
`;
for (const d of pair) {
  const r = JSON.parse(fs.readFileSync(`docs/demo/clips/${d.clip}.json`, "utf8"));
  const side = JSON.parse(fs.readFileSync(`${FIX}/${d.clip}.json`, "utf8")).submission;
  const bytes = fs.readFileSync(`${FIX}/${d.clip}.webm`);
  fs.copyFileSync(`${FIX}/${d.clip}.webm`, `frontend/public/demo/${d.clip}.webm`);
  const sha = crypto.createHash("sha256").update(bytes).digest("hex");
  const runId = d.id.replace(/^d/, "a");
  sql += `
insert into public.submissions (id, is_demo, kind, caption, platform, product_category, is_paid_ad, has_written_contract, ai_used,
  mawthooq_license_no, parent_id, sha256, duration_seconds, status, progress, current_step, overall_status, title, file_path, created_at, analyzed_at)
values (${q(d.id)}, true, 'video', ${q(side.caption)}, ${q(side.platform)}, ${q(side.product_category)}, ${side.is_paid_ad}, ${side.has_written_contract}, ${side.ai_used},
  ${q(side.mawthooq_license_no)}, ${q(d.parent)}, ${q(sha)}, ${Number(r.duration).toFixed(1)}, 'done', 100, 'done', ${q(r.status)}, ${q(d.title)},
  ${q(`demo:/demo/${d.clip}.webm`)}, now() - interval '${d.parent ? 30 : 90} minutes', now() - interval '${d.parent ? 29 : 89} minutes')
on conflict (id) do nothing;

insert into public.transcripts (submission_id, full_text, segments, language, provider)
values (${q(d.id)}, ${q(r.transcript.map((s) => s.text).join(" "))}, ${j(r.transcript)}, 'ar', ${q(`openai:${r.models.asr}`)})
on conflict (submission_id) do nothing;

insert into public.analysis_runs (id, submission_id, rulebook_version_id, rulebook_version, llm_model, asr_model, llm_provider, asr_provider,
  prompt_version, started_at, finished_at, status, token_usage, cost_usd, durations_ms, frames_count, on_screen_text, step_outputs)
select ${q(runId)}, ${q(d.id)}, v.id, v.version_label, ${q(r.models.llm)}, ${q(r.models.asr)}, 'openai', 'openai',
  'v3-2026-10', now() - interval '${d.parent ? 30 : 90} minutes', now() - interval '${d.parent ? 29 : 89} minutes', 'done',
  ${j(r.usage)}, ${Number(r.cost_usd).toFixed(5)}, ${j(r.timings_ms)}, ${r.frames}, ${j(r.on_screen_text)}, ${j({ source: "docs/demo/clips/" + d.clip + ".json", synthetic: true })}
from public.rulebook_versions v where v.is_active
on conflict (id) do nothing;
`;
  for (const f of r.findings) {
    sql += `insert into public.findings (run_id, submission_id, rule_code, severity, t_start, t_end, evidence_type, evidence_text, explanation_ar, explanation_en, fix_ar, fix_en, confidence, source)
select ${q(runId)}, ${q(d.id)}, ${q(f.rule_code)}, ${q(f.severity)}, ${f.t_start ?? "null"}, ${f.t_end ?? "null"}, ${q(f.evidence_type)}, ${q(f.evidence_text)}, ${q(f.explanation_ar)}, ${q(f.explanation_en)}, ${q(f.fix_ar)}, ${q(f.fix_en)}, ${f.confidence}, ${q(f.source)}
where not exists (select 1 from public.findings where run_id = ${q(runId)} and rule_code = ${q(f.rule_code)} and coalesce(t_start, -1) = ${f.t_start ?? -1});
`;
  }
  sql += `
insert into public.compliance_logs (submission_id, content_hash) values (${q(d.id)}, ${q(sha)}) on conflict (submission_id) do nothing;
update public.compliance_logs set report_hash = public.compute_report_hash(submission_id), generated_at = now()
where submission_id = ${q(d.id)} and report_hash is null;
`;
}
fs.writeFileSync(OUT, sql);
console.log(`wrote ${OUT} and frontend/public/demo/*.webm`);
