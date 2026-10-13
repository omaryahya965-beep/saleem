import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronLeft,
  FileCheck2,
  FileText,
  Info,
  Link2,
  Play,
  Search,
  ShieldCheck,
  TriangleAlert,
  Upload,
  Video,
  X,
} from "lucide-react";
import {
  fetchRules,
  fetchSubmissions,
  fetchReportData,
  createNewSubmission,
  signIn,
  signInDemo,
} from "@/lib/api/client";
import type { DbSubmission, DbRule, IssueItem, ReportData } from "@/lib/api/types";

export const Route = createFileRoute("/")({ component: SaleemApp });

type Screen =
  "report" | "ready" | "new" | "processing" | "dashboard" | "log" | "rules" | "landing" | "login";

const defaultIssues: IssueItem[] = [
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

function Header({ screen, go }: { screen: Screen; go: (s: Screen) => void }) {
  return (
    <header className="topbar">
      <div className="container topbar-inner">
        <button className="brand" onClick={() => go("landing")}>
          <span className="brand-mark">س</span>
          <span>سَليم</span>
        </button>
        <nav>
          <button
            className={screen === "dashboard" ? "active" : ""}
            onClick={() => go("dashboard")}
          >
            فحوصاتي
          </button>
          <button className={screen === "new" ? "active" : ""} onClick={() => go("new")}>
            فحص جديد
          </button>
          <button className={screen === "rules" ? "active" : ""} onClick={() => go("rules")}>
            دليل القواعد
          </button>
        </nav>
        <div className="top-actions">
          <button className="lang">EN</button>
          <button className="avatar" aria-label="حسابي" onClick={() => go("login")}>
            م
          </button>
        </div>
      </div>
    </header>
  );
}

function StatusChip({ type, children }: { type: "v" | "w" | "ok"; children: React.ReactNode }) {
  return (
    <span className={`chip ${type}`}>
      {type === "v" ? <X /> : type === "w" ? <TriangleAlert /> : <Check />}
      {children}
    </span>
  );
}
function Button({
  children,
  onClick,
  secondary = false,
  ghost = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  secondary?: boolean;
  ghost?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`btn ${secondary ? "secondary" : ghost ? "ghost" : "primary"}`}
    >
      {children}
    </button>
  );
}
function Disclaimer() {
  return (
    <div className="disclaimer">
      <Info /> <span>تنبيهات استرشادية وليست موافقة رسمية. القرار النهائي لك.</span>
    </div>
  );
}

