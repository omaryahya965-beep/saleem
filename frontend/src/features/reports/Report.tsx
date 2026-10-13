import { useEffect, useRef, useState } from "react";
import { Check, FileCheck2, Link2, Upload, X } from "lucide-react";
import { Button } from "@/components/Button";
import { StatusChip } from "@/components/StatusChip";
import { Disclaimer } from "@/components/Disclaimer";
import { VideoPlayer } from "./VideoPlayer";
import { ReadyReport } from "./ReadyReport";
import { fetchReportData } from "@/lib/api/client";
import type { IssueItem, ReportData } from "@/lib/api/types";
import type { Screen } from "@/types/app";

export const defaultIssues: IssueItem[] = [
  {
    id: "MAW-01",
    time: 0,
    type: "v",
    title: "ادعاء صحي يحتاج دليلاً",
    rule: "الادعاءات الطبية",
    source: "دليل القواعد 2026.10",
    evidence: "«يساعد على حرق الدهون بسرعة»",
    fix: "احذف الادعاء أو أضف مصدراً موثقاً.",
  },
  {
    id: "CNT-01",
    time: 12,
    type: "v",
    title: "ظهور شخص يبدو قاصراً",
    rule: "حماية القاصرين",
    source: "دليل القواعد 2026.10",
    evidence: "لقطة من الثانية 00:12",
    fix: "استخدم لقطة بديلة لا يظهر فيها القاصر.",
  },
  {
    id: "COM-01",
    time: 21,
    type: "w",
    title: "وعد بنتيجة غير واقعية",
    rule: "الشفافية في الإعلانات",
    source: "دليل القواعد 2026.10",
    evidence: "«تنزلين خمسة كيلو بأسبوع بدون أي رجيم»",
    fix: "أضف عبارة توضح أن النتائج تختلف من شخص لآخر.",
  },
  {
    id: "AI-01",
    time: 30,
    type: "w",
    title: "محتوى مولّد بالذكاء الاصطناعي",
    rule: "الإفصاح عن المحتوى",
    source: "دليل القواعد 2026.10",
    evidence: "لقطة من الثانية 00:30",
    fix: "أضف إفصاحاً واضحاً عن استخدام الذكاء الاصطناعي.",
  },
  {
    id: "MAW-02",
    time: null,
    type: "w",
    title: "إعلان مدفوع غير معلن",
    rule: "الإفصاح التجاري",
    source: "دليل القواعد 2026.10",
    evidence: "لم نحدد لحظة بعينها",
    fix: "أضف وسم إعلان مدفوع في الوصف.",
  },
];

