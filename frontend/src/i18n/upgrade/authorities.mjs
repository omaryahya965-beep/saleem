// Regulatory authority selection and coverage for personal advertisements (D211).
export const ar = {
  authority: {
    title: "الجهات التنظيمية",
    mode: "طريقة اختيار الجهات",
    auto: "يقترحها سَليم",
    manual: "أختارها بنفسي",
    autoHint: "يقترح سَليم الجهات المرتبطة بقطاع إعلانك وسياق نشره، ويفحصه وفق قواعدها المعتمدة.",
    manualHint: "اختر جهة واحدة أو أكثر. سيُفحص إعلانك وفق القواعد المعتمدة للجهات المختارة فقط.",
    recommended: "الجهات المقترحة:",
    recommendedShort: "مقترحة",
    noneRecommended: "لا توجد جهات مقترحة لهذا السياق.",
    useUsual: "استخدم جهاتي المعتادة",
    excludedWarning: "اختيارك يستبعد جهات قد تنطبق على إعلانك: {list}. قد تفوتك متطلبات نظامية.",
    noneSelected: "اختر جهة تنظيمية واحدة على الأقل، أو دع سَليم يقترحها.",
    uncoveredNote:
      "لا توجد بعد قواعد معتمدة ومُتحقق منها لدى سَليم لهذه الجهات: {list}. قواعدها مسودات لم تُراجع قانونياً ولا تُطبّق في الفحص، فلا يعني غياب الملاحظات أن الإعلان مطابق لمتطلباتها.",
    verified: "{n} قاعدة معتمدة",
    draftOnly: "مسودات فقط ({n}) — لا تُطبّق",
    noCoverage: "لا تغطية بعد",
    browse: "تصفح دليل القواعد",
    name: {
      GMEDIA: "الهيئة العامة لتنظيم الإعلام",
      MC: "وزارة التجارة",
      SDAIA: "سدايا (الذكاء الاصطناعي)",
      SFDA: "هيئة الغذاء والدواء",
      SAMA: "البنك المركزي السعودي",
      CMA: "هيئة السوق المالية",
      IA: "هيئة التأمين",
      MT: "وزارة السياحة",
      REGA: "الهيئة العامة للعقار",
      MOHU: "وزارة الحج والعمرة",
    },
    scope: {
      GMEDIA: "إعلانات المشاهير وصنّاع المحتوى، ترخيص موثوق، ضوابط المحتوى.",
      MC: "الإعلانات التجارية والتجارة الإلكترونية والادعاءات المضللة.",
      SDAIA: "الإفصاح عن المحتوى المولّد أو المعدّل بالذكاء الاصطناعي.",
      SFDA: "الأغذية والأدوية ومستحضرات التجميل والأجهزة الطبية.",
      SAMA: "المنتجات المصرفية والتمويلية والمدفوعات.",
      CMA: "الأوراق المالية والاستثمار.",
      IA: "منتجات التأمين.",
      MT: "الخدمات السياحية والضيافة.",
      REGA: "التسويق العقاري.",
      MOHU: "خدمات الحج والعمرة.",
    },
    coverageTitle: "ما يستطيع سَليم فحصه اليوم",
    coverageBody:
      "القواعد المعتمدة فقط تُطبّق في الفحص الآلي. المسودات معروضة للاطلاع ولا تُعامل كمتطلبات نظامية.",
    report: {
      title: "الجهات التي فُحص وفقها هذا الإعلان",
      automatic: "اقترحها سَليم تلقائياً",
      manual: "اختيار يدوي",
      checked: "الجهات المفحوصة",
      excluded: "جهات مقترحة استبعدتها: {list}. لم يُفحص الإعلان وفق قواعدها.",
      change: "غيّر الجهات وأعد الفحص",
    },
  },
  personalCheck: {
    sector: "قطاع المنتج أو الخدمة",
    sectorHint: "يحدد الجهات التنظيمية المقترحة.",
    use: "سياق النشر",
    useOption: {
      own: "إعلان لمنتجي أو خدمتي",
      sponsored: "إعلان أو محتوى برعاية جهة أخرى",
      personal: "محتوى شخصي يذكر منتجاً دون مقابل",
    },
    useHint: {
      own: "تروّج لمنتجك أو متجرك أو خدمتك.",
      sponsored:
        "تنشر لجهة أخرى مقابل أجر أو منتج مجاني أو عمولة: الإفصاح وترخيص موثوق غالباً مطلوبان.",
      personal: "لا مقابل ولا اتفاق. إن وُجد أي مقابل فاختر «برعاية جهة أخرى».",
    },
  },
};

