// V2 upgrade strings: new-advertisement wizard (D179).
export const ar = {
  wiz: {
    title: "إعلان جديد",
    titleVersion: "رفع إصدار جديد",
    subtitle:
      "أربع خطوات: المحتوى، معلومات الإعلان، السياق التنظيمي والنشر، ثم المراجعة وبدء الفحص.",
    start: "إنشاء الإعلان وبدء الفحص",
    next: "التالي",
    stepsLabel: "خطوات إنشاء الإعلان",
    stepOf: "الخطوة {n} من {total}",
    step: {
      content: "رفع المحتوى",
      details: "معلومات الإعلان",
      context: "السياق والنشر",
      review: "المراجعة والبدء",
    },
    draftFound: "لديك مسودة غير مرسلة محفوظة على هذا الجهاز (الحقول فقط، دون الملف).",
    draftRestore: "استعادة المسودة",
    draftDiscard: "تجاهل",
    formats:
      "الصيغ المدعومة: فيديو MP4 / MOV / WebM، صور JPG / PNG / WebP، ملفات PDF، أو نص. يبقى الملف المرفوع محفوظاً أثناء تنقلك بين الخطوات.",
    categoryFromProduct: "حُدّد تلقائياً من قطاع المنتج، ويمكنك تغييره.",
    licenseHint: "مطلوب عند النشر عبر صانع محتوى أو مؤثر.",
    creatorFieldsHidden:
      "رخصة موثوق والعقد المكتوب يظهران فقط عند النشر عبر صانع محتوى أو في الإعلان برعاية.",
    versionContextNote:
      "الإصدار الجديد يرث سياق الإعلان (المنتج والقنوات ونوع الاتصال). عدّله من تبويب المعلومات في صفحة الإعلان.",
    personalContextNote: "فحص شخصي خارج مساحات العمل: لا منتجات ولا حزم تنظيمية للجهة.",
    sum: { content: "المحتوى", orgSector: "قطاع الجهة — لم يُحدد منتج" },
    checksTitle: "تحقق قبل البدء",
    level: { warning: "تنبيه", info: "معلومة", blocking: "مطلوب" },
    conflict: {
      no_channels: "اختر قناة نشر واحدة على الأقل.",
      no_product: "لم تختر منتجاً: سيُستخدم قطاع الجهة لتحديد القواعد. اختر المنتج لنتيجة أدق.",
      financial_comm_for_non_financial:
        "المنتج غير مالي لكن نوع الاتصال «إعلان مالي»: ستُطبق قواعد المنتجات المالية. صحّح نوع الاتصال إن لم يكن مقصوداً.",
      general_comm_for_financial:
        "المنتج مالي ونوع الاتصال «تجاري عام»: تأكد أن الإعلان لا يروّج لمنتج مالي.",
      no_distribution:
        "لم تحدد طريقة النشر (قنوات الجهة / وسائل مدفوعة / صانع محتوى). تؤثر في قواعد موثوق.",
      draft_product: "المنتج المختار مسودة غير معتمدة؛ بياناته قد تتغير.",
      category_mismatch: "تصنيف المحتوى لا يطابق قطاع المنتج.",
      missing_license: "إعلان مدفوع عبر صانع محتوى دون رقم رخصة موثوق.",
      missing_contract: "إعلان مدفوع عبر صانع محتوى دون عقد مكتوب مع المعلن.",
      ai_disclosure: "صرّحت باستخدام الذكاء الاصطناعي: تأكد من الإفصاح عنه في الإعلان.",
    },
    fixContext: "تعديل السياق",
    whatHappens:
      "عند البدء: يُنشأ الإعلان ويُرفع المحتوى، ثم يُحلَّل آلياً (طلب تحليل واحد). النتيجة استرشادية، ولا يُرسل الإعلان للمراجعة إلا عندما تختار ذلك.",
    backToAd: "العودة إلى صفحة الإعلان",
  },
};
export const en = {
  wiz: {
    title: "New advertisement",
    titleVersion: "Upload a new version",
    subtitle:
      "Four steps: content, advertisement information, regulatory and publication context, then review and start.",
    start: "Create advertisement and start check",
    next: "Next",
    stepsLabel: "Advertisement creation steps",
    stepOf: "Step {n} of {total}",
    step: {
      content: "Upload content",
      details: "Advertisement information",
      context: "Context & publication",
      review: "Review & start",
    },
    draftFound: "You have an unsent draft saved on this device (fields only, not the file).",
    draftRestore: "Restore draft",
    draftDiscard: "Discard",
    formats:
      "Supported: MP4 / MOV / WebM video, JPG / PNG / WebP images, PDF documents, or text. The uploaded file is kept while you move between steps.",
    categoryFromProduct: "Set from the product's sector; you can change it.",
    licenseHint: "Required when publishing through a content creator or influencer.",
    creatorFieldsHidden:
      "The Mawthooq licence and written agreement appear only for creator / sponsored publication.",
    versionContextNote:
      "The new version inherits the advertisement's context (product, channels, communication type). Edit it from the Information tab.",
    personalContextNote:
      "Personal check outside workspaces: no products or organisation rule packages.",
    sum: { content: "Content", orgSector: "organisation sector — no product selected" },
    checksTitle: "Check before starting",
    level: { warning: "Warning", info: "Note", blocking: "Required" },
    conflict: {
      no_channels: "Choose at least one publication channel.",
      no_product:
        "No product selected: the organisation's sector decides the rules. Choose the product for a more accurate result.",
      financial_comm_for_non_financial:
        "The product is not financial but the communication type is «financial promotion»: financial-product rules will apply. Correct it if unintended.",
      general_comm_for_financial:
        "Financial product with «general commercial» communication: make sure the ad does not promote a financial product.",
      no_distribution:
        "No publication method selected (own channels / paid media / creator). It affects Mawthooq rules.",
      draft_product: "The selected product is an unapproved draft; its data may change.",
      category_mismatch: "The content category does not match the product's sector.",
      missing_license: "Paid creator advertising without a Mawthooq licence number.",
      missing_contract: "Paid creator advertising without a written agreement with the advertiser.",
      ai_disclosure: "You declared AI use: make sure the ad discloses it.",
    },
    fixContext: "Edit context",
    whatHappens:
      "Starting creates the advertisement, uploads the content and runs one automated analysis. The result is advisory; the ad is only sent for review when you choose to.",
    backToAd: "Back to the advertisement",
  },
};
