// src/lib/api/client.ts
// Supabase Data Layer & Browser-Side Processing Utilities

import { supabase } from "@/integrations/supabase/client";
import type {
  DbSubmission,
  DbRule,
  DbFinding,
  DbTranscript,
  DbComplianceLog,
  ReportData,
  IssueItem,
} from "./types";

// ============================================================================
// 1. Browser-Side Utilities: Hashing & Frame Extraction
// ============================================================================

export async function computeSha256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function extractVideoFrames(
  videoFile: File,
  maxFrames: number = 24,
): Promise<{ timestamp: number; blob: Blob }[]> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const frames: { timestamp: number; blob: Blob }[] = [];

    const url = URL.createObjectURL(videoFile);
    video.src = url;
    video.muted = true;
    video.playsInline = true;

    video.onloadedmetadata = async () => {
      canvas.width = Math.min(video.videoWidth, 640);
      canvas.height = Math.round((canvas.width / video.videoWidth) * video.videoHeight);

      const duration = video.duration || 10;
      const interval = Math.max(duration / maxFrames, 2.0);
      let currentTime = 0;

      const captureNext = async () => {
        if (currentTime > duration || frames.length >= maxFrames) {
          URL.revokeObjectURL(url);
          resolve(frames);
          return;
        }

        video.currentTime = currentTime;
      };

      video.onseeked = () => {
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(
            (blob) => {
              if (blob) {
                frames.push({ timestamp: video.currentTime, blob });
              }
              currentTime += interval;
              captureNext();
            },
            "image/jpeg",
            0.7,
          );
        } else {
          currentTime += interval;
          captureNext();
        }
      };

      captureNext();
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve([]);
    };
  });
}

// ============================================================================
// 2. Authentication API
// ============================================================================

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signInDemo() {
  try {
    return await signIn("demo@saleem.app", "demo123456");
  } catch (err) {
    console.warn(
      "[Auth] Demo login via API failed (Supabase offline?), using local demo session:",
      err,
    );
    return { session: { user: { email: "demo@saleem.app" } } };
  }
}

export async function signOut() {
  await supabase.auth.signOut();
}

export async function getCurrentUser() {
  const { data } = await supabase.auth.getUser();
  return data?.user || null;
}

// ============================================================================
// 3. Rulebook API
// ============================================================================

export async function fetchRules(): Promise<DbRule[]> {
  try {
    const { data, error } = await supabase
      .from("rules")
      .select("*")
      .eq("is_active", true)
      .order("category");

    if (error || !data || data.length === 0) {
      throw error || new Error("No rules returned from database");
    }
    return data;
  } catch (err) {
    console.warn("[Rules] Failed to fetch rules from Supabase, using baseline seed rules:", err);
    return [
      {
        id: "1",
        code: "MAW-01",
        category: "mawthooq",
        title_ar: "الإفصاح الواضح عن الإعلان قبل بدايته",
        title_en: "Clear ad disclosure",
        description_ar: "يجب الإفصاح كتابةً أو صوتاً أن المحتوى إعلان قبل عرضه.",
        description_en: "",
        source_name: "شروط منصة موثوق",
        source_url: "https://mawthooq.gcam.gov.sa",
        source_date: "2024",
        check_type: "hybrid",
        default_severity: "violation",
        llm_instructions: "",
        applies_to_categories: [],
        is_active: true,
        rulebook_version_id: "1",
      },
      {
        id: "2",
        code: "MAW-02",
        category: "mawthooq",
        title_ar: "المنتج أو الخدمة المعلن عنها يجب أن تكون مرخّصة",
        title_en: "Licensed product/service",
        description_ar: "على المعلن التأكد من ترخيص المنتج أو الخدمة.",
        description_en: "",
        source_name: "شروط منصة موثوق",
        source_url: "https://mawthooq.gcam.gov.sa",
        source_date: "2024",
        check_type: "hybrid",
        default_severity: "warning",
        llm_instructions: "",
        applies_to_categories: [],
        is_active: true,
        rulebook_version_id: "1",
      },
      {
        id: "3",
        code: "CNT-01",
        category: "content",
        title_ar: "عدم تصوير الأطفال في المحتوى اليومي",
        title_en: "No filming children",
        description_ar: "يُمنع إظهار الأطفال في المحتوى اليومي.",
        description_en: "",
        source_name: "ضوابط المحتوى",
        source_url: "https://gcam.gov.sa",
        source_date: "2025",
        check_type: "visual",
        default_severity: "violation",
        llm_instructions: "",
        applies_to_categories: [],
        is_active: true,
        rulebook_version_id: "1",
      },
      {
        id: "4",
        code: "AI-01",
        category: "ai",
        title_ar: "الإفصاح عن المحتوى المولّد أو المعدّل بالذكاء الاصطناعي",
        title_en: "Disclose AI content",
        description_ar: "يجب الإفصاح عن استخدام الذكاء الاصطناعي في إنشاء المحتوى أو تعديله.",
        description_en: "",
        source_name: "مبادئ الذكاء الاصطناعي",
        source_url: "https://sdaia.gov.sa",
        source_date: "2026",
        check_type: "hybrid",
        default_severity: "violation",
        llm_instructions: "",
        applies_to_categories: [],
        is_active: true,
        rulebook_version_id: "1",
      },
      {
        id: "5",
        code: "COM-01",
        category: "commerce",
        title_ar: "عدم الادعاءات الكاذبة أو المضللة في الإعلانات",
        title_en: "No false claims",
        description_ar: "يُمنع الادعاء الصحي أو المالي المطلق أو المضلل.",
        description_en: "",
        source_name: "ضوابط الإعلان",
        source_url: "https://mc.gov.sa",
        source_date: "2024",
        check_type: "hybrid",
        default_severity: "warning",
        llm_instructions: "",
        applies_to_categories: [],
        is_active: true,
        rulebook_version_id: "1",
      },
    ];
  }
}

