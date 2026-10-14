// SALEEM diagnostics — admin-only health check of the AI provider configuration.
// POST with an admin user's JWT. Returns ONLY non-secret facts: key present/length/prefix/whitespace,
// HTTP status + error type for the models list, the configured models, and a 2-second transcription
// through the production OpenAITranscription class (same multipart request as real checks).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, json, log } from "../_shared/http.ts";
import { classifyProviderError } from "../_shared/providers/errors.ts";
import { config } from "../_shared/providers/index.ts";
import { OpenAITranscription } from "../_shared/providers/openai.ts";
import { ProviderError } from "../_shared/providers/types.ts";

const env = (k: string) => Deno.env.get(k);

/** 2 s mono 16 kHz PCM WAV: 0.5 s silence + 1.5 s quiet 440 Hz tone. */
function testWav(): Blob {
  const rate = 16000, n = rate * 2;
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const w = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); w(8, "WAVE"); w(12, "fmt "); v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, i < rate / 2 ? 0 : Math.round(Math.sin((2 * Math.PI * 440 * i) / rate) * 3000), true);
  return new Blob([buf], { type: "audio/wav" });
}

async function probe(url: string, key: string) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
  const body = await res.text();
  if (res.ok) return { status: res.status, error_type: null, error_code: null, request_id: res.headers.get("x-request-id") };
  const info = classifyProviderError(res.status, body, res.headers.get("x-request-id"));
  return { status: res.status, error_type: info.type, error_code: info.code, request_id: info.requestId };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const db = createClient(env("SUPABASE_URL")!, env("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  const { data: auth } = token ? await db.auth.getUser(token) : { data: null };
  if (!auth?.user) return json({ error: "invalid session" }, 401);
  const { data: role } = await db.from("user_roles").select("role").eq("user_id", auth.user.id).eq("role", "admin").maybeSingle();
  if (!role) return json({ error: "forbidden" }, 403);

  const raw = env("OPENAI_API_KEY") ?? "";
  const key = raw.trim();
  const cfg = config(env);
  const out: Record<string, unknown> = {
    key: {
      present: key.length > 0,
      length: key.length,
      starts_with_sk: key.startsWith("sk-"),
      has_surrounding_whitespace: raw !== key,
      has_quotes: /^["']|["']$/.test(key),
    },
    config: { llm_provider: cfg.llmProvider, llm_model: cfg.llmModel, transcription_provider: cfg.transcriptionProvider, transcription_model: cfg.transcriptionModel },
  };
  if (!key) return json(out);

  out.models_list = await probe("https://api.openai.com/v1/models", key);
  out.llm_model_access = await probe(`https://api.openai.com/v1/models/${encodeURIComponent(cfg.llmModel)}`, key);
  out.transcription_model_access = await probe(`https://api.openai.com/v1/models/${encodeURIComponent(cfg.transcriptionModel)}`, key);

  const t0 = Date.now();
  try {
    const r = await new OpenAITranscription(key, cfg.transcriptionModel).transcribe(testWav(), "diagnostic.wav");
    out.transcription = { ok: true, model: r.model, segments: r.segments.length, seconds: r.seconds, ms: Date.now() - t0 };
  } catch (e) {
    const info = e instanceof ProviderError ? e.info : undefined;
    out.transcription = { ok: false, status: info?.status ?? null, error_code: info?.code ?? "unknown", error_type: info?.type ?? null, request_id: info?.requestId ?? null, ms: Date.now() - t0 };
  }
  log("diagnostics_run", { by: auth.user.id, models_status: (out.models_list as { status: number }).status, transcription_ok: (out.transcription as { ok: boolean }).ok });
  return json(out);
});
