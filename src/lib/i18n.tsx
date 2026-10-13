import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "ar" | "en";

const dict = {
  brand: { ar: "سَليم", en: "SALEEM" },
  tagline: { ar: "تنظيم لا تقييد", en: "Guidance, not policing" },
  heroTitle: { ar: "افحص قبل أن تنشر", en: "Check before you publish" },
  heroSub: {
    ar: "سَليم يفحص محتواك العربي قبل النشر ويحدد المشكلة بالثانية",
    en: "SALEEM checks your Arabic content before you publish and pinpoints each issue to the second",
  },
  tryFree: { ar: "جرّب مجاناً", en: "Try for free" },
  seeExample: { ar: "شاهد مثالاً", en: "See an example" },
  step1: { ar: "ارفع", en: "Upload" },
  step1d: {
    ar: "مقطع حتى ٩٠ ثانية، صورة، أو نص — قبل النشر.",
    en: "A clip up to 90 s, an image or text — before publishing.",
  },
  step2: { ar: "يحلّل سَليم", en: "SALEEM analyzes" },
  step2d: {
    ar: "الكلام باللهجة السعودية، والمشاهد، والوصف، مقابل الأنظمة.",
    en: "Saudi-dialect speech, visuals and caption against the rules.",
  },
  step3: { ar: "تقرير وسجل امتثال", en: "Report & compliance log" },
  step3d: {
    ar: "كل ملاحظة بوقتها ومصدرها والتعديل المقترح.",
    en: "Each issue with its timestamp, source and suggested fix.",
  },
  whoFor: { ar: "لمن سَليم؟", en: "Who is it for?" },
  creators: { ar: "صنّاع المحتوى", en: "Creators" },
  creatorsD: {
    ar: "فحص سريع من الجوال قبل سناب وتيك توك وإنستقرام.",
    en: "Quick mobile checks before Snapchat, TikTok, Instagram.",
  },
  agencies: { ar: "الوكالات", en: "Agencies" },
  agenciesD: {
    ar: "متابعة فحوصات عدة صنّاع وحملات في مكان واحد.",
    en: "Track many creators and campaigns in one place.",
  },
  brands: { ar: "العلامات التجارية", en: "Brands" },
  brandsD: {
    ar: "اطمئن أن إعلانك يلتزم بالإفصاح والادعاءات.",
    en: "Make sure your ads disclose properly and avoid risky claims.",
  },
  disclaimer: {
    ar: "تنبيهات استرشادية وليست موافقة رسمية. القرار النهائي للمستخدم.",
    en: "Advisory alerts, not official approval. The final decision is yours.",
  },
  signIn: { ar: "تسجيل الدخول", en: "Sign in" },
  signUp: { ar: "إنشاء حساب", en: "Create account" },
  signOut: { ar: "تسجيل الخروج", en: "Sign out" },
  email: { ar: "البريد الإلكتروني", en: "Email" },
  password: { ar: "كلمة المرور", en: "Password" },
  noAccount: { ar: "ليس لديك حساب؟", en: "No account?" },
  haveAccount: { ar: "لديك حساب؟", en: "Have an account?" },
  checkEmail: {
    ar: "أرسلنا رابط تأكيد إلى بريدك.",
    en: "We sent a confirmation link to your email.",
  },
  tryDemo: { ar: "جرّب العرض التوضيحي", en: "Try the demo" },
  dashboard: { ar: "فحوصاتي", en: "My checks" },
  newCheck: { ar: "فحص جديد", en: "New check" },
  rulebook: { ar: "دليل القواعد", en: "Rulebook" },
  evaluation: { ar: "التقييم", en: "Evaluation" },
  emptyTitle: { ar: "لا توجد فحوصات بعد", en: "No checks yet" },
  emptyBody: {
    ar: "ارفع أول مقطع قبل نشره، وسيعطيك سَليم تقريراً خلال دقائق.",
    en: "Upload your first clip before publishing and get a report in minutes.",
  },
  ready: { ar: "جاهز للنشر", en: "Ready to publish" },
  review: { ar: "يحتاج مراجعة", en: "Needs review" },
  needs_fixes: { ar: "يحتاج تعديلات", en: "Needs fixes" },
  processing: { ar: "قيد التحليل", en: "Analyzing" },
  failed: { ar: "تعذّر التحليل", en: "Analysis failed" },
  violation: { ar: "مخالفة", en: "Violation" },
  warning: { ar: "تنبيه", en: "Warning" },
  kindVideo: { ar: "فيديو", en: "Video" },
  kindImage: { ar: "صورة", en: "Image" },
  kindText: { ar: "نص", en: "Text" },
  uploadHint: { ar: "اسحب الملف هنا أو اضغط للاختيار", en: "Drag a file here or tap to choose" },
  videoLimits: {
    ar: "MP4 أو MOV · حتى ٩٠ ثانية · حتى ٢٥ ميغابايت",
    en: "MP4 or MOV · up to 90 s · up to 25 MB",
  },
  imageLimits: { ar: "JPG أو PNG", en: "JPG or PNG" },
  textContent: { ar: "نص المنشور", en: "Post text" },
  caption: { ar: "الوصف (الكابشن)", en: "Caption" },
  platform: { ar: "المنصة", en: "Platform" },
  category: { ar: "فئة المنتج", en: "Product category" },
  paidAd: { ar: "هذا إعلان مدفوع", en: "This is a paid/sponsored ad" },
  paidAdH: {
    ar: "أي محتوى بمقابل مالي أو عيني أو كود خصم.",
    en: "Any content for money, gifts or with a discount code.",
  },
  contract: { ar: "لدي عقد مكتوب مع الماركة", en: "I have a written contract with the brand" },
  contractH: { ar: "يُطلب وجود اتفاق مكتوب للإعلانات.", en: "Ads require a written agreement." },
  aiUsed: { ar: "استخدمت الذكاء الاصطناعي", en: "AI was used to create/edit content" },
  aiUsedH: {
    ar: "توليد أو تعديل صوت أو صورة أو نص.",
    en: "Generating or editing audio, images or text.",
  },
  license: { ar: "رقم رخصة موثوق (اختياري)", en: "Mawthooq license no. (optional)" },
  startCheck: { ar: "ابدأ الفحص", en: "Start check" },
  preparing: { ar: "جارٍ تجهيز الملف…", en: "Preparing file…" },
  uploading: { ar: "جارٍ الرفع…", en: "Uploading…" },
  sUpload: { ar: "رفع", en: "Upload" },
  sExtract: { ar: "استخراج", en: "Extract" },
  sTranscribe: { ar: "تفريغ الصوت", en: "Transcribe" },
  sAnalyze: { ar: "تحليل", en: "Analyze" },
  sReport: { ar: "التقرير", en: "Report" },
  retry: { ar: "إعادة المحاولة", en: "Retry" },
  time: { ar: "الوقت", en: "Time" },
  status: { ar: "الحالة", en: "Status" },
  issue: { ar: "المشكلة", en: "Issue" },
  rule: { ar: "القاعدة", en: "Rule" },
  fix: { ar: "التعديل المقترح", en: "Suggested fix" },
  evidence: { ar: "الدليل", en: "Evidence" },
  wholeClip: { ar: "عام", en: "General" },
  uploadFixed: { ar: "ارفع النسخة المعدّلة", en: "Upload fixed version" },
  downloadLog: { ar: "سجل الامتثال (PDF)", en: "Compliance log (PDF)" },
  prevVersion: { ar: "النسخة السابقة", en: "Previous version" },
  recheckOf: { ar: "إعادة فحص لـ", en: "Re-check of" },
  rulebookVersion: { ar: "إصدار القواعد", en: "Rulebook version" },
  model: { ar: "النموذج", en: "Model" },
  noFindings: {
    ar: "لم نجد ملاحظات. محتواك يبدو جاهزاً للنشر.",
    en: "No issues found. Your content looks ready.",
  },
  deleteMedia: { ar: "حذف الوسائط", en: "Delete media" },
  mediaDeleted: {
    ar: "تم حذف الوسائط؛ بقيت الملاحظات والبصمة فقط.",
    en: "Media deleted; only findings and hashes remain.",
  },
  savePdf: { ar: "حفظ كـ PDF", en: "Save as PDF" },
  illustrative: {
    ar: "توضيحية – بانتظار المراجعة القانونية",
    en: "Illustrative – pending legal review",
  },
  search: { ar: "ابحث في القواعد…", en: "Search rules…" },
  source: { ar: "المصدر", en: "Source" },
  demoBadge: { ar: "عرض توضيحي", en: "Demo" },
  back: { ar: "رجوع", en: "Back" },
} as const;

