import { useEffect, useState } from "react";
import { ChevronLeft, Play } from "lucide-react";
import { Button } from "@/components/Button";
import { StatusChip } from "@/components/StatusChip";
import { fetchSubmissions } from "@/lib/api/client";
import type { DbSubmission } from "@/lib/api/types";
import type { Screen } from "@/types/app";

export function Dashboard({
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
