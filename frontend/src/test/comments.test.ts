// D189: comment categories per role and timestamp parsing (the server enforces the same rules: pgTAP p12).
import { describe, expect, it } from "vitest";
import { allowedKinds, parseTimestamp } from "@/features/collab/CommentsPanel";

describe("comments", () => {
  it("only deciders post change requests / reviewer feedback; only the case's legal advisor posts opinions", () => {
    expect(allowedKinds("creator", true, false)).toEqual(["general", "question", "evidence"]);
    expect(allowedKinds("reviewer", false, false)).toContain("reviewer_feedback");
    expect(allowedKinds("reviewer", true, false)).not.toContain("change_request");
    expect(allowedKinds("legal", false, true)).toContain("legal_opinion");
    expect(allowedKinds("legal", false, false)).not.toContain("legal_opinion");
  });
  it("parses m:ss and seconds", () => {
    expect(parseTimestamp("0:12")).toBe(12);
    expect(parseTimestamp("1:05")).toBe(65);
    expect(parseTimestamp("7.5")).toBe(7.5);
    expect(parseTimestamp("")).toBeNull();
    expect(parseTimestamp("1:75")).toBeNull();
  });
});
