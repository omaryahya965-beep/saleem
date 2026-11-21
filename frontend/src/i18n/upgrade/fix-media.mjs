// V2 completion strings: SALEEM Fix media editing and providers (D198).
export const ar = {
  fix: {
    method: {
      media: {
        title: "تعديل الفيديو داخل سليم",
        body: "تعديل حتمي على اللقطات الأصلية: كتم العبارات المخالفة، تغطية النص على الشاشة، إضافة الإفصاح والترجمة، وتعليق صوتي مصحح تسجّله أو ترفعه. ينتج ملف فيديو جديداً دون أي تكلفة.",
        cta: "ابدأ تعديل الفيديو",
      },
    },
  },
  fix2: {
    title: "تصحيح الفيديو",
    subtitle:
      "التعديلات مقترحة من الملاحظات والنص المصحح. راجعها ثم أنشئ الفيديو المصحح؛ الملف الأصلي لا يتغير.",
    mute: "كتم الكلام المخالف (بالثواني)",
    covers: "تغطية نص على الشاشة",
    overlays: "إفصاح ظاهر على الفيديو",
    addRange: "إضافة نطاق",
    addOverlay: "إضافة إفصاح",
    from: "من",
    to: "إلى",
    position: "الموضع",
    pos: { top: "أعلى", middle: "وسط", bottom: "أسفل" },
    replacementText: "نص بديل (اختياري)",
    disclosureText: "نص الإفصاح",
    subtitles: "ترجمة مكتوبة بالنص المصحح ({n} مقاطع)",
    voiceover: "التعليق الصوتي المصحح",
    record: "تسجيل من الميكروفون",
    stopRecording: "إيقاف التسجيل",
    uploadVoice: "رفع ملف صوتي",
    removeVoice: "إزالة التعليق",
    replaceAudio: "استبدال الصوت الأصلي بالكامل",
    scriptToRead: "النص المصحح الذي يُقرأ في التعليق الصوتي:",
    providersTitle: "مزوّدو الصوت والفيديو",
    voice: {
      recorded: "تسجيل بصوتك من المتصفح — متاح ومجاني.",
      uploaded: "رفع تعليق صوتي مسجّل مسبقاً — متاح ومجاني.",
      gemini_tts:
        "Gemini TTS: يحتاج مفتاح API بفوترة مفعّلة وإعداد SALEEM_FIX_TTS_PROVIDER على الخادم؛ غير مُعد.",
      heygen:
        "HeyGen: يحتاج اشتراك API (ليس اشتراك الموقع أو إضافة ChatGPT) ومفتاحاً على الخادم؛ غير مُعد.",
      elevenlabs: "ElevenLabs: يحتاج حساب API ومفتاحاً على الخادم؛ غير مُعد.",
    },
    video: {
      veo: "توليد فيديو بديل عبر Veo (Gemini API): مدفوع ويحتاج تفعيل الفوترة؛ غير مُعد.",
      heygen_video: "فيديو بشخصية افتراضية عبر HeyGen API: يحتاج اشتراك API؛ غير مُعد.",
      runway: "Runway API: يحتاج حساباً ومفتاحاً؛ غير مُعد.",
    },
    render: "إنشاء الفيديو المصحح",
    renderAgain: "إعادة الإنشاء",
    rendering: "جارٍ الإنشاء… {p}٪",
    format: "الصيغة الناتجة: {f}",
    renderNote:
      "يتم الإنشاء على جهازك أثناء تشغيل الفيديو مرة واحدة (يستغرق مدة الفيديو تقريباً). لا يُرسل الفيديو لأي مزوّد.",
    corrected: "الفيديو المصحح",
    rendered: "أُنشئ الفيديو المصحح. قارنه بالأصل قبل القبول.",
    acceptVideo:
      "القبول يرفع الفيديو المصحح كإصدار فيديو جديد تحت الإعلان نفسه ويبدأ فحصه الآلي. لا يُستبدل الأصل ولا يُورَّث أي اعتماد.",
    acceptVideoCta: "قبول الفيديو المصحح كإصدار جديد",
    err: {
      generic: "تعذّر إنشاء الفيديو.",
      no_edits: "لا توجد تعديلات: لن يُقدَّم الفيديو الأصلي كفيديو مصحح.",
      recorder_unsupported:
        "متصفحك لا يدعم تسجيل الفيديو (MediaRecorder). استخدم Chrome أو Edge أو Firefox حديثاً.",
      source_unreadable: "تعذّر قراءة الفيديو الأصلي (انتهت صلاحية الرابط أو حُذف الملف).",
      render_empty: "الملف الناتج فارغ؛ أعد المحاولة.",
      cancelled: "أُلغي الإنشاء.",
      microphone: "لم يُسمح باستخدام الميكروفون.",
    },
  },
  review: { preflight: { media_unavailable: "لا يوجد فيديو أصلي متاح لهذا الإصدار." } },
};
export const en = {
  fix: {
    method: {
      media: {
        title: "Edit the video in SALEEM",
        body: "Deterministic edits on the original footage: mute the problematic statements, cover on-screen text, add the disclosure and subtitles, and a corrected voiceover you record or upload. Produces a new video file at no cost.",
        cta: "Start video correction",
      },
    },
  },
  fix2: {
    title: "Video correction",
    subtitle:
      "Edits are proposed from the findings and the corrected script. Review them, then render the corrected video; the original file is never changed.",
    mute: "Mute problematic speech (seconds)",
    covers: "Cover on-screen text",
    overlays: "Visible disclosure",
    addRange: "Add range",
    addOverlay: "Add disclosure",
    from: "From",
    to: "To",
    position: "Position",
    pos: { top: "Top", middle: "Middle", bottom: "Bottom" },
    replacementText: "Replacement text (optional)",
    disclosureText: "Disclosure text",
    subtitles: "Subtitles with the corrected script ({n} segments)",
    voiceover: "Corrected voiceover",
    record: "Record from microphone",
    stopRecording: "Stop recording",
    uploadVoice: "Upload audio file",
    removeVoice: "Remove voiceover",
    replaceAudio: "Replace the original audio entirely",
    scriptToRead: "Corrected script to read in the voiceover:",
    providersTitle: "Voice and video providers",
    voice: {
      recorded: "Record your own voice in the browser — available, free.",
      uploaded: "Upload a pre-recorded voiceover — available, free.",
      gemini_tts:
        "Gemini TTS: needs an API key with billing and SALEEM_FIX_TTS_PROVIDER on the server; not configured.",
      heygen:
        "HeyGen: needs an API plan (not the website or ChatGPT plugin subscription) and a server key; not configured.",
      elevenlabs: "ElevenLabs: needs an API account and a server key; not configured.",
    },
    video: {
      veo: "Replacement video with Veo (Gemini API): paid, needs billing; not configured.",
      heygen_video: "Avatar video with the HeyGen API: needs an API plan; not configured.",
      runway: "Runway API: needs an account and key; not configured.",
    },
    render: "Render corrected video",
    renderAgain: "Render again",
    rendering: "Rendering… {p}%",
    format: "Output format: {f}",
    renderNote:
      "Rendering happens on your device while the video plays once (about its length). The video is not sent to any provider.",
    corrected: "Corrected video",
    rendered: "Corrected video ready. Compare it with the original before accepting.",
    acceptVideo:
      "Accepting uploads the corrected video as a new video version of the same advertisement and starts its analysis. The original stays and no approval carries over.",
    acceptVideoCta: "Accept corrected video as a new version",
    err: {
      generic: "The video could not be rendered.",
      no_edits: "No edits: the original video would not be offered as a corrected one.",
      recorder_unsupported:
        "Your browser cannot record video (MediaRecorder). Use a recent Chrome, Edge or Firefox.",
      source_unreadable: "The original video could not be read (link expired or file deleted).",
      render_empty: "The rendered file is empty; try again.",
      cancelled: "Rendering cancelled.",
      microphone: "Microphone access was not allowed.",
    },
  },
  review: { preflight: { media_unavailable: "No original video is available for this version." } },
};
