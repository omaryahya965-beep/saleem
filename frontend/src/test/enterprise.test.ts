import { describe, expect, it } from "vitest";
import { FEATURE_FLAGS, flagOn, flowLive, type ReviewStep } from "@/lib/api/flows";

const step = (status: string) => ({ status }) as ReviewStep;

describe("feature flags", () => {
  it("are off unless exactly true", () => {
    expect(flagOn({ multi_level_approval: true }, "multi_level_approval")).toBe(true);
    expect(flagOn({ multi_level_approval: "true" }, "multi_level_approval")).toBe(false);
    expect(flagOn({}, "multi_level_approval")).toBe(false);
    expect(flagOn(null, "multi_level_approval")).toBe(false);
    expect(flagOn([true], "0")).toBe(false);
  });
  it("lists only flags with a working feature", () => {
    expect(FEATURE_FLAGS).toContain("multi_level_approval");
  });
});

describe("flowLive", () => {
  it("is live while a step is open or waiting", () => {
    expect(flowLive([step("approved"), step("open")])).toBe(true);
    expect(flowLive([step("carried_forward"), step("waiting")])).toBe(true);
    expect(flowLive([step("approved"), step("approved")])).toBe(false);
    expect(flowLive([step("rejected"), step("skipped")])).toBe(false);
    expect(flowLive([])).toBe(false);
  });
});
