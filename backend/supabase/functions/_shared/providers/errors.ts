// Classifies AI provider (Gemini) failures into stable codes with Arabic/English messages.
// Pure module: used by Edge Functions and unit tests.

export type ProviderErrorCode =
  | "missing_key" // Key not set in environment
  | "invalid_key" // 401
  | "no_access" // 403 — key valid but no access to the model/project/region
  | "model_not_found" // 404 — wrong model name or model not available to this key
  | "insufficient_quota" // 429 + insufficient_quota — no credit / billing
  | "rate_limited" // 429 otherwise
  | "bad_request" // 400 — e.g. unsupported audio format, missing parameter
  | "overloaded" // 503 UNAVAILABLE: the model is under high demand (Google says usually temporary)
  | "provider_down" // other 5xx, timeouts, network errors
  | "unknown";

export interface ProviderErrorInfo {
  code: ProviderErrorCode;
  status: number | null;
  /** OpenAI error.type / error.code (never contains secrets). */
  type: string | null;
  requestId: string | null;
  /** Provider message, truncated; safe to log server-side. */
  detail: string;
}

export function classifyProviderError(status: number | null, body: string, requestId: string | null = null): ProviderErrorInfo {
  let type: string | null = null;
  let message = body;
  try {
    const j = JSON.parse(body) as { error?: { type?: string; code?: string; message?: string } };
    type = j.error?.code || j.error?.type || null;
    message = j.error?.message ?? body;
  } catch {
    // non-JSON body
  }
  let code: ProviderErrorCode;
  // Google reports a bad/expired key as HTTP 400 INVALID_ARGUMENT with reason API_KEY_INVALID.
  if (status === 401 || /API_KEY_INVALID|API key not valid|API key expired/i.test(body)) code = "invalid_key";
  else if (status === 403) code = "no_access";
  else if (status === 404 || (status === 400 && /is not supported for generateContent|models\/\S+ is not found/i.test(body))) code = "model_not_found";
  // Google: per-minute limits are transient; daily/zero/billing quota is not.
  else if (status === 429) code = /per.?minute/i.test(body) ? "rate_limited" : type === "insufficient_quota" || /quota|billing|credit|RESOURCE_EXHAUSTED/i.test(message + " " + body) ? "insufficient_quota" : "rate_limited";
  else if (status === 400 || status === 413 || status === 415 || status === 422) code = "bad_request";
  else if (status === 503) code = "overloaded";
  else if (status === null || status === 408 || status >= 500) code = "provider_down";
  else code = "unknown";
  // Never echo key material even if a provider message quotes it.
  const detail = message.replace(/sk-[A-Za-z0-9_-]{6,}/g, "sk-***").replace(/AIza[A-Za-z0-9_-]+/g, "[redacted-google-key]").slice(0, 300);
  return { code, status, type, requestId, detail };
}

export const PROVIDER_ERROR_MESSAGES: Record<ProviderErrorCode, { ar: string; en: string }> = {
  missing_key: {
    ar: "مزوّد التحليل غير مهيأ بعد. يرجى إعداد مفتاح API.",
    en: "The analysis provider is not configured yet. Please configure the API key.",
  },
  invalid_key: {
    ar: "تعذر التحقق من مفتاح مزوّد التحليل. يرجى التحقق من صحة المفتاح.",
    en: "Could not verify the analysis provider key. Please check the API key.",
  },
  no_access: {
    ar: "لا يملك حساب مزوّد التحليل صلاحية الوصول إلى النموذج المطلوب. أبلغ فريق سَليم.",
    en: "The analysis provider account has no access to the required model. Please contact the SALEEM team.",
  },
  model_not_found: {
    ar: "النموذج المحدد غير متاح أو لا يدعم هذا النوع من التحليل.",
    en: "The configured model is not available or does not support this analysis.",
  },
  insufficient_quota: {
    ar: "نفدت حصة الاستخدام المتاحة لمزوّد التحليل (Gemini). أعد المحاولة بعد تجدد الحصة اليومية أو بعد رفع الحد. ملفك محفوظ.",
    en: "The analysis provider (Gemini) usage quota or credit is exhausted. Retry after the daily quota resets or the limit is raised. Your file is kept.",
  },
  rate_limited: {
    ar: "مزوّد التحليل مشغول حالياً. أعد المحاولة بعد دقيقة.",
    en: "The analysis provider is busy right now. Try again in a minute.",
  },
  bad_request: {
    ar: "رفض مزوّد التحليل الملف (صيغة أو إعدادات غير مدعومة). جرّب ملفاً آخر أو أعد المحاولة.",
    en: "The analysis provider rejected the file (unsupported format or settings). Try another file or retry.",
  },
  overloaded: {
    ar: "خدمة Gemini مزدحمة حالياً بسبب ضغط مرتفع لدى Google، ولم تنجح المحاولات التلقائية. ملفك محفوظ؛ أعد المحاولة بعد دقيقة.",
    en: "Gemini is overloaded right now (high demand at Google) and the automatic retries did not succeed. Your file is kept; retry in a minute.",
  },
  provider_down: {
    ar: "خدمة الذكاء الاصطناعي غير متاحة مؤقتًا. حاول مرة أخرى.",
    en: "The AI analysis service is temporarily unavailable. Please retry shortly.",
  },
  unknown: {
    ar: "لم يكتمل الفحص. لم يتم إنشاء نتائج غير مؤكدة. أعد المحاولة.",
    en: "The analysis did not complete. No ungrounded findings were produced. Please retry.",
  },
};

/** Value stored in submissions.error_message; the UI translates `code:` values. */
export const errorToken = (code: ProviderErrorCode) => `code:provider_${code}`;
