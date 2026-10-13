import { Check, FileCheck2 } from "lucide-react";
import { Button } from "@/components/Button";
import { defaultIssues } from "@/features/reports/Report";
import type { Screen } from "@/types/app";

export function Log({ go, submissionId }: { go: (s: Screen) => void; submissionId?: string }) {
  return (
    <main className="container log-wrap">
      <div className="sheet">
        <header>
          <div>
            <h1>سجل امتثال</h1>
            <p>سَليم · تنظيم لا تقييد</p>
          </div>
          <FileCheck2 />
        </header>
        <dl className="kv">
          <dt>رقم الفحص</dt>
          <dd>
            {submissionId ? `SLM-${submissionId.slice(0, 8).toUpperCase()}` : "SLM-2026-00124"}
          </dd>
          <dt>المحتوى</dt>
          <dd>إعلان مكمّل غذائي</dd>
          <dt>المنصة</dt>
          <dd>Snapchat</dd>
          <dt>تاريخ الفحص</dt>
          <dd>13 أكتوبر 2026</dd>
          <dt>البصمة الرقمية للملف</dt>
          <dd dir="ltr">sha256: 7d8a9c…e31f</dd>
          <dt>نسخة دليل القواعد</dt>
          <dd>2026.10-أ</dd>
        </dl>
        <div className="result-stamp">
          <Check />
          <strong>جاهز للنشر</strong>
          <span>بعد معالجة 5 ملاحظات</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>القاعدة</th>
              <th>الملاحظة</th>
              <th>النتيجة</th>
            </tr>
          </thead>
          <tbody>
            {defaultIssues.map((x) => (
              <tr key={x.id}>
                <td>
                  <code>{x.id}</code>
                  <br />
                  {x.rule}
                </td>
                <td>{x.title}</td>
                <td>تمت المعالجة</td>
              </tr>
            ))}
          </tbody>
        </table>
        <footer>
          تنبيهات استرشادية وليست موافقة رسمية. القرار النهائي لك.
          <br />
          تم إنشاء السجل في 13 أكتوبر 2026، 14:32
        </footer>
      </div>
      <div className="log-actions">
        <Button onClick={() => window.print()}>حفظ PDF</Button>
        <button className="back-link" onClick={() => go("ready")}>
          العودة إلى التقرير
        </button>
      </div>
    </main>
  );
}
