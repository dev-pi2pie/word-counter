import { describe, expect, test } from "bun:test";
import wordCounter, {
  countCharsForLocale,
  countWordsForLocale,
  segmentTextByLocale,
} from "../src/wc";

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

  test("counts words with emoji and punctuation", () => {
    expect(wordCounter("Hi 👋 world").total).toBe(2);
    expect(countWordsForLocale("Hello, world!", "en")).toBe(2);
  });

  test("collects non-word categories when enabled", () => {
    const result = wordCounter("Hi 👋, world! 1️⃣", {
      nonWords: true,
    });
    const first = result.breakdown.items[0];
    expect(first?.nonWords?.counts.emoji).toBe(2);
    expect(first?.nonWords?.counts.symbols).toBe(0);
    expect(first?.nonWords?.counts.punctuation).toBe(2);
    expect(result.total).toBe(6);
  });

  test("does not include non-words when disabled", () => {
    const result = wordCounter("Hi 👋, world!");
    const first = result.breakdown.items[0];
    expect(first && "nonWords" in first ? first.nonWords : undefined).toBeUndefined();
    expect(result.total).toBe(2);
  });
});

describe("segmentTextByLocale", () => {
  test("splits Latin and Han scripts into separate locales", () => {
    const chunks = segmentTextByLocale("Hello 世界");
    const locales = chunks.map((chunk) => chunk.locale);
    expect(locales).toEqual(["und-Latn", "zh-Hans"]);
  });

  test("applies Latin locale hints for ambiguous text", () => {
    const chunks = segmentTextByLocale("Hello world", { latinLocaleHint: "en" });
    expect(chunks[0]?.locale).toBe("en");
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

  test("keeps leading neutral characters with the first script run", () => {
    const chunks = segmentTextByLocale("🙂こんにちは");
    expect(chunks[0]?.locale).toBe("ja");
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

describe("collector mode with non-words", () => {
  test("aggregates non-words into a locale-neutral bucket", () => {
    const result = wordCounter("© 👋!", {
      mode: "collector",
      nonWords: true,
    });
    expect(result.breakdown.mode).toBe("collector");
    expect(result.breakdown.nonWords?.counts.emoji).toBe(1);
    expect(result.breakdown.nonWords?.counts.symbols).toBe(1);
    expect(result.breakdown.nonWords?.counts.punctuation).toBe(1);
  });

  test("treats emoji presentation as emoji even for text-default symbols", () => {
    const result = wordCounter("©️", {
      mode: "collector",
      nonWords: true,
    });
    expect(result.breakdown.mode).toBe("collector");
    expect(result.breakdown.nonWords?.counts.emoji).toBe(1);
    expect(result.breakdown.nonWords?.counts.symbols).toBe(0);
    expect(result.breakdown.nonWords?.counts.punctuation).toBe(0);
  });
});