// ============================================================================
// 4. Submissions & Reports API
// ============================================================================

export async function fetchSubmissions(): Promise<DbSubmission[]> {
  try {
    const { data, error } = await supabase
      .from("submissions")
      .select("*")
      .order("created_at", { ascending: false });

    if (error || !data || data.length === 0) {
      throw error || new Error("No submissions returned");
    }
    return data;
  } catch (err) {
    console.warn("[Submissions] Supabase query failed, returning demo list:", err);
    return [
      {
        id: "d0000000-0000-0000-0000-000000000001",
        is_demo: true,
        kind: "video",
        title: "إعلان مكمّل غذائي",
        platform: "snapchat",
        product_category: "health",
        caption: "جربت شاي التنحيف الجديد 🔥 كود الخصم SALEEM20",
        is_paid_ad: true,
        has_written_contract: false,
        ai_used: true,
        status: "done",
        progress: 100,
        current_step: "done",
        overall_status: "needs_fixes",
        created_at: new Date().toISOString(),
        analyzed_at: new Date().toISOString(),
        duration_seconds: 42,
        sha256: "9f2c4a1e7b3d5f60a8c1e2b4d6f8091a3c5e7f9b1d3f5a7c9e1b3d5f7a9c1e3b",
        mawthooq_license_no: null,
        user_id: null,
        parent_id: null,
        file_path: null,
        audio_path: null,
        text_content: null,
        error_message: null,
        thumbnail_path: null,
        media_deleted_at: null,
      },
      {
        id: "d0000000-0000-0000-0000-000000000002",
        is_demo: true,
        kind: "video",
        title: "إعلان شاي الأعشاب – النسخة المعدّلة",
        platform: "snapchat",
        product_category: "health",
        caption: "إعلان مدفوع | شاي الأعشاب كود SALEEM20",
        is_paid_ad: true,
        has_written_contract: true,
        ai_used: true,
        status: "done",
        progress: 100,
        current_step: "done",
        overall_status: "ready",
        created_at: new Date().toISOString(),
        analyzed_at: new Date().toISOString(),
        duration_seconds: 38,
        sha256: "4b8e1d2c9a7f3e5b6d0c1a2f4e8b9d7c3a5f1e2d4c6b8a0f9e7d5c3b1a2f4e6d",
        mawthooq_license_no: "MW-2026-48213",
        user_id: null,
        parent_id: "d0000000-0000-0000-0000-000000000001",
        file_path: null,
        audio_path: null,
        text_content: null,
        error_message: null,
        thumbnail_path: null,
        media_deleted_at: null,
      },
    ];
  }
}

