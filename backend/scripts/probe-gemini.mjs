// Independent live REST probe: no SALEEM providers, compliance rules or Supabase imports.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const out = path.resolve(
  process.argv.find((a) => a.startsWith("--output="))?.slice(9) ??
    path.join(root, "backend/eval/results/gemini-api-diagnostics.json"),
);
fs.mkdirSync(path.dirname(out), { recursive: true });
const envFile = path.join(root, "backend/supabase/functions/.env");
const envText = fs.existsSync(envFile) ? fs.readFileSync(envFile, "utf8") : "";
const key =
  process.env.GEMINI_API_KEY ||
  envText
    .match(/^\s*GEMINI_API_KEY\s*=\s*(.+)$/m)?.[1]
    ?.trim()
    .replace(/^["']|["']$/g, "");
if (!key || key.startsWith("your-")) {
  console.error("No Gemini credential is configured.");
  process.exit(1);
}
const clean = (s) =>
  String(s)
    .replaceAll(key, "[redacted]")
    .replace(/AIza[\w-]+/g, "[redacted]")
    .replace(/([?&](?:key|api_key)=)[^&\s]+/gi, "$1[redacted]")
    .slice(0, 1000);
const report = {
  at: new Date().toISOString(),
  transport: "direct official Gemini REST API",
  billing_changed: false,
  requests: [],
  models: [],
  selected_model: null,
};
const save = () => fs.writeFileSync(out, JSON.stringify(report, null, 2));
async function call(label, endpoint, body, timeout = 20_000) {
  const attempts = [];
  for (let attempt = 1; attempt <= 3; attempt++) {
    const start = Date.now();
    let status = null,
      json = null,
      error = null;
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/${endpoint}`,
        {
          method: body ? "POST" : "GET",
          headers: {
            "x-goog-api-key": key,
            ...(body ? { "Content-Type": "application/json" } : {}),
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
          signal: AbortSignal.timeout(timeout),
        },
      );
      status = res.status;
      const raw = await res.text();
      try {
        json = JSON.parse(raw);
      } catch {
        error = clean(raw);
      }
      if (!res.ok) error = clean(json?.error?.message ?? error ?? "API error");
    } catch (e) {
      error = clean(
        e?.name === "TimeoutError"
          ? "Request timed out"
          : (e?.message ?? "Network failure"),
      );
    }
    const row = {
      attempt,
      http_status: status,
      latency_ms: Date.now() - start,
      ...(error ? { error } : {}),
    };
    attempts.push(row);
    console.log(JSON.stringify({ test: label, ...row }));
    const retry =
      status === null || status === 408 || status === 429 || status >= 500;
    if (!retry || attempt === 3 || (status >= 200 && status < 300)) {
      const text =
        json?.candidates?.[0]?.content?.parts
          ?.filter((p) => !p.thought)
          .map((p) => p.text ?? "")
          .join("") ?? "";
      const record = {
        test: label,
        status: status >= 200 && status < 300 ? "PASS" : "FAIL",
        http_status: status,
        attempts,
        latency_ms: attempts.reduce((n, a) => n + a.latency_ms, 0),
        ...(error ? { error } : {}),
        ...(text ? { text: clean(text) } : {}),
        ...(json?.usageMetadata ? { usage: json.usageMetadata } : {}),
        ...(json?.candidates?.[0]?.finishReason
          ? { finish_reason: json.candidates[0].finishReason }
          : {}),
      };
      report.requests.push(record);
      save();
      return { record, json };
    }
    await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempt - 1)));
  }
}
const listed = await call("models-list", "models?pageSize=1000");
report.models = (listed.json?.models ?? []).map((m) => ({
  name: m.name,
  supported_generation_methods:
    m.supportedGenerationMethods ?? m.supportedActions ?? [],
}));
save();
for (const model of [
  "gemini-3.8-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite",
]) {
  const access = await call(`${model}:availability`, `models/${model}`);
  const available = access.record.status === "PASS";
  access.record.available = available;
  if (!available) {
    report.requests.push({
      test: `${model}:minimal`,
      status: "BLOCKED",
      reason: "Model unavailable to this key or model lookup failed",
    });
    save();
    continue;
  }
  const minimal = await call(
    `${model}:minimal`,
    `models/${model}:generateContent`,
    { contents: [{ parts: [{ text: "Reply with exactly OK." }] }] },
  );
  if (
    minimal.record.status === "PASS" &&
    minimal.record.text &&
    !report.selected_model
  )
    report.selected_model = model;
  save();
}
if (report.selected_model) {
  const model = report.selected_model;
  const generate = (label, parts, generationConfig) =>
    call(
      `${model}:${label}`,
      `models/${model}:generateContent`,
      {
        contents: [{ parts }],
        ...(generationConfig ? { generationConfig } : {}),
      },
      30_000,
    );
  await generate(
    "structured-json",
    [{ text: "Return an object with ok set to true." }],
    {
      responseMimeType: "application/json",
      responseJsonSchema: {
        type: "object",
        required: ["ok"],
        properties: { ok: { type: "boolean" } },
        additionalProperties: false,
      },
    },
  );
  await generate("arabic-text", [
    { text: "أعد كتابة هذه العبارة فقط: إعلان قهوة عربية بطعم الهيل." },
  ]);
  await generate("image-input", [
    {
      text: "Read the visible Arabic text in this image. If illegible, explicitly say so.",
    },
    {
      inlineData: {
        mimeType: "image/jpeg",
        data: fs
          .readFileSync(
            path.join(root, "backend/tests/fixtures/synthetic/frame-12s.jpg"),
          )
          .toString("base64"),
      },
    },
  ]);
  await generate("video-input", [
    {
      text: "Summarize this short Arabic video and quote a short audible phrase with its timestamp. Do not infer speech you cannot hear.",
    },
    {
      inlineData: {
        mimeType: "video/webm",
        data: fs
          .readFileSync(
            path.join(
              root,
              "backend/tests/fixtures/synthetic/herbal-tea-fixed-ar.webm",
            ),
          )
          .toString("base64"),
      },
    },
  ]);
} else {
  for (const stage of [
    "structured-json",
    "arabic-text",
    "image-input",
    "video-input",
  ])
    report.requests.push({
      test: stage,
      status: "BLOCKED",
      reason: "No tested model completed minimal text generation",
    });
}
save();
console.log(
  JSON.stringify({
    diagnostic_complete: true,
    selected_model: report.selected_model,
    models_listed: report.models.length,
    report: out,
  }),
);