export type DictKey = keyof typeof dict;

const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: (k: DictKey) => string }>({
  lang: "ar",
  setLang: () => {},
  t: (k) => dict[k].ar,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("ar");
  useEffect(() => {
    const saved = localStorage.getItem("saleem-lang");
    if (saved === "en" || saved === "ar") setLangState(saved);
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);
  const setLang = (l: Lang) => {
    localStorage.setItem("saleem-lang", l);
    setLangState(l);
  };
  return <Ctx.Provider value={{ lang, setLang, t: (k) => dict[k][lang] }}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);

export const PLATFORMS = [
  { v: "snapchat", ar: "سناب شات", en: "Snapchat" },
  { v: "tiktok", ar: "تيك توك", en: "TikTok" },
  { v: "instagram", ar: "إنستقرام", en: "Instagram" },
  { v: "x", ar: "إكس", en: "X" },
  { v: "youtube", ar: "يوتيوب", en: "YouTube" },
] as const;

export const CATEGORIES = [
  { v: "food", ar: "أغذية", en: "Food" },
  { v: "health", ar: "مكملات وصحة", en: "Supplements / health" },
  { v: "beauty", ar: "تجميل", en: "Beauty" },
  { v: "finance", ar: "مالية", en: "Finance" },
  { v: "real_estate", ar: "عقار", en: "Real estate" },
  { v: "other", ar: "أخرى", en: "Other" },
] as const;

export function fmtTime(s: number | null | undefined) {
  if (s == null) return "—";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}
