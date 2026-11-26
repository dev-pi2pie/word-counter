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

  test.each([
    ["Don't stop", 2],
    ["they’re", 1],
    ["3.14 is pi", 3],
  ])("counts words in %s", (input, expected) => {
    expect(wordCounter(input).total).toBe(expected);
  });

  test("collects standalone punctuation and keycap emoji separately from words", () => {
    const result = wordCounter("Don't stop! they’re, 3.14 1️⃣", {
      mode: "segments",
      nonWords: true,
    });
    expect(result.counts).toEqual({ words: 4, nonWords: 3, total: 7 });
    const { breakdown } = result;
    if (breakdown.mode !== "segments") {
      throw new Error("Expected segments breakdown");
    }
    const { items } = breakdown;
    expect(items.flatMap((item) => item.segments)).toEqual(["Don't", "stop", "they’re", "3.14"]);
    expect(items.flatMap((item) => item.nonWords?.punctuation ?? [])).toEqual(["!", ","]);
    expect(items.flatMap((item) => item.nonWords?.emoji ?? [])).toEqual(["1️⃣"]);
  });

  test("collects a standalone underscore run as one punctuation segment", () => {
    const { breakdown } = wordCounter("___", { mode: "segments", nonWords: true });
    if (breakdown.mode !== "segments") {
      throw new Error("Expected segments breakdown");
    }
    expect(breakdown.items.flatMap((item) => item.nonWords?.punctuation ?? [])).toEqual(["___"]);
    expect(breakdown.items.flatMap((item) => item.segments)).toEqual([]);
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

describe("wordCounter segment classification", () => {
  function collectSegments(input: string) {
    const { breakdown, counts } = wordCounter(input, { mode: "segments", nonWords: true });
    if (breakdown.mode !== "segments") {
      throw new Error("Expected segments breakdown");
    }
    const { items } = breakdown;
    return {
      counts,
      locales: items.map((item) => item.locale),
      lists: {
        words: items.flatMap((item) => item.segments),
        punctuation: items.flatMap((item) => item.nonWords?.punctuation ?? []),
        symbols: items.flatMap((item) => item.nonWords?.symbols ?? []),
        emoji: items.flatMap((item) => item.nonWords?.emoji ?? []),
      },
    };
  }

  test("collects words and non-words in source order across locale chunks", () => {
    const input = "they’re 3.14 ___ © ©️ 1️⃣ 世界。";
    const { lists, counts } = collectSegments(input);
    expect(wordCounter(input).total).toBe(3);
    expect(counts).toEqual({ words: 3, nonWords: 5, total: 8 });
    expect(lists).toEqual({
      words: ["they’re", "3.14", "世界"],
      punctuation: ["___", "。"],
      symbols: ["©"],
      emoji: ["©️", "1️⃣"],
    });
  });

  test.each([
    ["1️⃣2", "emoji"],
    ["#️⃣", "emoji"],
    ["aⓑc", "symbols"],
    ["_ⓑ_", "symbols"],
    ["!\uFF9E", "punctuation"],
    ["٫", "punctuation"],
    ["١٫٢", "words"],
    ["׳", "punctuation"],
    ["ג׳", "words"],
    ["゠", "punctuation"],
    ["ア゠イ", "words"],
    ["foo_bar", "words"],
    ["_\u0301_", "punctuation"],
    ["_\u200d_", "punctuation"],
  ])("collects %s intact in %s only", (input, category) => {
    const { lists, counts } = collectSegments(input);
    expect(lists).toEqual({
      words: [],
      punctuation: [],
      symbols: [],
      emoji: [],
      [category]: [input],
    });
    expect(counts?.words).toBe(category === "words" ? 1 : 0);
  });

  test("keeps Han words and punctuation in one chunk", () => {
    const { locales, lists } = collectSegments("你好，世界。");
    expect(locales).toEqual(["und-Hani"]);
    expect(lists).toEqual({
      words: ["你好", "世界"],
      punctuation: ["，", "。"],
      symbols: [],
      emoji: [],
    });
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