function Report({
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

function VideoPlayer({
  video,
  time,
  setTime,
  selected,
  select,
  issues,
}: {
  video: React.RefObject<HTMLVideoElement | null>;
  time: number;
  setTime: (n: number) => void;
  selected: number;
  select: (n: number) => void;
  issues: IssueItem[];
}) {
  return (
    <div className="player">
      <div className="video-frame">
        <video ref={video} controls aria-label="فيديو إعلان مكمّل غذائي">
          <source src="" />
        </video>
        <div className="video-placeholder">
          <Play />
        </div>
        <span className="now">00:{String(time).padStart(2, "0")}</span>
      </div>
      <div className="timeline">
        <div className="fill" style={{ width: `${(time / 40) * 100}%` }} />
        {issues.map(
          (issue, i) =>
            issue.time !== null && (
              <button
                key={`${issue.id}-${i}`}
                className={`marker ${issue.type} ${selected === i ? "selected" : ""}`}
                style={{ insetInlineStart: `${(issue.time / 40) * 100}%` }}
                aria-label={`${issue.type === "v" ? "مخالفة" : "تنبيه"} عند 00:${String(issue.time).padStart(2, "0")}`}
                onClick={() => select(i)}
              />
            ),
        )}
      </div>
      <div className="times">
        <span>00:00</span>
        <span>00:40</span>
      </div>
      <div className="legend">
        <span>
          <i className="red-dot" /> مخالفة
        </span>
        <span>
          <i className="amber-dot" /> تنبيه
        </span>
      </div>
    </div>
  );
}

function ReadyReport({
  go,
  issues,
  onPrevious,
}: {
  go: (s: Screen) => void;
  issues: IssueItem[];
  onPrevious: () => void;
}) {
  return (
    <section className="ready-content">
      <h2>ما تم إصلاحه مقارنة بالنسخة السابقة</h2>
      <ul>
        {issues.map((x, i) => (
          <li key={`${x.id}-${i}`}>
            <Check />
            <span>{x.title}</span>
            <StatusChip type="ok">تم</StatusChip>
          </li>
        ))}
      </ul>
      <button className="previous" onClick={onPrevious}>
        <ChevronLeft /> النسخة السابقة: يحتاج تعديلات، 5 ملاحظات
      </button>
    </section>
  );
}

function NewCheck({ go, onCreated }: { go: (s: Screen) => void; onCreated: (id: string) => void }) {
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
            ].map((sw, i) => (
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

function Processing({ go }: { go: (s: Screen) => void }) {
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

function Dashboard({
  go,
  onSelect,
}: {
  go: (s: Screen) => void;
  onSelect: (id: string, status: string) => void;
}) {
  const [submissions, setSubmissions] = useState<DbSubmission[]>([]);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    fetchSubmissions().then(setSubmissions);
  }, []);

  const filtered = submissions.filter((sub) => {
    if (filter === "needs_fixes") return sub.overall_status === "needs_fixes";
    if (filter === "review") return sub.overall_status === "review";
    if (filter === "ready") return sub.overall_status === "ready";
    return true;
  });

  return (
    <main className="container page-pad">
      <div className="page-heading">
        <div>
          <h1>فحوصاتي</h1>
          <p>تابع فحوصاتك وتقاريرك السابقة من مكان واحد.</p>
        </div>
        <Button onClick={() => go("new")}>فحص جديد</Button>
      </div>
      <div className="tabs">
        <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>
          الكل
        </button>
        <button
          className={filter === "needs_fixes" ? "active" : ""}
          onClick={() => setFilter("needs_fixes")}
        >
          يحتاج تعديلات
        </button>
        <button className={filter === "review" ? "active" : ""} onClick={() => setFilter("review")}>
          يحتاج مراجعة
        </button>
        <button className={filter === "ready" ? "active" : ""} onClick={() => setFilter("ready")}>
          جاهز للنشر
        </button>
      </div>
      <div className="check-list">
        {filtered.map((item, i) => {
          const isNeedsFixes = item.overall_status === "needs_fixes";
          return (
            <button
              className="check-row"
              key={item.id || i}
              onClick={() => {
                onSelect(item.id, item.overall_status || "needs_fixes");
                go(item.overall_status === "ready" ? "ready" : "report");
              }}
            >
              <span className="list-thumb">
                <Play />
              </span>
              <span>
                <b>{item.title || "فحص محتوى"}</b>
                <small>{item.platform} · 13 أكتوبر 2026</small>
              </span>
              <StatusChip type={isNeedsFixes ? "v" : "ok"}>
                {isNeedsFixes ? "يحتاج تعديلات" : "جاهز للنشر"}
              </StatusChip>
              <ChevronLeft />
            </button>
          );
        })}
      </div>
    </main>
  );
}

function Rulebook() {
  const [rules, setRules] = useState<DbRule[]>([]);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    fetchRules().then(setRules);
  }, []);

  const filteredRules = rules.filter((r) => {
    const matchCategory =
      activeTab === "all" ||
      (activeTab === "ads" && r.category === "mawthooq") ||
      (activeTab === "content" && r.category === "content") ||
      (activeTab === "transparency" && (r.category === "commerce" || r.category === "ai"));

    const query = search.trim().toLowerCase();
    const matchSearch =
      !query ||
      r.code.toLowerCase().includes(query) ||
      r.title_ar.toLowerCase().includes(query) ||
      r.description_ar.toLowerCase().includes(query);

    return matchCategory && matchSearch;
  });

  const categories = [
    {
      title: "الإعلانات والادعاءات",
      items: filteredRules.filter((r) => r.category === "mawthooq"),
    },
    {
      title: "المحتوى والحماية",
      items: filteredRules.filter((r) => r.category === "content" || r.category === "ai"),
    },
    { title: "الشفافية", items: filteredRules.filter((r) => r.category === "commerce") },
  ].filter((group) => group.items.length > 0);

  return (
    <main className="container page-pad">
      <div className="page-heading">
        <div>
          <h1>دليل القواعد</h1>
          <p>القواعد التي نستخدمها لفحص المحتوى قبل النشر.</p>
        </div>
        <span className="version">الإصدار 2026.10-أ، توضيحي بانتظار المراجعة القانونية</span>
      </div>
      <div className="search">
        <Search />
        <input
          placeholder="ابحث في القواعد..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="rule-tabs">
        <button className={activeTab === "all" ? "active" : ""} onClick={() => setActiveTab("all")}>
          الكل
        </button>
        <button className={activeTab === "ads" ? "active" : ""} onClick={() => setActiveTab("ads")}>
          الإعلانات
        </button>
        <button
          className={activeTab === "content" ? "active" : ""}
          onClick={() => setActiveTab("content")}
        >
          المحتوى
        </button>
        <button
          className={activeTab === "transparency" ? "active" : ""}
          onClick={() => setActiveTab("transparency")}
        >
          الشفافية
        </button>
      </div>
      {categories.map((group) => (
        <section className="rule-group" key={group.title}>
          <h2>{group.title}</h2>
          {group.items.map((row) => (
            <div className="rule-row" key={row.code}>
              <code>{row.code}</code>
              <strong>{row.title_ar}</strong>
              <a href={row.source_url} target="_blank" rel="noreferrer">
                المصدر <Link2 />
              </a>
              <StatusChip type={row.default_severity === "violation" ? "v" : "w"}>
                {row.default_severity === "violation" ? "مخالفة" : "تنبيه"}
              </StatusChip>
            </div>
          ))}
        </section>
      ))}
    </main>
  );
}

function Log({ go, submissionId }: { go: (s: Screen) => void; submissionId?: string }) {
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

function Landing({ go }: { go: (s: Screen) => void }) {
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

function Login({ go }: { go: (s: Screen) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async () => {
    setError("");
    try {
      await signIn(email, password);
      go("dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "خطأ في تسجيل الدخول");
    }
  };

  const handleDemo = async () => {
    await signInDemo();
    go("report");
  };

  return (
    <main className="auth">
      <section className="auth-panel">
        <span className="brand-mark large">س</span>
        <h1>مرحباً بك في سَليم</h1>
        <p>سجّل الدخول لمتابعة فحوصاتك.</p>
        {error && <small style={{ color: "#ef4444", marginBottom: "0.5rem" }}>{error}</small>}
        <label>
          البريد الإلكتروني
          <input dir="ltr" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          كلمة المرور
          <input
            dir="ltr"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <Button onClick={handleLogin}>تسجيل الدخول</Button>
        <div className="or">أو</div>
        <Button secondary onClick={handleDemo}>
          جرّب الحساب التجريبي
        </Button>
        <a
          href="#signup"
          onClick={(e) => {
            e.preventDefault();
            handleDemo();
          }}
        >
          إنشاء حساب جديد
        </a>
      </section>
    </main>
  );
}

function SaleemApp() {
  const [screen, setScreen] = useState<Screen>("report");
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string>(
    "d0000000-0000-0000-0000-000000000001",
  );
  const go = (s: Screen) => setScreen(s);

  return (
    <div dir="rtl">
      <Header screen={screen} go={go} />
      {screen === "report" && (
        <Report
          ready={false}
          go={go}
          submissionId={selectedSubmissionId}
          setSubmissionId={setSelectedSubmissionId}
        />
      )}
      {screen === "ready" && (
        <Report
          ready
          go={go}
          submissionId={selectedSubmissionId}
          setSubmissionId={setSelectedSubmissionId}
        />
      )}
      {screen === "new" && <NewCheck go={go} onCreated={(id) => setSelectedSubmissionId(id)} />}
      {screen === "processing" && <Processing go={go} />}
      {screen === "dashboard" && (
        <Dashboard go={go} onSelect={(id, _status) => setSelectedSubmissionId(id)} />
      )}
      {screen === "rules" && <Rulebook />}
      {screen === "log" && <Log go={go} submissionId={selectedSubmissionId} />}
      {screen === "landing" && <Landing go={go} />}
      {screen === "login" && <Login go={go} />}
    </div>
  );
}
