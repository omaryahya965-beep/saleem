import type { Screen } from "@/types/app";

export function Header({ screen, go }: { screen: Screen; go: (s: Screen) => void }) {
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
