import { useEffect, useState } from "react";
import { Link2, Search } from "lucide-react";
import { StatusChip } from "@/components/StatusChip";
import { fetchRules } from "@/lib/api/client";
import type { DbRule } from "@/lib/api/types";

export function Rulebook() {
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
