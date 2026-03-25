import { describe, expect, test } from "bun:test";
import wordCounter from "../src/wc";

describe("char mode", () => {
  test("counts grapheme clusters when non-words are enabled", () => {
    const result = wordCounter("Hi 👋, world!", {
      mode: "char",
      nonWords: true,
    });
    expect(result.breakdown.mode).toBe("char");
    expect(result.total).toBe(10);
  });

  test("excludes non-words when disabled", () => {
    const result = wordCounter("Hi 👋, world!", {
      mode: "char",
    });
    expect(result.breakdown.mode).toBe("char");
    expect(result.total).toBe(7);
  });

  test("normalizes mode aliases", () => {
    const result = wordCounter("Hi", { mode: "chars" as unknown as "char" });
    expect(result.breakdown.mode).toBe("char");
  });
});

describe("char-collector mode", () => {
  test("aggregates character counts by locale order of first appearance", () => {
    const result = wordCounter("Hi 世界 hi", {
      mode: "char-collector",
    });
    expect(result.breakdown.mode).toBe("char-collector");
    expect(result.total).toBe(6);
    if (result.breakdown.mode === "char-collector") {
      expect(result.breakdown.items).toEqual([
        { locale: "und-Latn", chars: 4, nonWords: undefined },
        { locale: "und-Hani", chars: 2, nonWords: undefined },
      ]);
    }
  });

  test("aggregates non-word counts per locale when enabled", () => {
    const result = wordCounter("Hi, 世界!", {
      mode: "char-collector",
      nonWords: true,
    });
    expect(result.breakdown.mode).toBe("char-collector");
    expect(result.counts).toEqual({ words: 4, nonWords: 2, total: 6 });
    if (result.breakdown.mode === "char-collector") {
      expect(result.breakdown.items[0]?.locale).toBe("und-Latn");
      expect(result.breakdown.items[0]?.chars).toBe(3);
      expect(result.breakdown.items[0]?.nonWords?.counts.punctuation).toBe(1);
      expect(result.breakdown.items[1]?.locale).toBe("und-Hani");
      expect(result.breakdown.items[1]?.chars).toBe(3);
      expect(result.breakdown.items[1]?.nonWords?.counts.punctuation).toBe(1);
    }
  });

  test("normalizes alias matrix to char-collector", () => {
    const aliases = [
      "char-collector",
      "charcollector",
      "char-collect",
      "collector-char",
      "characters-collector",
      "colchar",
      "charcol",
      "char-col",
      "char-colle",
    ] as const;

    for (const mode of aliases) {
      const result = wordCounter("Hi", { mode: mode as unknown as "char" });
      expect(result.breakdown.mode).toBe("char-collector");
    }
  });
});
