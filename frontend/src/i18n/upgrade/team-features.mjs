// V2 completion strings: Team & Workspace (D193) and Features (D194).
const fAr = {
  multi_level_approval: {
    req: "قالب مراحل اعتماد واحد على الأقل.",
    perm: "يديره المالك والمدير؛ تقرر كل مرحلة الأدوار المحددة فيها.",
    deps: "لا يتاح الاعتماد الذاتي حين ينطبق قالب مراحل.",
  },
  risk_acceptance: {
    req: "تحديد عضو واحد على الأقل يملك صلاحية قبول المخاطر.",
    perm: "يطلبه صاحب الإعلان أو رافعه؛ يقرره صاحب الصلاحية فقط، ولا يكون الرافع.",
    deps: "يعمل على إعلان مرفوض أو مطلوب تعديله؛ لا يزيل الملاحظات ولا يُعد اعتماداً.",
  },
  self_approval: {
    req: "قاعدة اعتماد ذاتي مفعّلة (قنوات، منتجات، أدوار، متطلب الفحص الآلي).",
    perm: "الرافع نفسه ضمن القاعدة فقط.",
    deps: "لا يتجاوز المخالفات المفتوحة أو طلبات الأدلة أو التغطية الجزئية أو الإعلانات المالية أو حزم الجهات عالية المخاطر أو مسار المراحل.",
  },
  partners: {
    req: "منتجات وحملات (اختياري) لتحديد نطاق الروابط.",
    perm: "ينشئ الروابط ويعتمد الشركاء المالك والمدير.",
    deps: "يدار من تبويب «الشركاء الخارجيون» في الفريق والمساحة.",
  },
  upload_types: { req: "لا شيء.", perm: "من يملك إنشاء الإعلانات.", deps: "لكل نسخة قرار مستقل." },
  lifecycle: {
    req: "لا شيء.",
    perm: "المالك والمدير ورئيس الالتزام لتسجيل النشر والإيقاف.",
    deps: "لا يُسجل النشر قبل الاعتماد النهائي (الاعتماد المشروط لا يكفي).",
  },
  internal_rules: {
    req: "دليل هوية أو سياسات داخلية.",
    perm: "يكتبها المالك والمدير ورئيس الالتزام؛ يعتمدها شخص ثانٍ.",
    deps: "تُدار من صفحة «قواعد الشركة»؛ المسودات لا تُطبق.",
  },
  readability_hint: { req: "لا شيء.", perm: "يظهر لمن يرى الإعلان.", deps: "تلميح استرشادي فقط." },
  analytics: {
    req: "لا شيء.",
    perm: "المالك والمدير ورئيس الالتزام والمطّلع.",
    deps: "من الأحداث والقرارات المختومة فقط.",
  },
  ask_saleem: {
    req: "مفتاح مزوّد الذكاء الاصطناعي على الخادم لصياغة الإجابة (وإلا تُعرض المصادر فقط).",
    perm: "الأعضاء الداخليون.",
    deps: "يقرأ بصلاحيات المستخدم فقط.",
  },
  saleem_fix: {
    req: "مفتاح مزوّد الذكاء الاصطناعي على الخادم؛ توليد الإعلانات البديلة غير مُعد.",
    perm: "جانب التسويق (المالك، المدير، المسوق، صاحب الإعلان)؛ لا المراجع ولا المطّلع.",
    deps: "يتطلب فحصاً آلياً مكتملاً؛ كل نسخة مصححة تُفحص من جديد ولا تُعتمد آلياً.",
  },
  api: {
    req: "مفتاح واجهة برمجية أو عنوان Webhook يُنشأ هنا.",
    perm: "المالك والمدير.",
    deps: "واجهة القراءة v1 للقراءة فقط.",
  },
  notifications_chat: {
    req: "عنوان Incoming Webhook من مساحة Slack أو Teams.",
    perm: "المالك والمدير.",
    deps: "لا يُرسل إلا ما يختاره المسؤول من أحداث.",
  },
};
const fEn = {
  multi_level_approval: {
    req: "At least one approval preset.",
    perm: "Managed by owner and admin; the roles of each step decide it.",
    deps: "Self-approval is unavailable when a preset applies.",
  },
  risk_acceptance: {
    req: "At least one member with the risk-acceptance capability.",
    perm: "Requested by the ad owner or uploader; decided only by the capability holder, never the uploader.",
    deps: "On rejected or changes-requested ads; keeps findings and is not an approval.",
  },
  self_approval: {
    req: "An active self-approval rule (channels, products, roles, analysis requirement).",
    perm: "The uploader, within a rule only.",
    deps: "Never bypasses open violations, evidence requests, partial coverage, financial promotions, high-risk regulator packs or multi-stage flows.",
  },
  partners: {
    req: "Products and (optionally) campaigns to scope links.",
    perm: "Owner and admin create links and approve partners.",
    deps: "Managed in Team & Workspace > External partners.",
  },
  upload_types: {
    req: "Nothing.",
    perm: "Whoever can create advertisements.",
    deps: "Each variant gets its own decision.",
  },
  lifecycle: {
    req: "Nothing.",
    perm: "Owner, admin and compliance lead record publication and take-down.",
    deps: "Publication cannot be recorded before the final approval (conditional is not enough).",
  },
  internal_rules: {
    req: "A brand guide or internal policies.",
    perm: "Written by owner, admin, compliance lead; approved by a second person.",
    deps: "Managed on Company rules; drafts never apply.",
  },
  readability_hint: {
    req: "Nothing.",
    perm: "Shown to whoever sees the ad.",
    deps: "Advisory hint only.",
  },
  analytics: {
    req: "Nothing.",
    perm: "Owner, admin, compliance lead and viewer.",
    deps: "From sealed events and decisions only.",
  },
  ask_saleem: {
    req: "An AI provider key on the server to phrase answers (otherwise sources only).",
    perm: "Internal members.",
    deps: "Reads with the permissions of the user.",
  },
  saleem_fix: {
    req: "An AI provider key on the server; replacement generation is not configured.",
    perm: "Marketing side (owner, admin, marketer, ad owner); not reviewers or viewers.",
    deps: "Needs a finished analysis; every corrected version is analysed again and never auto-approved.",
  },
  api: {
    req: "An API key or webhook URL created here.",
    perm: "Owner and admin.",
    deps: "API v1 is read-only.",
  },
  notifications_chat: {
    req: "An Incoming Webhook URL from your Slack or Teams workspace.",
    perm: "Owner and admin.",
    deps: "Only the events the administrator selects are sent.",
  },
};
export const ar = {
  flags: {
    saleem_fix: "الإصلاح الذكي",
    saleem_fixHint:
      "خطة تصحيح ونص ووسائط معدلة لملاحظات الإعلان، يراجعها المسوق ويقبلها كإصدار جديد يُفحص من جديد.",
  },
  team: {
    partnersTab: "الشركاء الخارجيون",
    settingsTab: "إعدادات المساحة",
    pending: "بانتظار اعتماد الوصول",
    elsewhere: "إعدادات في صفحاتها",
    elsewhereBody:
      "الأدوار والصلاحيات، والميزات وإعداداتها، وقواعد الشركة تُدار من صفحاتها المخصصة دون تكرار هنا.",
    companyRulesLink: "قواعد الشركة",
    countsNote: "الإعلانات تُحسب مرة واحدة؛ الإصدارات وعمليات التحليل تُحسب منفصلة.",
    tile: {
      advertisements: "إعلانات",
      versions: "إصدارات",
      runs: "عمليات تحليل",
      pending: "قيد المراجعة",
      unassigned: "غير مُسندة",
      overdue: "متأخرة",
      changes: "طُلبت تعديلات",
      conditional: "اعتماد مشروط",
      approved: "معتمدة",
      rejected: "مرفوضة",
      partner: "إرسالات الشركاء",
    },
    workload: "عبء المراجعين (حالات مفتوحة)",
    openQueue: "فتح طابور المراجعة",
    recentDecisions: "أحدث القرارات",
    campaignStatus: { active: "نشطة", upcoming: "قادمة", ended: "منتهية" },
    campaignCounts: "{ads} إعلانات · {review} قيد المراجعة · {approved} معتمدة",
    products: "المنتجات",
    approvalProgress: "نسبة الإعلانات المعتمدة",
  },
  feat2: {
    subtitle:
      "كل ميزة معطّلة افتراضياً. فعّل ما تحتاجه واضبط إعداداتها في مكانها؛ الخادم يفرض كل ميزة على حدة.",
    cat: {
      governance: "الاعتماد والحوكمة",
      management: "إدارة الإعلانات",
      compliance: "الامتثال",
      intelligence: "الذكاء والتحليلات",
      integrations: "التكاملات",
    },
    on: "مفعّلة",
    off: "معطّلة",
    enabled: "مفعّلة",
    disabled: "معطّلة",
    availability: { available: "متاحة", needs_setup: "تحتاج إعداداً", provider: "تعتمد على مزوّد" },
    requires: "المتطلبات",
    who: "الصلاحيات",
    depends: "الاعتماديات والقيود",
    configure: "الإعدادات",
    openPartners: "إدارة الشركاء من الفريق والمساحة",
    openCompanyRules: "فتح قواعد الشركة",
    fixLimit: "حد الإصلاح الذكي الشهري",
    fixLimitHint: "منفصل عن حصة التحليل. 0 يوقف الطلبات الجديدة.",
    f: fAr,
  },
};
export const en = {
  flags: {
    saleem_fix: "SALEEM Fix",
    saleem_fixHint:
      "A correction plan with revised text and media for the findings of an ad; the marketer reviews it and accepts it as a new version that is analysed again.",
  },
  team: {
    partnersTab: "External partners",
    settingsTab: "Workspace settings",
    pending: "Access pending",
    elsewhere: "Settings on their own pages",
    elsewhereBody:
      "Roles & permissions, features and their configuration, and company rules are managed on their own pages, not repeated here.",
    companyRulesLink: "Company rules",
    countsNote:
      "Advertisements are counted once; versions and analysis runs are counted separately.",
    tile: {
      advertisements: "Advertisements",
      versions: "Versions",
      runs: "Analysis runs",
      pending: "In review",
      unassigned: "Unassigned",
      overdue: "Overdue",
      changes: "Changes requested",
      conditional: "Conditionally approved",
      approved: "Approved",
      rejected: "Rejected",
      partner: "Partner submissions",
    },
    workload: "Reviewer workload (open cases)",
    openQueue: "Open the review queue",
    recentDecisions: "Recent decisions",
    campaignStatus: { active: "Active", upcoming: "Upcoming", ended: "Ended" },
    campaignCounts: "{ads} ads · {review} in review · {approved} approved",
    products: "Products",
    approvalProgress: "Share of approved ads",
  },
  feat2: {
    subtitle:
      "Every feature is off by default. Enable what you need and configure it in place; the server enforces each one.",
    cat: {
      governance: "Approval & governance",
      management: "Advertisement management",
      compliance: "Compliance",
      intelligence: "Intelligence & analytics",
      integrations: "Integrations",
    },
    on: "On",
    off: "Off",
    enabled: "Enabled",
    disabled: "Disabled",
    availability: {
      available: "Available",
      needs_setup: "Needs setup",
      provider: "Provider-dependent",
    },
    requires: "Requires",
    who: "Permissions",
    depends: "Dependencies & limits",
    configure: "Configure",
    openPartners: "Manage partners in Team & Workspace",
    openCompanyRules: "Open Company rules",
    fixLimit: "SALEEM Fix monthly limit",
    fixLimitHint: "Separate from analysis quota. 0 stops new requests.",
    f: fEn,
  },
};
