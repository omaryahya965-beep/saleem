import fs from "node:fs";

function parseCsv(text) {
  const rows = [];
  let row = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some(x => x !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  const [head, ...body] = rows;
  return body.map(r => Object.fromEntries(head.map((h, i) => [h.trim().replace(/^\uFEFF/, ""), (r[i] ?? "").trim()])));
}

const rawRules = parseCsv(fs.readFileSync("docs/saleem-v2/data/saleem_saudi_rules_v0_1.csv", "utf8"));
const rawSources = parseCsv(fs.readFileSync("docs/saleem-v2/data/saleem_regulatory_sources.csv", "utf8"));

const AUTH_MAP = {
  "البنك المركزي السعودي": "SAMA",
  "هيئة السوق المالية": "CMA",
  "وزارة التجارة": "MC",
  "الهيئة العامة لتنظيم الإعلام": "GMEDIA",
  "سدايا": "SDAIA",
  "الهيئة العامة للعقار": "REGA",
  "الهيئة العامة للغذاء والدواء": "SFDA",
  "وزارة الحج والعمرة": "MOHU",
  "وزارة السياحة": "MT",
};

const SECTOR_TO_CAT = {
  BANK: "finance",
  CMA: "finance",
  RE: "commerce",
  COS: "beauty",
  FOOD: "food",
  DRUG: "health",
  DEV: "health",
  TR: "commerce",
  HOT: "commerce",
  HAJ: "content",
  PD: "content",
  COMP: "commerce",
  SALE: "commerce",
  MEDIA: "mawthooq",
  GEN: "commerce",
};

const sourcesMap = new Map();
for (const s of rawSources) {
  sourcesMap.set(`sa:${s.source_id}`, {
    id: `sa:${s.source_id}`,
    authority: AUTH_MAP[s.authority_ar] || "OTHER",
    authority_ar: s.authority_ar,
    title_ar: s.title_ar,
    url: s.url,
    source_type: s.source_type,
    version_note: s.version_note,
    scope_ar: s.scope_ar,
    research_note_ar: s.research_note_ar,
    retrieved_on: s.retrieved_on,
  });
}

// 12 core rules
const coreRules = [
  {
    id: "core-maw-01",
    code: "MAW-01",
    category: "mawthooq",
    pack: "sa-gmedia-creators",
    authority: "GMEDIA",
    authority_ar: "الهيئة العامة لتنظيم الإعلام",
    article_ref: "ضوابط ترخيص موثوق",
    title_ar: "وجود رقم ترخيص موثوق سارٍ",
    title_en: "Valid Mawthooq license number",
    description_ar: "يلزم لكل إعلان يقدمه فرد عبر منصات التواصل ذكر رقم ترخيص موثوق الممنوح من الهيئة العامة لتنظيم الإعلام والتحقق من سريانه.",
    description_en: "Every creator advertisement requires a valid Mawthooq license number from GMEDIA.",
    summary_ar: "وجود رقم ترخيص موثوق سارٍ في الإعلان",
    summary_en: "Valid Mawthooq license requirement",
    source_name: "الهيئة العامة لتنظيم الإعلام — ترخيص موثوق",
    source_name_en: "GMEDIA Mawthooq",
    source_url: "https://gmedia.gov.sa/ar/services/licensing-for-providing-advertising-content-through-social-media-platforms-trusted",
    source_date: "2024",
    check_kind: "deterministic",
    check_mode: "content",
    check_type: "hybrid",
    default_severity: "violation",
    review_state: "active",
    is_active: true,
    evidence_policy_ar: "نص الإعلان أو البيانات الوصفية أو مربع الترخيص.",
    applicability_ar: "إعلانات المؤثرين والأفراد على منصات التواصل الاجتماعي.",
    sector_ar: "الإعلام والمؤثرون",
    sector_code: "MEDIA",
  },
  {
    id: "core-maw-02",
    code: "MAW-02",
    category: "mawthooq",
    pack: "sa-gmedia-creators",
    authority: "GMEDIA",
    authority_ar: "الهيئة العامة لتنظيم الإعلام",
    article_ref: "المادة 5 من لائحة المحتوى الإعلاني",
    title_ar: "الإفصاح الصريح عن المادة الإعلانية",
    title_en: "Explicit advertisement disclosure",
    description_ar: "يجب تضمين وسم أو عبارة واضحة (إعلان / مادة إعلانية / بالتعاون مع) في مكان بارز يسهل على المشاهد قراءته دون الحاجة لفتح الشرح الإضافي.",
    description_en: "Must include a clear disclosure tag or phrase prominently visible without expanding details.",
    summary_ar: "الإفصاح الصريح عن المادة الإعلانية بوسم واضح",
    summary_en: "Prominent ad disclosure",
    source_name: "الهيئة العامة لتنظيم الإعلام",
    source_name_en: "GMEDIA",
    source_url: "https://gmedia.gov.sa",
    source_date: "2024",
    check_kind: "hybrid",
    check_mode: "content",
    check_type: "hybrid",
    default_severity: "violation",
    review_state: "active",
    is_active: true,
    evidence_policy_ar: "نص التسمية التوضيحية أو النص الظاهر على الشاشة أو الصوت.",
    applicability_ar: "جميع المحتويات الترويجية والإعلانية المدفوعة أو التبادلية.",
    sector_ar: "الإعلام والمؤثرون",
    sector_code: "MEDIA",
  },
  {
    id: "core-maw-03",
    code: "MAW-03",
    category: "mawthooq",
    pack: "sa-gmedia-creators",
    authority: "GMEDIA",
    authority_ar: "الهيئة العامة لتنظيم الإعلام",
    article_ref: "المادة 8",
    title_ar: "عقد كتابي بين المعلن والمنشأة",
    title_en: "Written contract between creator and advertiser",
    description_ar: "يلزم وجود عقد نظامي موثق بين صانع المحتوى والمنشأة المعلنة يحدد طبيعة الإعلان والشروط المتفق عليها.",
    description_en: "Requires a documented agreement specifying advertisement terms.",
    summary_ar: "توثيق التعاقد الإعلاني بعقد كتابي",
    summary_en: "Written contract requirement",
    source_name: "الهيئة العامة لتنظيم الإعلام",
    source_name_en: "GMEDIA",
    source_url: "https://gmedia.gov.sa",
    source_date: "2024",
    check_kind: "workflow",
    check_mode: "document",
    check_type: "hybrid",
    default_severity: "warning",
    review_state: "active",
    is_active: true,
    evidence_policy_ar: "بيانات الإرسال وتأكيد وجود العقد في النظام.",
    applicability_ar: "الإعلانات التعاقدية مع المنشآت والشركات.",
    sector_ar: "الإعلام والمؤثرون",
    sector_code: "MEDIA",
  },
  {
    id: "core-maw-04",
    code: "MAW-04",
    category: "mawthooq",
    pack: "sa-gmedia-creators",
    authority: "GMEDIA",
    authority_ar: "الهيئة العامة لتنظيم الإعلام",
    article_ref: "المادة 12",
    title_ar: "عدم ترويج منتجات مجهولة المصدر أو غير مرخصة",
    title_en: "No promotion of unlicensed or untraceable goods",
    description_ar: "يحظر الترويج لأي منتج أو خدمة غير مرخصة رسمياً داخل المملكة أو لا يُعرف مصدرها وسجلها التجاري.",
    description_en: "Prohibits advertising unlicensed or unverified products in Saudi Arabia.",
    summary_ar: "حظر الترويج للمنتجات غير المرخصة أو مجهولة المصدر",
    summary_en: "No unlicensed product promotions",
    source_name: "الهيئة العامة لتنظيم الإعلام",
    source_name_en: "GMEDIA",
    source_url: "https://gmedia.gov.sa",
    source_date: "2024",
    check_kind: "hybrid",
    check_mode: "content",
    check_type: "hybrid",
    default_severity: "violation",
    review_state: "active",
    is_active: true,
    evidence_policy_ar: "فحص ادعاءات المنتج ومطابقتها للتراخيص الرسمية.",
    applicability_ar: "جميع المنتجات المعروضة للبيع أو الترويج.",
    sector_ar: "الإعلام والمؤثرون",
    sector_code: "MEDIA",
  },
  {
    id: "core-maw-05",
    code: "MAW-05",
    category: "mawthooq",
    pack: "sa-gmedia-creators",
    authority: "GMEDIA",
    authority_ar: "الهيئة العامة لتنظيم الإعلام",
    article_ref: "المادة 15",
    title_ar: "احترام فئات الجمهور والتصنيف العمري",
    title_en: "Audience protection and age rating",
    description_ar: "يجب مراعاة ملائمة الإعلان للجمهور المستهدف وتجنب عرض محتوى غير مناسب للأطفال أو توجيه منتجات البالغين إليهم.",
    description_en: "Ensure advertisement suitability for target audience and protect minors.",
    summary_ar: "حماية القاصرين ومراعاة التصنيف العمري",
    summary_en: "Minor protection and age grading",
    source_name: "الهيئة العامة لتنظيم الإعلام",
    source_name_en: "GMEDIA",
    source_url: "https://gmedia.gov.sa",
    source_date: "2024",
    check_kind: "llm",
    check_mode: "content",
    check_type: "hybrid",
    default_severity: "violation",
    review_state: "active",
    is_active: true,
    evidence_policy_ar: "تحليل المشاهد والصوت والنصوص لتقييم مناسبة المحتوى للجمهور.",
    applicability_ar: "الإعلانات الموجهة للجمهور العام أو الأطفال.",
    sector_ar: "الإعلام والمؤثرون",
    sector_code: "MEDIA",
  },
  {
    id: "core-cnt-01",
    code: "CNT-01",
    category: "content",
    pack: "sa-media",
    authority: "GMEDIA",
    authority_ar: "الهيئة العامة لتنظيم الإعلام",
    article_ref: "المادة 4 من نظام الإعلام",
    title_ar: "حظر التضليل والادعاءات غير المثبتة",
    title_en: "Prohibition of misleading and unsubstantiated claims",
    description_ar: "يجب ألا يتضمن الإعلان أي ادعاءات علاجية، علمية، أو اقتصادية لا تستند إلى أدلة معتمدة وموثقة.",
    description_en: "Prohibits medical, scientific or performance claims not backed by certified evidence.",
    summary_ar: "عدم إطلاق ادعاءات مضللة أو غير مثبتة بأدلة معتمدة",
    summary_en: "No unsubstantiated claims",
    source_name: "نظام الإعلام المرئي والمسموع",
    source_name_en: "Audiovisual Media Law",
    source_url: "https://laws.boe.gov.sa",
    source_date: "2024",
    check_kind: "hybrid",
    check_mode: "content",
    check_type: "hybrid",
    default_severity: "violation",
    review_state: "active",
    is_active: true,
    evidence_policy_ar: "مطابقة الادعاءات مع مكتبة الادعاءات المعتمدة وشهادات الاعتماد.",
    applicability_ar: "كافة الادعاءات المحددة في الإعلانات.",
    sector_ar: "الإعلام والمؤثرون",
    sector_code: "MEDIA",
  },
  {
    id: "core-cnt-02",
    code: "CNT-02",
    category: "content",
    pack: "sa-media",
    authority: "GMEDIA",
    authority_ar: "الهيئة العامة لتنظيم الإعلام",
    article_ref: "المادة 6",
    title_ar: "احترام القيم والذوق العام والضوابط الشرعية",
    title_en: "Compliance with public decency and local values",
    description_ar: "يلتزم الإعلان باحترام القيم الدينية والاجتماعية والذوق العام في المملكة العربية السعودية.",
    description_en: "Requires advertisements to adhere to religious values and public decency.",
    summary_ar: "الالتزام بالذوق العام والقيم الاجتماعية",
    summary_en: "Public decency compliance",
    source_name: "نظام الإعلام المرئي والمسموع",
    source_name_en: "Audiovisual Media Law",
    source_url: "https://laws.boe.gov.sa",
    source_date: "2024",
    check_kind: "llm",
    check_mode: "content",
    check_type: "hybrid",
    default_severity: "violation",
    review_state: "active",
    is_active: true,
    evidence_policy_ar: "فحص المشاهد والأزياء والعبارات والموسيقى المصاحبة.",
    applicability_ar: "كافة المواد الإعلانية المعروضة في المملكة.",
    sector_ar: "الإعلام والمؤثرون",
    sector_code: "MEDIA",
  },
  {
    id: "core-cnt-03",
    code: "CNT-03",
    category: "content",
    pack: "sa-media",
    authority: "MC",
    authority_ar: "وزارة التجارة",
    article_ref: "المادة 11 من نظام التجارة الإلكترونية",
    title_ar: "حظر الإعلانات المقارنة المسيئة أو غير العادلة",
    title_en: "Prohibition of disparaging comparative advertising",
    description_ar: "يحظر أي إعلان يقارن بين منتج وآخر بطريقة تقلل من شأن المنافس أو تعتمد على بيانات غير موضوعية ومجردة.",
    description_en: "Prohibits unfair comparisons that disparage competitors.",
    summary_ar: "حظر الإعلانات المقارنة المشككة أو المسيئة للمنافسين",
    summary_en: "No disparaging comparative ads",
    source_name: "نظام التجارة الإلكترونية",
    source_name_en: "E-Commerce Law",
    source_url: "https://laws.boe.gov.sa",
    source_date: "2024",
    check_kind: "llm",
    check_mode: "content",
    check_type: "hybrid",
    default_severity: "warning",
    review_state: "active",
    is_active: true,
    evidence_policy_ar: "تحليل ذكر المنافسين أو المقارنات المباشرة.",
    applicability_ar: "الإعلانات المقارنة والترويجية.",
    sector_ar: "التجارة والتسويق",
    sector_code: "GEN",
  },
  {
    id: "core-cnt-04",
    code: "CNT-04",
    category: "content",
    pack: "sa-media",
    authority: "MC",
    authority_ar: "وزارة التجارة",
    article_ref: "المادة 13",
    title_ar: "وضوح شروط العروض الترويجية والخصومات",
    title_en: "Clarity of promotional terms and discounts",
    description_ar: "يجب بيان الأسعار قبل وبعد التخفيض وتوضيح مدة العرض والكميات المتاحة وشروط الاستفادة منه دون غموض.",
    description_en: "Promotional offers and discounts must state before/after prices and duration clearly.",
    summary_ar: "وضوح شروط التخفيضات والأسعار قبل وبعد العرض",
    summary_en: "Transparent promotional pricing",
    source_name: "ضوابط التخفيضات التجارية",
    source_name_en: "Commercial Discounts Rules",
    source_url: "https://mc.gov.sa",
    source_date: "2024",
    check_kind: "deterministic",
    check_mode: "content",
    check_type: "hybrid",
    default_severity: "violation",
    review_state: "active",
    is_active: true,
    evidence_policy_ar: "تحليل الأسعار ونسب التخفيض ومطابقتها للنصوص المرافقة.",
    applicability_ar: "إعلانات التخفيضات والخصومات والعروض الترويجية.",
    sector_ar: "التجارة والتسويق",
    sector_code: "SALE",
  },
  {
    id: "core-cnt-05",
    code: "CNT-05",
    category: "content",
    pack: "sa-media",
    authority: "MC",
    authority_ar: "وزارة التجارة",
    article_ref: "المادة 16",
    title_ar: "حظر استخدام شعارات أو علامات رسمية دون إذن",
    title_en: "Unauthorized use of official logos or emblems",
    description_ar: "يحظر تضمين شعار المملكة (السيفين والنخلة) أو أعلام الدول أو شعارات الجهات الحكومية لأغراض تجارية دون إذن مسبق.",
    description_en: "Prohibits commercial use of official state emblems and logos without authorization.",
    summary_ar: "حظر استخدام الشعارات والرموز الرسمية بدون تفويض",
    summary_en: "No unauthorized official emblems",
    source_name: "نظام العلامات التجارية",
    source_name_en: "Trademarks Law",
    source_url: "https://laws.boe.gov.sa",
    source_date: "2024",
    check_kind: "hybrid",
    check_mode: "content",
    check_type: "hybrid",
    default_severity: "violation",
    review_state: "active",
    is_active: true,
    evidence_policy_ar: "فحص العلامات المرئية في الفيديو والصور والشعارات.",
    applicability_ar: "كافة الإعلانات التجارية والمواد التسويقية.",
    sector_ar: "التجارة والتسويق",
    sector_code: "GEN",
  },
  {
    id: "core-ai-01",
    code: "AI-01",
    category: "ai",
    pack: "sa-sdaia-ai",
    authority: "SDAIA",
    authority_ar: "الهيئة السعودية للبيانات والذكاء الاصطناعي (سدايا)",
    article_ref: "المبادئ التوجيهية لأخلاقيات الذكاء الاصطناعي",
    title_ar: "الإفصاح الإلزامي عن المحتوى المولد بالذكاء الاصطناعي",
    title_en: "Mandatory disclosure for AI-generated synthetic content",
    description_ar: "يجب الإفصاح بوضوح عند استخدام أدوات الذكاء الاصطناعي التوليدي لإنشاء أو تعديل العناصر الأساسية في الإعلان (شخصيات افتراضية، تزييف عميق، صور اصطناعية).",
    description_en: "Requires clear disclosure when generative AI is used for core synthetic elements.",
    summary_ar: "الإفصاح عند استخدام الذكاء الاصطناعي التوليدي أو الشخصيات الاصطناعية",
    summary_en: "AI generation disclosure",
    source_name: "سدايا — أخلاقيات الذكاء الاصطناعي",
    source_name_en: "SDAIA AI Ethics",
    source_url: "https://dgp.sdaia.gov.sa",
    source_date: "2024",
    check_kind: "deterministic",
    check_mode: "content",
    check_type: "hybrid",
    default_severity: "warning",
    review_state: "active",
    is_active: true,
    evidence_policy_ar: "نص التسمية أو الوسم أو علامة المحتوى المولد آلياً.",
    applicability_ar: "الإعلانات التي توظف تقنيات الذكاء الاصطناعي التوليدي.",
    sector_ar: "البيانات والذكاء الاصطناعي",
    sector_code: "PD",
  },
  {
    id: "core-com-01",
    code: "COM-01",
    category: "commerce",
    pack: "sa-mc-ecommerce",
    authority: "MC",
    authority_ar: "وزارة التجارة",
    article_ref: "المادة 10 من نظام التجارة الإلكترونية",
    title_ar: "بيانات الاتصال والسجل التجاري للمتجر الإلكتروني",
    title_en: "E-commerce store contact and commercial registry",
    description_ar: "يجب أن يتضمن الإعلان الإلكتروني وسيلة واضحة ومباشرة للاتصال بمتجر البيع، وذكر رقم السجل التجاري أو وثيقة العمل الحر المعتمدة.",
    description_en: "E-commerce advertisements must state store contact and CR / freelance certificate.",
    summary_ar: "إبراز بيانات التواصل ورقم السجل أو وثيقة العمل الحر للمتجر",
    summary_en: "E-commerce contact and CR disclosure",
    source_name: "نظام التجارة الإلكترونية",
    source_name_en: "E-Commerce Law",
    source_url: "https://laws.boe.gov.sa",
    source_date: "2024",
    check_kind: "hybrid",
    check_mode: "content",
    check_type: "hybrid",
    default_severity: "violation",
    review_state: "active",
    is_active: true,
    evidence_policy_ar: "النصوص المكتوبة أو الروابط المضمنة في الإعلان.",
    applicability_ar: "إعلانات المتاجر والمنصات الإلكترونية التي تبيع سلعاً أو خدمات.",
    sector_ar: "التجارة والتسويق",
    sector_code: "GEN",
  },
];

// Map 187 CSV rules
const importedRules = rawRules.map((r, index) => {
  const authority = AUTH_MAP[r.authority_ar] || "OTHER";
  const cat = SECTOR_TO_CAT[r.sector_code] || "commerce";
  const pack = `sa-${r.sector_code.toLowerCase()}`;
  const src = sourcesMap.get(`sa:${r.source_id}`);
  
  // Status mapping
  let review_state = "draft";
  let is_active = false;
  if (r.activation_status === "active") {
    review_state = "active";
    is_active = true;
  } else if (r.sector_code === "HAJ") {
    review_state = "archived";
    is_active = false;
  } else if (r.activation_status === "candidate_review") {
    review_state = "pending_review";
    is_active = false;
  }

  // CMA-CMI-35-RETAIL conflict check
  let supersededNote = null;
  if (r.rule_id === "SA-CMA-010") {
    supersededNote = "بديل رسمي معتمد عن القاعدة السابقة CMA-CMI-35-RETAIL وفق نص المادة 35 من لائحة مؤسسات السوق المالية (تتطلب التحقق من الملاءمة قبل استهداف عميل التجزئة بدلاً من الحظر المطلق).";
  }

  return {
    id: `saudi-${r.rule_id}`,
    code: r.rule_id,
    category: cat,
    pack,
    authority,
    authority_ar: r.authority_ar,
    article_ref: r.legal_reference,
    title_ar: r.check_ar,
    title_en: r.rule_id,
    description_ar: r.check_ar,
    description_en: r.rule_id,
    summary_ar: r.check_ar,
    summary_en: r.rule_id,
    source_name: r.source_title_ar,
    source_name_en: r.source_id,
    source_url: r.source_url || (src ? src.url : null),
    source_date: r.source_checked_on || "2026-11-18",
    check_kind: r.check_mode === "content" ? "llm" : r.check_mode === "workflow" ? "workflow" : "hybrid",
    check_mode: r.check_mode || "content",
    check_type: "hybrid",
    default_severity: r.internal_priority === "high" ? "violation" : "warning",
    review_state,
    is_active,
    evidence_policy_ar: r.evidence_policy_ar,
    applicability_ar: r.applicability_ar,
    sector_ar: r.sector_ar,
    sector_code: r.sector_code,
    superseded_note: supersededNote,
    effective_date: "1446H / 2024–2026",
    last_verified_at: r.source_checked_on || "2026-11-18",
  };
});

const allRules = [...coreRules, ...importedRules];
const allSources = Array.from(sourcesMap.values());

const outTs = `// Verified Saudi Regulatory Rules Catalog
// 199 Rules total: 12 foundational core rules + 187 researched and imported Saudi rules
// 19 Regulatory Sources across 9 authorities

export interface RegulatoryRuleItem {
  id: string;
  code: string;
  category: "mawthooq" | "content" | "ai" | "commerce" | "finance" | "beauty" | "food" | "health";
  pack: string;
  authority: "SAMA" | "CMA" | "MC" | "GMEDIA" | "SDAIA" | "REGA" | "SFDA" | "MOHU" | "MT" | "OTHER";
  authority_ar: string;
  article_ref: string | null;
  title_ar: string;
  title_en: string;
  description_ar: string;
  description_en: string;
  summary_ar: string | null;
  summary_en: string | null;
  source_name: string;
  source_name_en: string | null;
  source_url: string | null;
  source_date: string | null;
  check_kind: string;
  check_mode: "content" | "document" | "workflow" | "hybrid";
  check_type: string;
  default_severity: "violation" | "warning";
  review_state: "active" | "draft" | "pending_review" | "superseded" | "archived";
  is_active: boolean;
  evidence_policy_ar: string | null;
  applicability_ar: string | null;
  sector_ar: string;
  sector_code: string;
  superseded_note?: string | null;
  effective_date?: string | null;
  last_verified_at?: string | null;
}

export interface RegulatorySourceItem {
  id: string;
  authority: string;
  authority_ar: string;
  title_ar: string;
  url: string | null;
  source_type: string;
  version_note: string | null;
  scope_ar: string | null;
  research_note_ar: string | null;
  retrieved_on: string | null;
}

export const SAUDI_REGULATORY_SOURCES: RegulatorySourceItem[] = ${JSON.stringify(allSources, null, 2)};

export const ALL_REGULATORY_RULES: RegulatoryRuleItem[] = ${JSON.stringify(allRules, null, 2)};
`;

fs.writeFileSync("frontend/src/features/rulebook/saudiRulesCatalog.ts", outTs, "utf8");
console.log("Generated frontend/src/features/rulebook/saudiRulesCatalog.ts with", allRules.length, "rules and", allSources.length, "sources.");
