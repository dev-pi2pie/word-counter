import { describe, expect, test } from "bun:test";
import wordCounter, { countCharsForLocale, countWordsForLocale } from "../src/wc";

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
    if (firstItem && "segments" in firstItem) {
      expect(firstItem.segments.length).toBe(2);
    }
  });

  test("counts words with emoji and punctuation", () => {
    expect(wordCounter("Hi 👋 world").total).toBe(2);
    expect(countWordsForLocale("Hello, world!", "en")).toBe(2);
  });

  test("collects non-word categories when enabled", () => {
    const result = wordCounter("Hi 👋, world! 1️⃣", {
      nonWords: true,
    });
    const first = result.breakdown.items[0];
    if (first && "nonWords" in first) {
      expect(first.nonWords?.counts.emoji).toBe(2);
      expect(first.nonWords?.counts.symbols).toBe(0);
      expect(first.nonWords?.counts.punctuation).toBe(2);
    }
    expect(result.total).toBe(6);
    expect(result.counts).toEqual({ words: 2, nonWords: 4, total: 6 });
  });

  test("does not include non-words when disabled", () => {
    const result = wordCounter("Hi 👋, world!");
    const first = result.breakdown.items[0];
    expect(first && "nonWords" in first ? first.nonWords : undefined).toBeUndefined();
    expect(result.total).toBe(2);
    expect(result.counts).toBeUndefined();
  });

  test("excludes whitespace from totals when includeWhitespace is false", () => {
    const result = wordCounter("Hi \tthere\n", {
      nonWords: true,
    });
    const first = result.breakdown.items[0];
    const whitespaceCount =
      first && "nonWords" in first ? (first.nonWords?.counts.whitespace ?? 0) : 0;
    expect(whitespaceCount).toBe(0);
    expect(result.counts).toEqual({ words: 2, nonWords: 0, total: 2 });
  });

  test("includes whitespace in totals when includeWhitespace is true", () => {
    const result = wordCounter("Hi \tthere\n", {
      nonWords: true,
      includeWhitespace: true,
    });
    const first = result.breakdown.items[0];
    if (first && "nonWords" in first) {
      expect(first.nonWords?.whitespace).toEqual({
        spaces: 1,
        tabs: 1,
        newlines: 1,
        other: 0,
      });
      expect(first.nonWords?.counts.whitespace).toBe(3);
    }
    expect(result.counts).toEqual({ words: 2, nonWords: 3, total: 5 });
  });
});

describe("countWordsForLocale", () => {
  test("counts words for a specific locale", () => {
    expect(countWordsForLocale("Hello world", "und-Latn")).toBe(2);
  });

  test("handles apostrophes and URLs", () => {
    expect(countWordsForLocale("Don't stop", "en")).toBe(2);
    expect(countWordsForLocale("Visit https://example.com today", "en")).toBe(4);
  });
});

describe("countCharsForLocale", () => {
  test("counts grapheme clusters for emoji sequences", () => {
    expect(countCharsForLocale("👩‍👩‍👧‍👦", "en")).toBe(1);
    expect(countCharsForLocale("🇺🇸", "en")).toBe(1);
    expect(countCharsForLocale("⭐️", "en")).toBe(1);
  });

  test("counts combining marks as single graphemes", () => {
    expect(countCharsForLocale("e\u0301", "en")).toBe(1);
  });
});
