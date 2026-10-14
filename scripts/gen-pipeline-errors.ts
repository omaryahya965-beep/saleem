// Regenerates the pipelineErrors entries in ar.json/en.json from the backend message table,
// so the UI and the Edge Functions can never drift.  npx tsx scripts/gen-pipeline-errors.ts
import fs from "node:fs";
import { PROVIDER_ERROR_MESSAGES } from "../backend/supabase/functions/_shared/providers/errors.ts";
for (const lang of ["ar", "en"] as const) {
  const file = `frontend/src/i18n/${lang}.json`;
  const dict = JSON.parse(fs.readFileSync(file, "utf8"));
  const pe: Record<string, string> = {};
  for (const [k, v] of Object.entries(PROVIDER_ERROR_MESSAGES)) pe[`provider_${k}`] = v[lang];
  pe.pipeline_unexpected = lang === "ar" ? "حدث خطأ غير متوقع أثناء الفحص. أعد المحاولة." : "An unexpected error happened during the check. Please retry.";
  dict.pipelineErrors = pe;
  fs.writeFileSync(file, JSON.stringify(dict, null, 2) + "\n");
}
console.log("pipelineErrors updated");