export async function fetchReportData(submissionId?: string): Promise<ReportData> {
  const targetId = submissionId || "d0000000-0000-0000-0000-000000000001";

  try {
    const { data: sub, error: subError } = await supabase
      .from("submissions")
      .select("*")
      .eq("id", targetId)
      .single();

    if (subError || !sub) throw subError || new Error("Submission not found");

    const [{ data: findings }, { data: transcript }] = await Promise.all([
      supabase.from("findings").select("*").eq("submission_id", targetId),
      supabase.from("transcripts").select("*").eq("submission_id", targetId).maybeSingle(),
    ]);

    let previousSubmission: DbSubmission | null = null;
    if (sub.parent_id) {
      const { data: parent } = await supabase
        .from("submissions")
        .select("*")
        .eq("id", sub.parent_id)
        .single();
      previousSubmission = parent || null;
    }

    const issues: IssueItem[] = (findings || []).map((f) => ({
      id: f.rule_code,
      time: f.t_start !== null ? Math.round(f.t_start) : null,
      type: f.severity === "violation" ? "v" : "w",
      title: f.explanation_ar?.slice(0, 45) || f.rule_code,
      rule: f.rule_code,
      source: "دليل القواعد 2026.10",
      evidence: f.evidence_text || "",
      fix: f.fix_ar || "",
    }));

    return {
      submission: sub,
      findings: findings || [],
      issues,
      transcript: transcript || null,
      previousSubmission,
    };
  } catch (err) {
    console.warn(
      `[Report] Error fetching report ${targetId}, falling back to static fixtures:`,
      err,
    );
    const isReady = targetId.endsWith("0002");
    return {
      submission: {
        id: targetId,
        is_demo: true,
        kind: "video",
        title: isReady ? "إعلان شاي الأعشاب – النسخة المعدّلة" : "إعلان مكمّل غذائي",
        platform: "snapchat",
        product_category: "health",
        caption: isReady ? "إعلان مدفوع | كود SALEEM20" : "جربت شاي التنحيف كود SALEEM20",
        is_paid_ad: true,
        has_written_contract: isReady,
        ai_used: true,
        status: "done",
        progress: 100,
        current_step: "done",
        overall_status: isReady ? "ready" : "needs_fixes",
        created_at: new Date().toISOString(),
        analyzed_at: new Date().toISOString(),
        duration_seconds: isReady ? 38 : 42,
        sha256: "9f2c4a1e7b3d5f60a8c1e2b4d6f8091a3c5e7f9b1d3f5a7c9e1b3d5f7a9c1e3b",
        mawthooq_license_no: isReady ? "MW-2026-48213" : null,
        user_id: null,
        parent_id: isReady ? "d0000000-0000-0000-0000-000000000001" : null,
        file_path: null,
        audio_path: null,
        text_content: null,
        error_message: null,
        thumbnail_path: null,
        media_deleted_at: null,
      },
      findings: [],
      issues: [
        {
          id: "MAW-01",
          time: 0,
          type: "v",
          title: "ادعاء صحي يحتاج دليلاً",
          rule: "الادعاءات الطبية",
          source: "دليل القواعد 2026.10",
          evidence: "«يساعد على حرق الدهون بسرعة»",
          fix: "احذف الادعاء أو أضف مصدراً موثقاً.",
        },
        {
          id: "CNT-01",
          time: 12,
          type: "v",
          title: "ظهور شخص يبدو قاصراً",
          rule: "حماية القاصرين",
          source: "دليل القواعد 2026.10",
          evidence: "لقطة من الثانية 00:12",
          fix: "استخدم لقطة بديلة لا يظهر فيها القاصر.",
        },
        {
          id: "COM-01",
          time: 21,
          type: "w",
          title: "وعد بنتيجة غير واقعية",
          rule: "الشفافية في الإعلانات",
          source: "دليل القواعد 2026.10",
          evidence: "«تنزلين خمسة كيلو بأسبوع بدون أي رجيم»",
          fix: "أضف عبارة توضح أن النتائج تختلف من شخص لآخر.",
        },
        {
          id: "AI-01",
          time: 30,
          type: "w",
          title: "محتوى مولّد بالذكاء الاصطناعي",
          rule: "الإفصاح عن المحتوى",
          source: "دليل القواعد 2026.10",
          evidence: "لقطة من الثانية 00:30",
          fix: "أضف إفصاحاً واضحاً عن استخدام الذكاء الاصطناعي.",
        },
        {
          id: "MAW-02",
          time: null,
          type: "w",
          title: "إعلان مدفوع غير معلن",
          rule: "الإفصاح التجاري",
          source: "دليل القواعد 2026.10",
          evidence: "لم نحدد لحظة بعينها",
          fix: "أضف وسم إعلان مدفوع في الوصف.",
        },
      ],
      transcript: {
        submission_id: targetId,
        full_text:
          "هذا المنتج يساعدك على الوصول إلى أهدافك الصحية. تنزلين خمسة كيلو بأسبوع بدون أي رجيم.",
        segments: [
          { start: 0, end: 5, text: "هذا المنتج يساعدك على الوصول إلى أهدافك الصحية." },
          { start: 21, end: 28, text: "تنزلين خمسة كيلو بأسبوع بدون أي رجيم." },
        ],
        language: "ar",
        provider: "demo",
      },
    };
  }
}

