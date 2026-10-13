import { useState } from "react";
import { Button } from "@/components/Button";
import { signIn, signInDemo } from "@/lib/api/client";
import type { Screen } from "@/types/app";

export function Login({ go }: { go: (s: Screen) => void }) {
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
