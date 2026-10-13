import { Play } from "lucide-react";
import { Button } from "@/components/Button";
import { StatusChip } from "@/components/StatusChip";
import type { Screen } from "@/types/app";

export function Landing({ go }: { go: (s: Screen) => void }) {
  return (
    <>
      <main className="container hero">
        <div>
          <h1>افحص قبل أن تنشر</h1>
          <p>سَليم يفحص إعلانك أو منشورك قبل نشره، ويقول لك أين المشكلة بالثانية وكيف تصلحها.</p>
          <div className="hero-actions">
            <Button onClick={() => go("new")}>ابدأ فحصاً مجانياً</Button>
            <Button secondary onClick={() => go("report")}>
              شاهد تقريراً جاهزاً
            </Button>
          </div>
        </div>
        <div className="hero-demo">
          <div className="demo-top">
            <span>تقرير سَليم</span>
            <StatusChip type="v">يحتاج تعديلات</StatusChip>
          </div>
          <div className="demo-video">
            <Play />
          </div>
          <div className="demo-line">
            <span className="demo-fill" />
          </div>
          <div className="demo-issue">
            <StatusChip type="v">مخالفة · 00:12</StatusChip>
            <h3>ظهور شخص يبدو قاصراً</h3>
            <p>استخدم لقطة بديلة لا يظهر فيها القاصر.</p>
          </div>
        </div>
      </main>
      <section className="landing-band">
        <div className="container">
          <h2>كيف يعمل سَليم</h2>
          <div className="steps">
            {[
              ["ارفع محتواك", "اختر الفيديو أو الصورة وأضف تفاصيل النشر."],
              ["نطابق القواعد", "نفحص كل لقطة ونحدد الملاحظات بالثانية."],
              ["انشر بثقة", "أصلح الملاحظات واحفظ سجل الامتثال."],
            ].map(([a, b], i) => (
              <div key={a}>
                <span>{i + 1}</span>
                <h3>{a}</h3>
                <p>{b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
