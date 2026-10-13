import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import type { Screen } from "@/types/app";
import { Header } from "@/components/Header";
import { Report } from "@/features/reports/Report";
import { NewCheck } from "@/features/submissions/NewCheck";
import { Processing } from "@/features/submissions/Processing";
import { Dashboard } from "@/features/submissions/Dashboard";
import { Rulebook } from "@/features/rulebook/Rulebook";
import { Log } from "@/features/compliance-log/Log";
import { Landing } from "@/features/landing/Landing";
import { Login } from "@/features/auth/Login";

export const Route = createFileRoute("/")({ component: SaleemApp });

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