export function Report({
  ready,
  go,
  submissionId,
  setSubmissionId,
}: {
  ready: boolean;
  go: (s: Screen) => void;
  submissionId?: string;
  setSubmissionId: (id: string) => void;
}) {
  const [selected, setSelected] = useState(1);
  const [time, setTime] = useState(12);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const video = useRef<HTMLVideoElement>(null);

  const targetId = ready
    ? "d0000000-0000-0000-0000-000000000002"
    : submissionId || "d0000000-0000-0000-0000-000000000001";

  useEffect(() => {
    fetchReportData(targetId).then((data) => {
      setReportData(data);
    });
  }, [targetId]);

  const activeIssues =
    reportData?.issues && reportData.issues.length > 0 ? reportData.issues : defaultIssues;

  const select = (i: number) => {
    setSelected(i);
    const t = activeIssues[i]?.time;
    if (t !== null && t !== undefined) {
      setTime(t);
      if (video.current) video.current.currentTime = t;
    }
  };

  const violationsCount = activeIssues.filter((x) => x.type === "v").length;
  const warningsCount = activeIssues.filter((x) => x.type === "w").length;

  return (
    <main className="container page-pad">
      <section className={`status-band ${ready ? "ok" : "v"}`}>
        <div className="status-copy">
          <span className="status-icon">{ready ? <Check /> : <X />}</span>
          <div>
            <h1>{ready ? "جاهز للنشر" : "يحتاج تعديلات"}</h1>
            <p>
              {ready
                ? "لم نجد مخالفات أو تنبيهات بعد مراجعة 12 قاعدة"
                : `وجدنا ${violationsCount} مخالفة و${warningsCount} تنبيهات تحتاج انتباهك قبل النشر`}
            </p>
            <div className="facts">
              <span>{reportData?.submission?.title || "إعلان مكمّل غذائي"}</span>
              <span>{reportData?.submission?.platform || "Snapchat"}</span>
              <span>13 أكتوبر 2026</span>
              <span>دليل القواعد 2026.10</span>
            </div>
          </div>
        </div>
        <div className="actions">
          {ready ? (
            <>
              <Button onClick={() => go("log")}>
                <FileCheck2 /> تنزيل سجل الامتثال
              </Button>
              <Button secondary onClick={() => go("new")}>
                فحص جديد
              </Button>
            </>
          ) : (
            <>
              <Button onClick={() => go("processing")}>
                <Upload /> رفع النسخة المعدّلة
              </Button>
              <Button secondary onClick={() => go("log")}>
                سجل الامتثال
              </Button>
            </>
          )}
        </div>
      </section>
      {ready ? (
        <ReadyReport
          go={go}
          issues={activeIssues}
          onPrevious={() => {
            setSubmissionId("d0000000-0000-0000-0000-000000000001");
            go("report");
          }}
        />
      ) : (
        <div className="report-grid">
          <div className="player-column">
            <VideoPlayer
              video={video}
              time={time}
              setTime={setTime}
              selected={selected}
              select={select}
              issues={activeIssues}
            />
            <details className="transcript">
              <summary>النص المستخرج من الكلام</summary>
              {reportData?.transcript?.segments &&
              Array.isArray(reportData.transcript.segments) &&
              reportData.transcript.segments.length > 0 ? (
                (reportData.transcript.segments as Array<{ start?: number; text?: string }>).map(
                  (seg, idx) => (
                    <p key={idx}>
                      <time>00:{String(Math.round(seg?.start || 0)).padStart(2, "0")}</time>{" "}
                      {seg?.text}
                    </p>
                  ),
                )
              ) : (
                <>
                  <p>
                    <time>00:00</time> هذا المنتج يساعدك على الوصول إلى أهدافك الصحية.
                  </p>
                  <p>
                    <time>00:21</time> تنزلين خمسة كيلو بأسبوع بدون أي رجيم.
                  </p>
                </>
              )}
            </details>
          </div>
          <section className="issues" aria-live="polite">
            <h2>
              الملاحظات <span>({activeIssues.length})</span>
            </h2>
            {activeIssues.map((issue, i) => (
              <button
                className={`issue ${selected === i ? "selected" : ""}`}
                aria-current={selected === i}
                key={`${issue.id}-${i}`}
                onClick={() => select(i)}
              >
                <div className="when">
                  <b>{issue.time === null ? "—" : `00:${String(issue.time).padStart(2, "0")}`}</b>
                  <StatusChip type={issue.type}>
                    {issue.type === "v" ? "مخالفة" : "تنبيه"}
                  </StatusChip>
                </div>
                <div>
                  <h3>{issue.title}</h3>
                  <p className="rule">
                    <code>{issue.id}</code>
                    {issue.rule}
                    <Link2 />{" "}
                    <a
                      href="#rule"
                      onClick={(e) => {
                        e.preventDefault();
                        go("rules");
                      }}
                    >
                      {issue.source}
                    </a>
                  </p>
                  <p className="evidence">
                    <span className="thumb" />
                    {issue.evidence}
                  </p>
                  <p className="fix">
                    <strong>التعديل المقترح:</strong> {issue.fix}
                  </p>
                </div>
              </button>
            ))}
          </section>
        </div>
      )}
      <Disclaimer />
    </main>
  );
}
