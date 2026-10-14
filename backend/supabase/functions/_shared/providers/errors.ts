// Classifies provider (OpenAI) failures into stable codes with Arabic/English messages.
// "Invalid key" is used ONLY for HTTP 401. Pure module: used by Edge Functions and unit tests.

export type ProviderErrorCode =
  | "invalid_key" // 401
  | "no_access" // 403 — key valid but no access to the model/project/region
  | "model_not_found" // 404 — wrong model name or model not available to this key
  | "insufficient_quota" // 429 + insufficient_quota — no credit / billing
  | "rate_limited" // 429 otherwise
  | "bad_request" // 400 — e.g. unsupported audio format, missing parameter
  | "provider_down" // 5xx, timeouts, network errors
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
  if (status === 401) code = "invalid_key";
  else if (status === 403) code = "no_access";
  else if (status === 404) code = "model_not_found";
  else if (status === 429) code = type === "insufficient_quota" || /quota|billing|credit/i.test(message) ? "insufficient_quota" : "rate_limited";
  else if (status === 400 || status === 413 || status === 415 || status === 422) code = "bad_request";
  else if (status === null || status === 408 || status >= 500) code = "provider_down";
  else code = "unknown";
  // Never echo key material even if a provider message quotes it.
  const detail = message.replace(/sk-[A-Za-z0-9_-]{6,}/g, "sk-***").slice(0, 300);
  return { code, status, type, requestId, detail };
}

export const PROVIDER_ERROR_MESSAGES: Record<ProviderErrorCode, { ar: string; en: string }> = {
  invalid_key: {
    ar: "مفتاح مزوّد التحليل غير صالح. أبلغ فريق سَليم.",
    en: "The analysis provider key is invalid. Please contact the SALEEM team.",
  },
  no_access: {
    ar: "لا يملك حساب مزوّد التحليل صلاحية الوصول إلى النموذج المطلوب. أبلغ فريق سَليم.",
    en: "The analysis provider account has no access to the required model. Please contact the SALEEM team.",
  },
  model_not_found: {
    ar: "نموذج التحليل المضبوط غير موجود أو غير متاح. أبلغ فريق سَليم.",
    en: "The configured analysis model doesn't exist or isn't available. Please contact the SALEEM team.",
  },
  insufficient_quota: {
    ar: "نفد رصيد مزوّد التحليل. أبلغ فريق سَليم لإضافة رصيد.",
    en: "The analysis provider is out of credit. Please contact the SALEEM team.",
  },
  rate_limited: {
    ar: "مزوّد التحليل مشغول حالياً. أعد المحاولة بعد دقيقة.",
    en: "The analysis provider is busy right now. Try again in a minute.",
  },
  bad_request: {
    ar: "رفض مزوّد التحليل الملف (صيغة أو إعدادات غير مدعومة). جرّب ملفاً آخر أو أعد المحاولة.",
    en: "The analysis provider rejected the file (unsupported format or settings). Try another file or retry.",
  },
  provider_down: {
    ar: "تعذّر الوصول إلى مزوّد التحليل مؤقتاً. أعد المحاولة بعد قليل.",
    en: "The analysis provider is temporarily unreachable. Try again shortly.",
  },
  unknown: {
    ar: "حدث خطأ غير متوقع لدى مزوّد التحليل. أعد المحاولة.",
    en: "Unexpected error from the analysis provider. Please retry.",
  },
};

/** Value stored in submissions.error_message; the UI translates `code:` values. */
export const errorToken = (code: ProviderErrorCode) => `code:provider_${code}`;
