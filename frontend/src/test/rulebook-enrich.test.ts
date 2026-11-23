import { describe, expect, it } from "vitest";
import { displayStatus, enrichRules } from "@/features/rulebook/enrich";

// D216: database rules carry a pack, not an authority; the public rulebook must map them.
const PACKS = [
  { code: "sa-gmedia-creators", authority: "GMEDIA", name_ar: "", name_en: "" },
  { code: "sa-cos", authority: "SFDA", name_ar: "", name_en: "" },
  { code: "sa-system", authority: "INTERNAL", name_ar: "", name_en: "" },
];
const SOURCES = [
  {
    id: "gmedia-mawthooq",
    authority: "GMEDIA",
    title_ar: "موثوق",
    title_en: null,
    url: "https://example.org/m",
    status: "in_force",
    verification: "secondary_only",
  },
];
const rule = (
  code: string,
  pack: string,
  review_state: string,
  regulatory_source_id: string | null = null,
) =>
  ({ code, pack, review_state, regulatory_source_id, source_url: null }) as Record<string, unknown>;

describe("rulebook enrichment", () => {
  const out = enrichRules(
    [
      rule("MAW-01", "sa-gmedia-creators", "active", "gmedia-mawthooq"),
      rule("COS-01", "sa-cos", "draft"),
      rule("SYS-CLAIMS", "sa-system", "active"),
    ],
    PACKS,
    SOURCES,
    (c) => `label:${c}`,
  );
  it("maps each rule to its authority and sector from the pack", () => {
    expect(out.map((r) => r.authority)).toEqual(["GMEDIA", "SFDA", "INTERNAL"]);
    expect(out.map((r) => r.sector_code)).toEqual(["MEDIA", "COS", "SYS"]);
    expect(out[0]!.sector_ar).toBe("label:MEDIA");
  });
  it("carries the source verification and URL; drafts stay drafts", () => {
    expect(out[0]!.source_verification).toBe("secondary_only");
    expect(out[0]!.source_url).toBe("https://example.org/m");
    expect(out[2]!.source_verification).toBe("internal");
    expect(out[1]!.review_state).toBe("draft");
  });
  it("derives the display status from real data only (D219)", () => {
    const st = (review_state: string, source_verification: string | null) =>
      displayStatus({ review_state, source_verification } as Parameters<typeof displayStatus>[0]);
    expect(st("active", "official_text_opened")).toBe("active");
    // A draft is never shown as active, whatever its source.
    expect(st("draft", "official_text_opened")).toBe("needs_review");
    expect(st("draft", "official_status_unconfirmed")).toBe("verifying");
    expect(st("draft", null)).toBe("verifying");
    expect(st("pending_review", "secondary_only")).toBe("needs_review");
    expect(st("archived", "official_text_opened")).toBe("archived");
    expect(st("superseded", null)).toBe("superseded");
  });
});
