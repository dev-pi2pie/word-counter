import { describe, expect, test } from "bun:test";
import {
  countSectionsWithDetector,
  segmentTextByLocaleWithDetector,
  wordCounterWithDetector,
} from "../src/detector";
import { hasWasmDetectorRuntime } from "./support/wasm-detector-runtime";
import { WASM_LATIN_QUALITY_FIXTURES } from "./support/word-counter-fixtures";

describe("detector entrypoint", () => {
  test("uses regex detector mode by default", async () => {
    const result = await wordCounterWithDetector("Hello world");

    expect(result.total).toBe(2);
  });

  test("supports explicit regex detector mode", async () => {
    const result = await wordCounterWithDetector("Hello world", { detector: "regex" });

    expect(result.total).toBe(2);
  });

  test("accepts content gate options across detector subpath runtime entrypoints", async () => {
    const countResult = await wordCounterWithDetector("Hello world", {
      detector: "regex",
      contentGate: { mode: "off" },
    });
    const chunks = await segmentTextByLocaleWithDetector("Hello world", {
      detector: "regex",
      contentGate: { mode: "loose" },
    });
    const sections = await countSectionsWithDetector("Hello world", "all", {
      detector: "regex",
      contentGate: { mode: "strict" },
    });

    expect(countResult.total).toBe(2);
    expect(chunks.map((chunk) => chunk.locale)).toEqual(["und-Latn"]);
    expect(sections.total).toBe(2);
  });

  test("threads content gate mode through wasm detector subpath runtime execution", async () => {
    if (!hasWasmDetectorRuntime()) {
      return;
    }

    const sampleEvents: Array<Record<string, unknown>> = [];
    await wordCounterWithDetector("Internationalization documentation remains understandable.", {
      detector: "wasm",
      contentGate: { mode: "strict" },
      detectorDebug: {
        emit(event, details) {
          if (event === "detector.window.sample") {
            sampleEvents.push(details ?? {});
          }
        },
      },
    });

    expect(sampleEvents).toHaveLength(1);
    expect(sampleEvents[0]?.contentGate).toEqual({
      applied: true,
      passed: false,
      policy: "latinProse",
    });
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
    expect(chunks[1]?.text).toBe(
      "niño inside the same detector window to check hint preservation.",
    );
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
