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

describe("segmentTextByLocale", () => {
  test("splits Latin and Han scripts into separate locales", () => {
    const chunks = segmentTextByLocale("Hello 世界");
    const locales = chunks.map((chunk) => chunk.locale);
    expect(locales).toEqual(["und-Latn", "und-Hani"]);
  });

  test("applies Latin locale hints for ambiguous text", () => {
    const chunks = segmentTextByLocale("Hello world", { latinLocaleHint: "en" });
    expect(chunks[0]?.locale).toBe("en");
  });

  test("prefers Latin tag hint over other Latin hint aliases", () => {
    const chunks = segmentTextByLocale("Hello world", {
      latinLocaleHint: "en",
      latinLanguageHint: "fr",
      latinTagHint: "de",
    });
    expect(chunks[0]?.locale).toBe("de");
  });

  test("treats empty Latin tag hint as missing and falls back to Latin language hint", () => {
    const chunks = segmentTextByLocale("Hello world", {
      latinLocaleHint: "en",
      latinLanguageHint: "fr",
      latinTagHint: "",
    });
    expect(chunks[0]?.locale).toBe("fr");
  });

  test("uses Han tag hint when provided", () => {
    const chunks = segmentTextByLocale("漢字測試", { hanTagHint: "zh-Hant" });
    expect(chunks[0]?.locale).toBe("zh-Hant");
  });

  test("uses Han tag hint for Simplified Chinese when provided", () => {
    const chunks = segmentTextByLocale("汉字测试", { hanTagHint: "zh-Hans" });
    expect(chunks[0]?.locale).toBe("zh-Hans");
  });

  test("treats empty Han tag hint as missing and uses fallback", () => {
    const chunks = segmentTextByLocale("漢字測試", { hanTagHint: "" });
    expect(chunks[0]?.locale).toBe("und-Hani");
  });

  test("falls back to Han language hint when Han tag hint is empty", () => {
    const chunks = segmentTextByLocale("漢字測試", {
      hanTagHint: "",
      hanLanguageHint: "zh-Hant",
    });
    expect(chunks[0]?.locale).toBe("zh-Hant");
  });

  test("uses diacritics to hint Latin language buckets", () => {
    const samples: Array<[string, string]> = [
      ["Über", "de"],
      ["mañana", "es"],
      ["coração", "pt"],
      ["œuvre", "fr"],
      ["Zażółć", "pl"],
      ["Iğdır", "tr"],
      ["Știință", "ro"],
      ["Őrült", "hu"],
      ["Þing", "is"],
    ];

    for (const [text, locale] of samples) {
      const chunks = segmentTextByLocale(text);
      expect(chunks[0]?.locale).toBe(locale);
    }
  });

  test("accepts custom Latin hint rules from string and RegExp patterns", () => {
    const fromStringPattern = segmentTextByLocale("Zażółć gęślą jaźń", {
      latinHintRules: [{ tag: "pl", pattern: "[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]" }],
    });
    expect(fromStringPattern[0]?.locale).toBe("pl");

    const fromRegexPattern = segmentTextByLocale("İstanbul", {
      latinHintRules: [{ tag: "tr", pattern: /[İIıi]/u }],
    });
    expect(fromRegexPattern[0]?.locale).toBe("tr");
  });

  test("uses priority and stable rule order for custom Latin hints", () => {
    const byPriority = segmentTextByLocale("ñ", {
      latinHintRules: [
        { tag: "es", pattern: "[ñÑ]", priority: 1 },
        { tag: "x-priority", pattern: "[ñÑ]", priority: 2 },
      ],
    });
    expect(byPriority[0]?.locale).toBe("x-priority");

    const byDefinitionOrder = segmentTextByLocale("ñ", {
      latinHintRules: [
        { tag: "first", pattern: "[ñÑ]" },
        { tag: "second", pattern: "[ñÑ]" },
      ],
    });
    expect(byDefinitionOrder[0]?.locale).toBe("first");
  });

  test("keeps Latin fallback chain when custom rules do not match", () => {
    const chunks = segmentTextByLocale("Hello world", {
      latinHintRules: [{ tag: "pl", pattern: "[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]" }],
      latinTagHint: "en",
    });
    expect(chunks[0]?.locale).toBe("en");
  });

  test("supports disabling default Latin hints", () => {
    const withDefaults = segmentTextByLocale("Über");
    expect(withDefaults[0]?.locale).toBe("de");

    const withoutDefaults = segmentTextByLocale("Über", {
      useDefaultLatinHints: false,
    });
    expect(withoutDefaults[0]?.locale).toBe("und-Latn");
  });

  test("fails fast on invalid custom Latin hint patterns", () => {
    expect(() =>
      segmentTextByLocale("Hello world", {
        latinHintRules: [{ tag: "x-invalid", pattern: "[" }],
      }),
    ).toThrow("invalid Unicode regex pattern");
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

  test("keeps standalone collector aliases mapped to collector", () => {
    const result = wordCounter("Hi", { mode: "collect" as unknown as "collector" });
    expect(result.breakdown.mode).toBe("collector");
  });
});

describe("collector mode with non-words", () => {
  test("aggregates non-words into a locale-neutral bucket", () => {
    const result = wordCounter("© 👋!", {
      mode: "collector",
      nonWords: true,
    });
    expect(result.breakdown.mode).toBe("collector");
    if (result.breakdown.mode === "collector") {
      expect(result.breakdown.nonWords?.counts.emoji).toBe(1);
      expect(result.breakdown.nonWords?.counts.symbols).toBe(1);
      expect(result.breakdown.nonWords?.counts.punctuation).toBe(1);
    }
  });

  test("treats emoji presentation as emoji even for text-default symbols", () => {
    const result = wordCounter("©️", {
      mode: "collector",
      nonWords: true,
    });
    expect(result.breakdown.mode).toBe("collector");
    if (result.breakdown.mode === "collector") {
      expect(result.breakdown.nonWords?.counts.emoji).toBe(1);
      expect(result.breakdown.nonWords?.counts.symbols).toBe(0);
      expect(result.breakdown.nonWords?.counts.punctuation).toBe(0);
    }
  });
});
