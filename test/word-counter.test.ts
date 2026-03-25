import { describe, expect, test } from "bun:test";
import wordCounter, {
  DEFAULT_LATIN_HINT_RULES,
  countCharsForLocale,
  countWordsForLocale,
  segmentTextByLocale,
} from "../src/wc";
import {
  countSectionsWithDetector,
  segmentTextByLocaleWithDetector,
  wordCounterWithDetector,
} from "../src/detector";
import { hasWasmDetectorRuntime } from "./support/wasm-detector-runtime";

const WASM_LATIN_QUALITY_FIXTURES = [
  {
    id: "latin-prose-en-paragraph",
    text: "This sentence should clearly be detected as English for the wasm detector path.",
    expectedLocale: "en",
  },
  {
    id: "latin-prose-fr-paragraph",
    text: "Ceci est une phrase francaise suffisamment longue pour que le detecteur identifie correctement la langue.",
    expectedLocale: "fr",
  },
  {
    id: "latin-prose-en-short-reliable-line",
    text: "The repository documentation explains expected behavior.",
    expectedLocale: "en",
  },
  {
    id: "latin-prose-fr-short-reliable-line",
    text: "Cette documentation explique clairement le comportement attendu.",
    expectedLocale: "fr",
  },
  {
    id: "latin-prose-en-multiline-without-punctuation",
    text: [
      "Internationalization requires thoughtful language detection",
      "Repository documentation explains expected behavior",
    ].join("\n"),
    expectedLocale: "en",
  },
  {
    id: "latin-prose-en-hard-wrapped-short-lines",
    text: [
      "This guide explains",
      "expected behavior clearly",
      "for detector quality",
      "checks in docs",
    ].join("\n"),
    expectedLocale: "en",
  },
  {
    id: "latin-tech-cli-help",
    text: [
      "Usage: word-counter --path docs --format json --debug",
      "",
      "Options:",
      "  --debug enable structured diagnostics",
      "  --debug-report [path] write diagnostics to a report file",
      "  --debug-tee mirror diagnostics to stderr",
    ].join("\n"),
    expectedLocale: "und-Latn",
  },
  {
    id: "latin-tech-readme-commands",
    text: [
      "`bun install`",
      "`bun test`",
      "`word-counter --path docs --format json`",
      "`word-counter --debug-report report.jsonl --debug-tee`",
    ].join("\n"),
    expectedLocale: "und-Latn",
  },
  {
    id: "latin-mixed-frontmatter-short-prose",
    text: [
      "---",
      "title: Alpha Story",
      "summary: Intro note",
      "---",
      "Hello world from alpha. This guide explains the feature clearly for readers.",
    ].join("\n"),
    expectedLocale: "en",
  },
  {
    id: "latin-mixed-prose-then-command-block",
    text: [
      "This guide explains how to count words in a repository without changing the default output behavior.",
      "```sh",
      "word-counter --path docs --format json",
      "```",
    ].join("\n"),
    expectedLocale: "en",
  },
  {
    id: "latin-mixed-bullets-with-sentences",
    text: [
      "- This option keeps normal JSON output stable for downstream consumers.",
      "- This command writes detailed diagnostics only when debug mode is enabled.",
    ].join("\n"),
    expectedLocale: "en",
  },
  {
    id: "latin-mixed-config-heavy-with-brief-explanation",
    text: [
      "mode: debug",
      "verbosity: compact",
      "report_path: diagnostics.jsonl",
      "tee: true",
      "Use this for local testing.",
    ].join("\n"),
    expectedLocale: "und-Latn",
  },
] as const;

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

