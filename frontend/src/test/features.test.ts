import { describe, expect, it } from "vitest";
import ar from "@/i18n/ar.json";
import en from "@/i18n/en.json";
import { errorCode } from "@/lib/api/features";

describe("errorCode", () => {
  it("maps database exceptions to stable codes", () => {
    expect(errorCode({ message: "quota_exceeded" })).toBe("quota_exceeded");
    expect(errorCode({ message: "permission denied", code: "42501" })).toBe("forbidden");
    expect(errorCode(new Error("boom"))).toBe("generic");
  });
  it("every code has an Arabic and English message", () => {
    const codes = [
      "quota_exceeded",
      "clip_too_long",
      "batch_full",
      "plan_no_orgs",
      "invite_invalid",
      "invite_email_mismatch",
      "last_owner",
      "link_invalid",
      "rate_limited",
      "campaign_mismatch",
      "transfer_ownership_first",
      "confirmation_mismatch",
      "forbidden",
      "generic",
    ];
    for (const c of codes) {
      expect((ar.quota as Record<string, string>)[c], `ar ${c}`).toBeTruthy();
      expect((en.quota as Record<string, string>)[c], `en ${c}`).toBeTruthy();
    }
  });
  it("legal documents have every section in both languages", () => {
    const sections = { terms: 6, privacy: 8, disclaimer: 3, ai: 6 } as const;
    for (const [doc, n] of Object.entries(sections)) {
      for (let i = 1; i <= n; i++) {
        for (const dict of [ar, en]) {
          const d = (
            dict.legal as unknown as Record<string, Record<string, { h: string; p: string }>>
          )[doc]![`s${i}`];
          expect(d?.h && d?.p, `${doc}.s${i}`).toBeTruthy();
        }
      }
    }
  });
});
