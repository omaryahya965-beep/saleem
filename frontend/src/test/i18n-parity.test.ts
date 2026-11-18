import { describe, expect, it } from "vitest";
import ar from "@/i18n/ar.json";
import en from "@/i18n/en.json";

function keys(obj: unknown, prefix = ""): string[] {
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) return [prefix];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    keys(v, prefix ? `${prefix}.${k}` : k),
  );
}

/** Plural forms differ by language (Arabic has zero/two/few/many), so compare the plural object. */
const PLURAL = /.(zero|one|two|few|many|other)$/;
const base = (k: string) => k.replace(PLURAL, "");

describe("i18n key parity", () => {
  const arKeys = new Set(keys(ar).map(base));
  const enKeys = new Set(keys(en).map(base));
  it("every Arabic key exists in English", () => {
    expect([...arKeys].filter((k) => !enKeys.has(k))).toEqual([]);
  });
  it("every English key exists in Arabic", () => {
    expect([...enKeys].filter((k) => !arKeys.has(k))).toEqual([]);
  });
  it("no empty Arabic strings", () => {
    const empty = keys(ar).filter((k) => {
      const v = k.split(".").reduce<unknown>((o, p) => (o as Record<string, unknown>)[p], ar);
      return typeof v === "string" && v.trim() === "";
    });
    expect(empty).toEqual([]);
  });
});
