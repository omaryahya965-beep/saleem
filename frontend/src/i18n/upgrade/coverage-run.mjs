// Automatic multi-regulator coverage for personal advertisements (D213).
export const ar = {
  ws: {
    sector: {
      banking: "البنوك والتمويل",
      capital_market: "الاستثمار والأوراق المالية",
      healthcare: "الرعاية الصحية",
      real_estate: "العقار",
      general: "محتوى عام",
    },
  },
  personalCheck: {
    sector: "قطاع الإعلان",
    sectorHint: "يحلل سَليم محتوى الإعلان أيضاً؛ إن أشار إلى قطاع آخر فُحص وفق قواعده كذلك.",
    automatic:
      "لا تختار الجهات التنظيمية: يأخذ سَليم كل الجهات المدعومة في الحسبان تلقائياً، ويحدد القواعد المنطبقة من القطاع ومحتوى الإعلان الفعلي وهوية الناشر والإعلان المدفوع واستخدام الذكاء الاصطناعي وسياق النشر.",
    allAuthorities: "كل الجهات المدعومة — تلقائياً",
  },
  authority: {
    title: "الجهات التنظيمية",
    coverageTitle: "ما يستطيع سَليم فحصه اليوم",
    coverageBody:
      "القواعد المعتمدة المُتحقق منها فقط تُطبّق في الفحص الآلي. المسودات معروضة للاطلاع ولا تُعامل كمتطلبات نظامية، فالتغطية ليست كاملة.",
  },
  coverageRun: {
    subtitle: "كل الجهات المدعومة فُحصت تلقائياً. الجدول يوضح ما طُبّق وما لم يمكن تقييمه.",
    notYet: "تظهر التغطية التنظيمية بعد اكتمال الفحص الآلي.",
    mismatch:
      "اخترت قطاع «{selected}»، لكن محتوى الإعلان يشير أيضاً إلى: {detected}. فُحص الإعلان وفق قواعد هذه القطاعات أيضاً.",
    gaps: "جهات تنطبق على إعلانك ولا توجد لديها بعد قواعد معتمدة في سَليم: {list}. لم تُفحص متطلباتها، فراجعها بنفسك.",
    relevant: "تنطبق على إعلانك",
    col: { authority: "الجهة", status: "الحالة", rules: "القواعد", result: "النتيجة" },
    status: {
      evaluated: "منطبقة وفُحصت",
      manual_verification: "منطبقة وتحتاج تحققاً يدوياً",
      not_applicable: "لا تنطبق",
      insufficient_coverage: "تغطية معتمدة غير كافية",
      unable_to_evaluate: "تعذّر التقييم",
    },
    counts: "{active} معتمدة · {drafts} مسودة (لا تُطبّق)",
    failed: "ملاحظات: {list}",
    noIssues: "لا ملاحظات ({n} قاعدة)",
    manualItems: "{n} بند للتحقق اليدوي",
    note: "الفحص آلي واستشاري. «لا تنطبق» تعني أن قواعدها المعتمدة خارج سياق إعلانك، و«تغطية غير كافية» تعني عدم وجود قواعد معتمدة بعد — لا أن الإعلان مطابق.",
  },
};
export const en = {
  ws: {
    sector: {
      banking: "Banking and financing",
      capital_market: "Investment and securities",
      healthcare: "Healthcare",
      real_estate: "Real estate",
      general: "General content",
    },
  },
  personalCheck: {
    sector: "Advertisement sector",
    sectorHint:
      "SALEEM also analyses the content; if it points to another sector, those rules are checked too.",
    automatic:
      "You do not choose regulators: SALEEM considers every supported authority automatically and decides the applicable rules from the sector, the actual content, the publisher, paid status, AI use and the publication context.",
    allAuthorities: "Every supported authority — automatically",
  },
  authority: {
    title: "Regulatory authorities",
    coverageTitle: "What SALEEM can check today",
    coverageBody:
      "Only verified rules are applied in automated checks. Drafts are shown for information and are not treated as requirements, so coverage is not complete.",
  },
  coverageRun: {
    subtitle:
      "Every supported authority was considered automatically. The table shows what was applied and what could not be evaluated.",
    notYet: "Regulatory coverage appears once the automated check is complete.",
    mismatch:
      "You chose «{selected}», but the content also points to: {detected}. The ad was checked against those sectors' rules too.",
    gaps: "Authorities that apply to your ad but have no verified rules in SALEEM yet: {list}. Their requirements were not checked — review them yourself.",
    relevant: "Applies to your ad",
    col: { authority: "Authority", status: "Status", rules: "Rules", result: "Result" },
    status: {
      evaluated: "Applicable and evaluated",
      manual_verification: "Applicable — manual verification",
      not_applicable: "Not applicable",
      insufficient_coverage: "Insufficient verified coverage",
      unable_to_evaluate: "Unable to evaluate",
    },
    counts: "{active} verified · {drafts} draft (not applied)",
    failed: "Findings: {list}",
    noIssues: "No findings ({n} rules)",
    manualItems: "{n} items to verify manually",
    note: "Automated, advisory check. «Not applicable» means its verified rules are outside your ad's context; «insufficient coverage» means no verified rules yet — not that the ad complies.",
  },
};
