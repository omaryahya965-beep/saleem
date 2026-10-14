// Email notification provider interface.
// EMAIL_PROVIDER=console (default) logs the message; EMAIL_PROVIDER=resend sends via Resend
// (needs RESEND_API_KEY and EMAIL_FROM; account setup documented in docs/OPERATIONS.md).

import { log } from "./http.ts";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface EmailProvider {
  readonly name: string;
  send(msg: EmailMessage): Promise<void>;
}

class ConsoleEmail implements EmailProvider {
  readonly name = "console";
  async send(msg: EmailMessage) {
    // Never log the address in full.
    log("email_console", { to: msg.to.replace(/^(.).*(@.*)$/, "$1***$2"), subject: msg.subject });
  }
}

class ResendEmail implements EmailProvider {
  readonly name = "resend";
  constructor(private key: string, private from: string) {}
  async send(msg: EmailMessage) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: this.from, to: msg.to, subject: msg.subject, text: msg.text, html: msg.html }),
    });
    if (!res.ok) throw new Error(`resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
}

export function emailProvider(env: (k: string) => string | undefined): EmailProvider {
  if (env("EMAIL_PROVIDER") === "resend" && env("RESEND_API_KEY") && env("EMAIL_FROM")) {
    return new ResendEmail(env("RESEND_API_KEY")!, env("EMAIL_FROM")!);
  }
  return new ConsoleEmail();
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Bilingual (Arabic first) check-finished / check-failed email. */
export function checkEmail(opts: {
  ok: boolean;
  title: string;
  status: string | null;
  url: string;
  lang: "ar" | "en";
}): Omit<EmailMessage, "to"> {
  const statusAr: Record<string, string> = { ready: "جاهز للنشر", review: "يحتاج مراجعة", needs_fixes: "يحتاج تعديلات" };
  const statusEn: Record<string, string> = { ready: "Ready to publish", review: "Needs review", needs_fixes: "Needs fixes" };
  const ar = opts.ok
    ? `اكتمل فحص «${opts.title}»: ${statusAr[opts.status ?? ""] ?? ""}.`
    : `تعذّر إكمال فحص «${opts.title}». يمكنك إعادة المحاولة من التقرير.`;
  const en = opts.ok
    ? `Your check “${opts.title}” is done: ${statusEn[opts.status ?? ""] ?? ""}.`
    : `We couldn't finish the check “${opts.title}”. You can retry from the report.`;
  const subject = opts.lang === "en" ? (opts.ok ? "Your SALEEM check is ready" : "Your SALEEM check failed") : opts.ok ? "نتيجة فحص سَليم جاهزة" : "تعذّر إكمال فحص سَليم";
  const disclaimer = "تنبيهات استرشادية وليست موافقة رسمية. القرار النهائي لك. · Advisory alerts, not an official approval.";
  return {
    subject,
    text: `${ar}\n${en}\n\n${opts.url}\n\n${disclaimer}`,
    html: `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;line-height:1.7"><p>${esc(ar)}</p><p dir="ltr">${esc(en)}</p><p><a href="${esc(opts.url)}">${esc(opts.url)}</a></p><p style="color:#4b5552;font-size:13px">${esc(disclaimer)}</p></div>`,
  };
}
