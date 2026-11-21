// Public pages: availability labels updated to the verified AI Studio (D209). Script by Gemini is provider-dependent
// (the deterministic template is always available); local voice and assembly from product assets are available;
// fully generated footage stays provider-dependent and is not configured.
export const ar = {
  home: {
    journeys: {
      create: {
        steps: {
          script: "مسودة النص: قالب حتمي، أو Gemini عند إعداده",
          voice: "تعليق صوتي عربي وإنجليزي مولّد على جهازك",
          assembly: "تجميع فيديو MP4 من صور المنتج والنص والإفصاحات",
          footage: "لقطات فيديو مولّدة بالكامل (مزوّد مدفوع غير مُعدّ)",
        },
        cta: "افتح استوديو سليم",
        note: "متاح اليوم في استوديو سليم: نص مقسّم إلى مشاهد (قالب حتمي مجاني، أو Gemini عند إعداده)، تعليق صوتي يُولَّد على جهازك، وفيديو MP4 من صورك ونصوصك. اللقطات المولّدة بالكامل والمقدّمون الافتراضيون يحتاجون مزوّداً مدفوعاً غير مُعدّ.",
      },
    },
    cap: {
      media: {
        title: "تصحيح الفيديو وتجميعه داخل المتصفح",
        body: "كتم العبارات، تغطية النص، إفصاح ظاهر، ترجمة، وتعليق صوتي مولّد على جهازك أو مسجّل — دون إرسال الفيديو لأي مزوّد.",
      },
    },
  },
  demo: {
    tools: {
      voice: {
        title: "تعليق صوتي مصحح",
        body: "يُولَّد على جهازك بالعربية أو الإنجليزية من النص المصحح، أو يُسجَّل أو يُرفع، ويستبدل الصوت الأصلي.",
      },
    },
  },
};
export const en = {
  home: {
    journeys: {
      create: {
        steps: {
          script: "Draft script: deterministic template, or Gemini when configured",
          voice: "Arabic and English voiceover generated on your device",
          assembly: "MP4 assembled from product photos, text and disclosures",
          footage: "Fully generated video footage (paid provider, not configured)",
        },
        cta: "Open SALEEM AI Studio",
        note: "Available today in SALEEM AI Studio: a scene-by-scene script (free deterministic template, or Gemini when configured), a voiceover generated on your device, and an MP4 built from your photos and text. Fully generated footage and virtual presenters need a paid provider that is not configured.",
      },
    },
    cap: {
      media: {
        title: "In-browser video correction and assembly",
        body: "Mute statements, cover text, add a visible disclosure, subtitles, and a voiceover generated on your device or recorded — without sending the video to any provider.",
      },
    },
  },
  demo: {
    tools: {
      voice: {
        title: "Corrected voiceover",
        body: "Generated on your device in Arabic or English from the corrected script, or recorded or uploaded; it replaces the original audio.",
      },
    },
  },
};
