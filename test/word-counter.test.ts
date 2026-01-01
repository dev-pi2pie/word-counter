import { describe, expect, test } from "bun:test";
import wordCounter, { countWordsForLocale, segmentTextByLocale } from "../src/wc";

describe("wordCounter", () => {
  test("counts English words in chunk mode by default", () => {
    const result = wordCounter("Hello world");
    expect(result.total).toBe(2);
    expect(result.breakdown.mode).toBe("chunk");
    expect(result.breakdown.items[0]?.locale).toBe("en-US");
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
    expect(locales).toEqual(["en-US", "zh-Hans"]);
  });
});

describe("countWordsForLocale", () => {
  test("counts words for a specific locale", () => {
    expect(countWordsForLocale("Hello world", "en-US")).toBe(2);
  });
});
