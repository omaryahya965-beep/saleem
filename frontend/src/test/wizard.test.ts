// D179: new-advertisement wizard rules — a cosmetic product never defaults to a financial promotion, conflicts
// are explained before analysis, one platform representation, creator-only fields.
import { describe, expect, it } from "vitest";
import {
  categoryFor,
  conflicts,
  defaultCommunication,
  platformFromChannels,
  showsCreatorFields,
} from "@/features/submissions/wizard";
import { PLATFORMS } from "@/lib/api/data";

const base = {
  hasOrg: true,
  product: { sector: "cosmetics", status: "approved" as const },
  communicationType: "general_commercial" as const,
  category: "beauty" as const,
  channels: ["snapchat"],
  distribution: "owned",
  isPaid: true,
  hasContract: false,
  aiUsed: false,
  license: "",
};

describe("new advertisement wizard", () => {
  it("defaults from the product, not the organisation sector", () => {
    expect(defaultCommunication({ sector: "cosmetics" }, "banking")).toBe("general_commercial");
    expect(defaultCommunication({ sector: "banking" }, "banking")).toBe("financial_promotion");
    expect(defaultCommunication(null, "banking")).toBe("general_commercial");
    expect(categoryFor({ sector: "cosmetics" })).toBe("beauty");
    expect(categoryFor({ sector: "insurance" })).toBe("finance");
  });

  it("Nada Cream on own channels: no conflicts, no Mawthooq fields", () => {
    expect(conflicts(base)).toEqual([]);
    expect(showsCreatorFields(base)).toBe(false);
  });

  it("explains contradictions before spending an analysis", () => {
    const keys = (s: Partial<typeof base> & Record<string, unknown>) =>
      conflicts({ ...base, ...s } as typeof base).map((c) => c.key);
    expect(keys({ communicationType: "financial_promotion" as never })).toContain(
      "financial_comm_for_non_financial",
    );
    expect(keys({ category: "finance" as never })).toContain("category_mismatch");
    expect(keys({ channels: [] })).toContain("no_channels");
    expect(conflicts({ ...base, channels: [] }).find((c) => c.key === "no_channels")?.level).toBe(
      "blocking",
    );
    expect(keys({ distribution: "influencer" })).toEqual(
      expect.arrayContaining(["missing_license", "missing_contract"]),
    );
    expect(keys({ product: null as never })).toContain("no_product");
  });

  it("derives the version platform from the channels (one representation)", () => {
    expect(platformFromChannels(["website", "tiktok"], PLATFORMS, "snapchat")).toBe("tiktok");
    expect(platformFromChannels(["website"], PLATFORMS, "snapchat")).toBe("snapchat");
  });
});
