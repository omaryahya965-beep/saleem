import { useRef, useState } from "react";
import { Check, ShieldCheck, Video } from "lucide-react";
import { Button } from "@/components/Button";
import { createNewSubmission } from "@/lib/api/client";
import type { Screen } from "@/types/app";

export function NewCheck({
  go,
  onCreated,
}: {
  go: (s: Screen) => void;
  onCreated: (id: string) => void;
}) {
  const [kind, setKind] = useState<"فيديو" | "صورة" | "نص فقط">("فيديو");
  const [caption, setCaption] = useState("");
  const [platform, setPlatform] = useState<"snapchat" | "instagram" | "tiktok">("snapchat");
  const [category, setCategory] = useState<"health" | "beauty">("health");
  const [isPaidAd, setIsPaidAd] = useState(true);
  const [hasWrittenContract, setHasWrittenContract] = useState(false);
  const [aiUsed, setAiUsed] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async () => {
    const kindMap: Record<string, "video" | "image" | "text"> = {
      فيديو: "video",
      صورة: "image",
      "نص فقط": "text",
    };

    const newId = await createNewSubmission({
      file: selectedFile,
      kind: kindMap[kind] || "video",
      caption: caption || "فحص محتوى جديد",
      platform: platform as "snapchat",
      productCategory: category as "health",
      isPaidAd,
      hasWrittenContract,
      aiUsed,
    });

    onCreated(newId);
    go("processing");
  };

  return (
    <main className="container page-pad">
      <div className="page-heading">
        <div>
          <h1>فحص جديد</h1>
          <p>ارفع محتواك وسنراجع القواعد قبل أن تنشر.</p>
        </div>
      </div>
      <div className="new-grid">
        <div className="form-stack">
          <section className="form-card">
            <h2>نوع المحتوى</h2>
            <div className="segmented">
              {(["فيديو", "صورة", "نص فقط"] as const).map((x) => (
                <button className={kind === x ? "selected" : ""} onClick={() => setKind(x)} key={x}>
                  {x}
                </button>
              ))}
            </div>
            <div
              className="dropzone"
              onClick={() => fileInputRef.current?.click()}
              style={{ cursor: "pointer" }}
            >
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: "none" }}
                accept="video/*,image/*"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setSelectedFile(e.target.files[0]);
                  }
                }}
              />
              <span className="file-icon">
                <Video />
              </span>
              <div>
                <strong>{selectedFile ? selectedFile.name : "اسحب الملف هنا أو اختره"}</strong>
                <p>فيديو حتى 90 ثانية و25 ميغابايت، أو صورة JPG وPNG</p>
                <Button secondary onClick={() => fileInputRef.current?.click()}>
                  {selectedFile ? "تغيير الملف" : "اختيار ملف"}
                </Button>
              </div>
            </div>
            <label>
              التعليق أو النص المصاحب
              <textarea
                placeholder="اكتب النص المصاحب للمحتوى هنا..."
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
              />
            </label>
          </section>
          <section className="form-card">
            <h2>تفاصيل النشر</h2>
            <label>
              المنصة
              <div className="segmented">
                <button
                  className={platform === "snapchat" ? "selected" : ""}
                  onClick={() => setPlatform("snapchat")}
                >
                  Snapchat
                </button>
                <button
                  className={platform === "instagram" ? "selected" : ""}
                  onClick={() => setPlatform("instagram")}
                >
                  Instagram
                </button>
                <button
                  className={platform === "tiktok" ? "selected" : ""}
                  onClick={() => setPlatform("tiktok")}
                >
                  TikTok
                </button>
              </div>
            </label>
            <label>
              التصنيف
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as "health" | "beauty")}
              >
                <option value="health">الصحة واللياقة</option>
                <option value="beauty">الجمال والعناية</option>
              </select>
            </label>
            {[
              {
                label: "هذا إعلان مدفوع أو ترويج لعلامة",
                desc: "يساعدنا على تطبيق القواعد المناسبة.",
                val: isPaidAd,
                set: setIsPaidAd,
              },
              {
                label: "لدي عقد مكتوب مع الماركة",
                desc: "يمكنك تغيير هذا الخيار لاحقاً.",
                val: hasWrittenContract,
                set: setHasWrittenContract,
              },
              {
                label: "استخدمت الذكاء الاصطناعي في المحتوى",
                desc: "يمكنك تغيير هذا الخيار لاحقاً.",
                val: aiUsed,
                set: setAiUsed,
              },
            ].map((sw) => (
              <div className="switch-row" key={sw.label}>
                <div>
                  <strong>{sw.label}</strong>
                  <small>{sw.desc}</small>
                </div>
                <button
                  className={`switch ${sw.val ? "on" : ""}`}
                  role="switch"
                  aria-checked={sw.val}
                  onClick={() => sw.set(!sw.val)}
                >
                  <span />
                </button>
              </div>
            ))}
          </section>
          <div className="submit-row">
            <span>بمتابعة الفحص، أنت توافق على شروط الاستخدام.</span>
            <Button onClick={handleSubmit}>ابدأ الفحص</Button>
          </div>
        </div>
        <aside className="side-panel">
          <ShieldCheck />
          <h2>فحص آمن وموثوق</h2>
          <ul>
            <li>
              <Check /> نراجع المحتوى وفق دليل قواعد واضح
            </li>
            <li>
              <Check /> نخبرك بالثانية والمشكلة والحل
            </li>
            <li>
              <Check /> لا نحتفظ بالفيديو بعد 24 ساعة
            </li>
          </ul>
          <p>نحذف الفيديو واللقطات بعد 24 ساعة من الفحص، ونحتفظ بالملاحظات فقط.</p>
        </aside>
      </div>
    </main>
  );
}