export const en = {
  authority: {
    title: "Regulatory authorities",
    mode: "How to choose authorities",
    auto: "SALEEM recommends",
    manual: "I choose",
    autoHint:
      "SALEEM recommends the authorities linked to your ad's sector and publication context and checks it against their verified rules.",
    manualHint:
      "Choose one or more authorities. Your ad will be checked against the verified rules of the selected authorities only.",
    recommended: "Recommended:",
    recommendedShort: "Recommended",
    noneRecommended: "No authority recommended for this context.",
    useUsual: "Use my usual authorities",
    excludedWarning:
      "Your selection leaves out authorities that may apply to your ad: {list}. You may miss regulatory requirements.",
    noneSelected: "Choose at least one regulatory authority, or let SALEEM recommend them.",
    uncoveredNote:
      "SALEEM has no verified rules yet for: {list}. Their rules are drafts that have not been legally reviewed and are not applied, so no findings does not mean your ad meets their requirements.",
    verified: "{n} verified rules",
    draftOnly: "Drafts only ({n}) — not applied",
    noCoverage: "No coverage yet",
    browse: "Browse the rulebook",
    name: {
      GMEDIA: "General Authority for Media Regulation",
      MC: "Ministry of Commerce",
      SDAIA: "SDAIA (artificial intelligence)",
      SFDA: "Saudi Food and Drug Authority",
      SAMA: "Saudi Central Bank",
      CMA: "Capital Market Authority",
      IA: "Insurance Authority",
      MT: "Ministry of Tourism",
      REGA: "Real Estate General Authority",
      MOHU: "Ministry of Hajj and Umrah",
    },
    scope: {
      GMEDIA: "Influencer and creator advertising, Mawthooq licence, content rules.",
      MC: "Commercial advertising, e-commerce and misleading claims.",
      SDAIA: "Disclosure of AI-generated or AI-edited content.",
      SFDA: "Food, medicines, cosmetics and medical devices.",
      SAMA: "Banking, finance and payment products.",
      CMA: "Securities and investment.",
      IA: "Insurance products.",
      MT: "Tourism and hospitality services.",
      REGA: "Real estate marketing.",
      MOHU: "Hajj and Umrah services.",
    },
    coverageTitle: "What SALEEM can check today",
    coverageBody:
      "Only verified rules are applied in automated checks. Drafts are shown for information and are not treated as requirements.",
    report: {
      title: "Authorities this ad was checked against",
      automatic: "Recommended automatically by SALEEM",
      manual: "Manual selection",
      checked: "Checked authorities",
      excluded:
        "Recommended authorities you left out: {list}. The ad was not checked against their rules.",
      change: "Change authorities and re-check",
    },
  },
  personalCheck: {
    sector: "Product or service sector",
    sectorHint: "Decides which authorities are recommended.",
    use: "Publication context",
    useOption: {
      own: "An ad for my own product or service",
      sponsored: "An ad or content sponsored by someone else",
      personal: "Personal content mentioning a product, unpaid",
    },
    useHint: {
      own: "You promote your own product, shop or service.",
      sponsored:
        "You publish for another party for payment, a free product or commission: disclosure and a Mawthooq licence are usually required.",
      personal:
        "No payment or agreement. If anything was given in return, choose «sponsored by someone else».",
    },
  },
};
