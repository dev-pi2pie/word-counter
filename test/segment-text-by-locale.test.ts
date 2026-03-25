import { describe, expect, test } from "bun:test";
import wordCounter, {
  DEFAULT_LATIN_HINT_RULES,
  segmentTextByLocale,
} from "../src/wc";

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

  test("does not relabel prior Latin text when a later Latin hint appears", () => {
    const chunks = segmentTextByLocale("A lot of things should be done. Überzug and Ranger");
    expect(chunks.map((chunk) => chunk.locale)).toEqual(["und-Latn", "de"]);
    expect(chunks[0]?.text).toBe("A lot of things should be done. ");
    expect(chunks[1]?.text).toBe("Überzug and Ranger");
  });

  test("keeps hinted Latin words intact after whitespace boundary", () => {
    const chunks = segmentTextByLocale("el niño");
    expect(chunks.map((chunk) => chunk.locale)).toEqual(["und-Latn", "es"]);
    expect(chunks[0]?.text).toBe("el ");
    expect(chunks[1]?.text).toBe("niño");
  });

  test("resets carried Latin locale after hard boundaries", () => {
    const chunks = segmentTextByLocale("Überzug and Ranger.\nAnother paragraph in English.");
    expect(chunks.map((chunk) => chunk.locale)).toEqual(["de", "und-Latn"]);
  });

  test("resets carried Latin locale after fullwidth and halfwidth periods", () => {
    const samples = ["Überzug。Another paragraph", "Überzug｡Another paragraph", "Überzug．Another paragraph"];
    for (const text of samples) {
      const chunks = segmentTextByLocale(text);
      expect(chunks.map((chunk) => chunk.locale)).toEqual(["de", "und-Latn"]);
    }
  });

  test("resets carried Latin locale after comma, colon, and semicolon boundaries", () => {
    const samples = [
      "Überzug,Another paragraph",
      "Überzug，Another paragraph",
      "Überzug、Another paragraph",
      "Überzug､Another paragraph",
      "Überzug:Another paragraph",
      "Überzug：Another paragraph",
      "Überzug;Another paragraph",
      "Überzug；Another paragraph",
    ];
    for (const text of samples) {
      const chunks = segmentTextByLocale(text);
      expect(chunks.map((chunk) => chunk.locale)).toEqual(["de", "und-Latn"]);
    }
  });

  test("does not carry ja locale into Han after fullwidth period boundary", () => {
    const chunks = segmentTextByLocale("こんにちは。漢字");
    expect(chunks.map((chunk) => chunk.locale)).toEqual(["ja", "und-Hani"]);
    expect(chunks[0]?.text).toBe("こんにちは。");
    expect(chunks[1]?.text).toBe("漢字");
  });

  test("does not carry ja locale into Han after halfwidth period boundary", () => {
    const chunks = segmentTextByLocale("こんにちは｡漢字");
    expect(chunks.map((chunk) => chunk.locale)).toEqual(["ja", "und-Hani"]);
    expect(chunks[0]?.text).toBe("こんにちは｡");
    expect(chunks[1]?.text).toBe("漢字");
  });

  test("does not carry ja locale into Han after newline boundary", () => {
    const chunks = segmentTextByLocale("こんにちは\n漢字");
    expect(chunks.map((chunk) => chunk.locale)).toEqual(["ja", "und-Hani"]);
    expect(chunks[0]?.text).toBe("こんにちは\n");
    expect(chunks[1]?.text).toBe("漢字");
  });

  test("does not carry ja locale into Han after comma, colon, and semicolon boundaries", () => {
    const samples = [
      "こんにちは,漢字",
      "こんにちは，漢字",
      "こんにちは、漢字",
      "こんにちは､漢字",
      "こんにちは:漢字",
      "こんにちは：漢字",
      "こんにちは;漢字",
      "こんにちは；漢字",
    ];
    for (const text of samples) {
      const chunks = segmentTextByLocale(text);
      expect(chunks.map((chunk) => chunk.locale)).toEqual(["ja", "und-Hani"]);
    }
  });

  test("exports immutable default Latin hint rules", () => {
    expect(() => {
      (
        DEFAULT_LATIN_HINT_RULES as unknown as Array<{
          tag: string;
          pattern: string | RegExp;
          priority?: number;
        }>
      ).push({ tag: "x", pattern: /[x]/u });
    }).toThrow();

    const firstRule = DEFAULT_LATIN_HINT_RULES[0];
    expect(firstRule).toBeDefined();
    if (!firstRule) {
      return;
    }

    expect(() => {
      (firstRule as { tag: string }).tag = "x-mutated";
    }).toThrow();

    const germanRule = DEFAULT_LATIN_HINT_RULES.find((rule) => rule.tag === "de");
    expect(germanRule).toBeDefined();
    if (!germanRule) {
      return;
    }
    expect(typeof germanRule.pattern).toBe("string");
    expect(segmentTextByLocale("Über")[0]?.locale).toBe("de");
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

  test("preserves RegExp flags for custom Latin hint rules", () => {
    const caseInsensitive = segmentTextByLocale("Ä", {
      latinHintRules: [{ tag: "x", pattern: /[ä]/iu }],
      useDefaultLatinHints: false,
    });
    expect(caseInsensitive[0]?.locale).toBe("x");
  });

  test("accepts Unicode-set v flag RegExp rules when runtime supports them", () => {
    let unicodeSetPattern: RegExp;
    try {
      unicodeSetPattern = new RegExp("[ä]", "v");
    } catch {
      return;
    }

    const unicodeSetRule = segmentTextByLocale("ä", {
      latinHintRules: [{ tag: "x-v-flag", pattern: unicodeSetPattern }],
      useDefaultLatinHints: false,
    });
    expect(unicodeSetRule[0]?.locale).toBe("x-v-flag");
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

  test("keeps root wordCounter collector aliases unchanged", () => {
    const result = wordCounter("Hi", { mode: "collect" as unknown as "collector" });
    expect(result.breakdown.mode).toBe("collector");
  });
});