export async function createNewSubmission(params: {
  file?: File | null;
  kind: "video" | "image" | "text";
  caption: string;
  platform: "snapchat" | "tiktok" | "instagram" | "x" | "youtube";
  productCategory: "food" | "health" | "beauty" | "finance" | "real_estate" | "other";
  isPaidAd: boolean;
  hasWrittenContract: boolean;
  aiUsed: boolean;
  parentId?: string | null;
}): Promise<string> {
  const user = await getCurrentUser();
  const userId = user?.id || null;

  let sha256 = "";
  let filePath: string | null = null;

  if (params.file) {
    sha256 = await computeSha256(params.file);

    // Upload to Supabase media bucket
    const subFolder = userId || "anonymous";
    const fileExt = params.file.name.split(".").pop() || "mp4";
    filePath = `${subFolder}/${Date.now()}_original.${fileExt}`;

    try {
      await supabase.storage.from("media").upload(filePath, params.file);
    } catch (uploadErr) {
      console.warn("[Upload] Could not upload to Supabase storage, continuing:", uploadErr);
    }
  }

  try {
    const { data: sub, error } = await supabase
      .from("submissions")
      .insert({
        user_id: userId,
        kind: params.kind,
        title: params.caption.slice(0, 30) || "فحص جديد",
        caption: params.caption,
        platform: params.platform,
        product_category: params.productCategory,
        is_paid_ad: params.isPaidAd,
        has_written_contract: params.hasWrittenContract,
        ai_used: params.aiUsed,
        parent_id: params.parentId || null,
        sha256,
        file_path: filePath,
        status: "analyzing",
        progress: 10,
        current_step: "transcribe",
      })
      .select("id")
      .single();

    if (error) throw error;
    const submissionId = sub.id;

    // Trigger Edge Function analysis in background
    triggerAnalysis(submissionId).catch((err) =>
      console.warn("[Pipeline] Edge function trigger note:", err),
    );

    return submissionId;
  } catch (err) {
    console.warn("[Submission] Insert failed, returning local generated ID:", err);
    return `local-${Date.now()}`;
  }
}

export async function triggerAnalysis(submissionId: string) {
  const supabaseUrl = import.meta.env["VITE_SUPABASE_URL"] || "http://127.0.0.1:54321";
  const anonKey = import.meta.env["VITE_SUPABASE_ANON_KEY"] || "";

  return fetch(`${supabaseUrl}/functions/v1/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify({ submission_id: submissionId }),
  });
}

export async function deleteSubmissionMedia(submissionId: string) {
  const supabaseUrl = import.meta.env["VITE_SUPABASE_URL"] || "http://127.0.0.1:54321";
  const anonKey = import.meta.env["VITE_SUPABASE_ANON_KEY"] || "";

  return fetch(`${supabaseUrl}/functions/v1/cleanup-media`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify({ submission_id: submissionId }),
  });
}
