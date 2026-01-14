import { describe, expect, test } from "bun:test";
import wordCounter, { countWordsForLocale, segmentTextByLocale } from "../src/wc";

describe("wordCounter", () => {
  test("counts Latin words in chunk mode by default", () => {
    const result = wordCounter("Hello world");
    expect(result.total).toBe(2);
    expect(result.breakdown.mode).toBe("chunk");
    expect(result.breakdown.items[0]?.locale).toBe("und-Latn");
  });

  test("returns segments breakdown when requested", () => {
    const result = wordCounter("Hello world", { mode: "segments" });
    expect(result.breakdown.mode).toBe("segments");
    const firstItem = result.breakdown.items[0];
    if (firstItem && 'segments' in firstItem) {
      expect(firstItem.segments.length).toBe(2);
    }
  });
});

describe("segmentTextByLocale", () => {
  test("splits Latin and Han scripts into separate locales", () => {
    const chunks = segmentTextByLocale("Hello 世界");
    const locales = chunks.map((chunk) => chunk.locale);
    expect(locales).toEqual(["und-Latn", "zh-Hans"]);
  });

  test("uses diacritics to hint Latin language buckets", () => {
    const samples: Array<[string, string]> = [
      ["Über", "de"],
      ["mañana", "es"],
      ["coração", "pt"],
      ["œuvre", "fr"],
    ];

    for (const [text, locale] of samples) {
      const chunks = segmentTextByLocale(text);
      expect(chunks[0]?.locale).toBe(locale);
    }
  });
});

describe("countWordsForLocale", () => {
  test("counts words for a specific locale", () => {
    expect(countWordsForLocale("Hello world", "und-Latn")).toBe(2);
  });
});