describe("detector entrypoint", () => {
  test("uses regex detector mode by default", async () => {
    const result = await wordCounterWithDetector("Hello world");

    expect(result.total).toBe(2);
  });

  test("supports explicit regex detector mode", async () => {
    const result = await wordCounterWithDetector("Hello world", { detector: "regex" });

    expect(result.total).toBe(2);
  });

  test("keeps short ambiguous Latin chunks on und-Latn in wasm mode", async () => {
    const result = await wordCounterWithDetector("Hello world", { detector: "wasm" });

    expect(result.breakdown.mode).toBe("chunk");
    expect(result.breakdown.items[0]?.locale).toBe("und-Latn");
  });

  test("promotes long ambiguous Latin chunks in wasm mode", async () => {
    if (!hasWasmDetectorRuntime()) {
      return;
    }

    const result = await wordCounterWithDetector(
      "This sentence should clearly be detected as English for the wasm detector path.",
      { detector: "wasm" },
    );

    expect(result.breakdown.mode).toBe("chunk");
    expect(result.breakdown.items[0]?.locale).toBe("en");
  });

  test("promotes corroborated markdown-like Latin text in wasm mode", async () => {
    if (!hasWasmDetectorRuntime()) {
      return;
    }

    const result = await wordCounterWithDetector(
      [
        "---",
        "title: Alpha Story",
        "summary: Intro note",
        "---",
        "Hello world from alpha. This guide explains the feature clearly for readers.",
      ].join("\n"),
      { detector: "wasm" },
    );

    expect(result.breakdown.mode).toBe("chunk");
    expect(result.breakdown.items[0]?.locale).toBe("en");
  });

  for (const fixture of WASM_LATIN_QUALITY_FIXTURES) {
    test(`applies approved Latin quality policy for ${fixture.id}`, async () => {
      if (!hasWasmDetectorRuntime()) {
        return;
      }

      const result = await wordCounterWithDetector(fixture.text, { detector: "wasm" });
      expect(result.breakdown.mode).toBe("chunk");
      expect(result.breakdown.items[0]?.locale).toBe(fixture.expectedLocale);
    });
  }

  test("keeps low-confidence short English-like text on und-Latn in wasm mode", async () => {
    if (!hasWasmDetectorRuntime()) {
      return;
    }

    const result = await wordCounterWithDetector("Plain text file for batch counting.", {
      detector: "wasm",
    });

    expect(result.breakdown.mode).toBe("chunk");
    expect(result.breakdown.items[0]?.locale).toBe("und-Latn");
  });

  test("does not let latinTagHint suppress detector-derived locales in wasm mode", async () => {
    if (!hasWasmDetectorRuntime()) {
      return;
    }

    const sample =
      "Ceci est une phrase francaise suffisamment longue pour que le detecteur identifie correctement la langue.";
    const baseline = await wordCounterWithDetector(sample, { detector: "wasm" });
    const hinted = await wordCounterWithDetector(sample, {
      detector: "wasm",
      latinTagHint: "en",
    });

    expect(baseline.breakdown.mode).toBe("chunk");
    expect(hinted.breakdown.mode).toBe("chunk");
    expect(baseline.breakdown.items[0]?.locale).toBe("fr");
    expect(hinted.breakdown.items[0]?.locale).toBe("fr");
    expect(hinted.total).toBe(baseline.total);
  });

  test("reapplies latinTagHint after unresolved wasm detector evaluation", async () => {
    const chunks = await segmentTextByLocaleWithDetector("Hello world", {
      detector: "wasm",
      latinTagHint: "en",
    });

    expect(chunks.map((chunk) => chunk.locale)).toEqual(["en"]);
  });

  test("preserves explicit Latin hint precedence after unresolved wasm detector evaluation", async () => {
    const chunks = await segmentTextByLocaleWithDetector("Hello world", {
      detector: "wasm",
      latinLocaleHint: "en",
      latinLanguageHint: "fr",
      latinTagHint: "de",
    });

    expect(chunks.map((chunk) => chunk.locale)).toEqual(["de"]);
  });

  test("reapplies built-in Latin hint rules after unresolved wasm detector evaluation", async () => {
    const chunks = await segmentTextByLocaleWithDetector("el niño", {
      detector: "wasm",
    });

    expect(chunks.map((chunk) => chunk.locale)).toEqual(["und-Latn", "es"]);
    expect(chunks.map((chunk) => chunk.text)).toEqual(["el ", "niño"]);
  });

  test("preserves built-in Latin hint rules inside accepted wasm detector windows", async () => {
    if (!hasWasmDetectorRuntime()) {
      return;
    }

    const chunks = await segmentTextByLocaleWithDetector(
      [
        "This guide explains the feature clearly for readers and keeps the paragraph long enough for reliable English detection.",
        "It also includes a borrowed word niño inside the same detector window to check hint preservation.",
      ].join(" "),
      { detector: "wasm" },
    );

    expect(chunks.map((chunk) => chunk.locale)).toEqual(["en", "es"]);
    expect(chunks[0]?.text).toContain("borrowed word ");
    expect(chunks[1]?.text).toBe("niño inside the same detector window to check hint preservation.");
  });

  test("reapplies custom Latin hint rules after unresolved wasm detector evaluation", async () => {
    const chunks = await segmentTextByLocaleWithDetector("Zażółć gęślą jaźń", {
      detector: "wasm",
      latinHintRules: [{ tag: "pl", pattern: "[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]" }],
      useDefaultLatinHints: false,
    });

    expect(chunks.map((chunk) => chunk.locale)).toEqual(["pl"]);
  });

  test("preserves custom Latin hint rules inside accepted wasm detector windows", async () => {
    if (!hasWasmDetectorRuntime()) {
      return;
    }

    const chunks = await segmentTextByLocaleWithDetector(
      [
        "This guide explains the feature clearly for readers and keeps the paragraph long enough for reliable English detection.",
        "A custom hinted term Zażółć should remain Polish inside the accepted detector window.",
      ].join(" "),
      {
        detector: "wasm",
        latinHintRules: [{ tag: "pl", pattern: "[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]" }],
        useDefaultLatinHints: false,
      },
    );

    expect(chunks.map((chunk) => chunk.locale)).toEqual(["en", "pl"]);
    expect(chunks[1]?.text).toBe(
      "Zażółć should remain Polish inside the accepted detector window.",
    );
  });

  test("borrows adjacent Japanese context for mixed und-Hani wasm windows", async () => {
    if (!hasWasmDetectorRuntime()) {
      return;
    }

    const chunks = await segmentTextByLocaleWithDetector("こんにちは、世界！これはテストです。", {
      detector: "wasm",
    });

    expect(chunks.map((chunk) => chunk.locale)).toEqual(["ja"]);
    expect(chunks[0]?.text).toBe("こんにちは、世界！これはテストです。");
  });

  test("borrows one-sided Japanese context for mixed und-Hani wasm windows", async () => {
    if (!hasWasmDetectorRuntime()) {
      return;
    }

    const chunks = await segmentTextByLocaleWithDetector("こんにちは、世界！", {
      detector: "wasm",
    });

    expect(chunks.map((chunk) => chunk.locale)).toEqual(["ja", "und-Hani"]);
    expect(chunks[0]?.text).toBe("こんにちは、");
    expect(chunks[1]?.text).toBe("世界！");
  });

  test("does not borrow Japanese context across a competing Latin chunk", async () => {
    if (!hasWasmDetectorRuntime()) {
      return;
    }

    const chunks = await segmentTextByLocaleWithDetector("こんにちは Hello 世界", {
      detector: "wasm",
    });

    expect(chunks.map((chunk) => chunk.locale)).toEqual(["ja", "und-Latn", "und-Hani"]);
    expect(chunks[2]?.text).toBe("世界");
  });

  test("segments text through detector entrypoint", async () => {
    const chunks = await segmentTextByLocaleWithDetector("Hello 世界", { detector: "regex" });

    expect(chunks.map((chunk) => chunk.locale)).toEqual(["und-Latn", "und-Hani"]);
  });

  test("counts sections through detector entrypoint", async () => {
    const result = await countSectionsWithDetector("Hello world", "all", { detector: "regex" });

    expect(result.total).toBe(2);
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
