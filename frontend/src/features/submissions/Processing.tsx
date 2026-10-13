import { useEffect, useState } from "react";
import { Check, FileCheck2 } from "lucide-react";
import { Button } from "@/components/Button";
import type { Screen } from "@/types/app";

export function Processing({ go }: { go: (s: Screen) => void }) {
  const [progress, setProgress] = useState(25);
  const ready = progress >= 100;

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          return 100;
        }
        return prev + 25;
      });
    }, 1800);
    return () => clearInterval(timer);
  }, []);

  const currentStepIdx = progress >= 100 ? 5 : progress >= 75 ? 3 : progress >= 50 ? 2 : 1;

  return (
    <main className="container page-pad processing">
      <div className="process-card">
        <span className="processing-icon">
          <FileCheck2 />
        </span>
        <h1>نفحص المحتوى الآن</h1>
        <p>نراجع الفيديو لقطة بلقطة ونطابقه مع دليل القواعد.</p>
        <div className="progress-label">
          <span>اكتمل الفحص بنسبة {progress}٪</span>
          <b>{progress}%</b>
        </div>
        <div className="progress">
          <span style={{ width: `${progress}%` }} />
        </div>
        <ol>
          {["رفع الملف", "استخراج اللقطات", "تفريغ الكلام", "مطابقة القواعد", "إعداد التقرير"].map(
            (x, i) => (
              <li
                className={i < currentStepIdx ? "done" : i === currentStepIdx ? "current" : ""}
                key={x}
              >
                <span>{i < currentStepIdx ? <Check /> : i + 1}</span>
                {x}
              </li>
            ),
          )}
        </ol>
        <Button ghost onClick={() => (ready ? go("report") : setProgress(100))}>
          {ready ? "عرض التقرير" : "محاكاة اكتمال الفحص"}
        </Button>
      </div>
    </main>
  );
}
