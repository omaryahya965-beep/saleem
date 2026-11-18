// Phase 7.4 — Ask SALEEM helpers.
import { describe, expect, it } from "vitest";
import { orFilter, plainAnswer, terms } from "../supabase/functions/_shared/ask.ts";

describe("ask", () => {
  it("extracts search terms and keeps rule codes", () => {
    const ts = terms("ما هي قاعدة SAMA-ADV-03 عن الإفصاح عن المعدل السنوي؟");
    expect(ts).toContain("SAMA-ADV-03");
    expect(ts).toContain("إفصاح");
    expect(ts.length).toBeLessThanOrEqual(5);
  });
  it("sanitises the filter grammar", () => {
    expect(orFilter(["title"], ["a,b(c)*"])).toBe("title.ilike.*abc*");
  });
  it("answers plainly without a model and says when nothing was found", () => {
    expect(plainAnswer([], "ar")).toContain("لم أجد");
    expect(plainAnswer([{ kind: "rule", id: "1", title: "SAMA-1 · x", detail: "active", link: "/rules" }], "en")).toContain("[1] SAMA-1 · x — active");
  });
});
