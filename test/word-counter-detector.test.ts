import { describe, expect, test } from "bun:test";
import {
  countSectionsWithDetector,
  segmentTextByLocaleWithDetector,
  wordCounterWithDetector,
} from "../src/detector";
import { hasWasmDetectorRuntime } from "./support/wasm-detector-runtime";
import { WASM_LATIN_QUALITY_FIXTURES } from "./support/word-counter-fixtures";

describe("detector entrypoint", () => {
  const defaultEligibleStrictNotEligibleText = "Readers understand the feature.";
  const defaultNotEligibleLooseEligibleText = "Users understand this now.";
  const shortHaniText = "世界";
  const idiomLengthHaniText = "四字成語";
  const borrowedShortHaniText = "こんにちは、世界！";
  const borrowedLongHaniText = "こんにちは、世界！これはテストです。";

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
      mode: "strict",
    });
  });

  test("raises Latin eligibility thresholds for strict mode across detector subpath runtime entrypoints", async () => {
    if (!hasWasmDetectorRuntime()) {
      return;
    }

    const countEvents: Array<Record<string, unknown>> = [];
    const segmentEvents: Array<Record<string, unknown>> = [];
    const sectionEvents: Array<Record<string, unknown>> = [];

    await wordCounterWithDetector(defaultEligibleStrictNotEligibleText, {
      detector: "wasm",
      contentGate: { mode: "strict" },
      detectorDebug: {
        evidence: { verbosity: "compact", mode: "chunk", section: "all" },
        emit(event, details) {
          if (event === "detector.window.evidence") {
            countEvents.push(details ?? {});
          }
        },
      },
    });
    await segmentTextByLocaleWithDetector(defaultEligibleStrictNotEligibleText, {
      detector: "wasm",
      contentGate: { mode: "strict" },
      detectorDebug: {
        evidence: { verbosity: "compact", mode: "chunk", section: "all" },
        emit(event, details) {
          if (event === "detector.window.evidence") {
            segmentEvents.push(details ?? {});
          }
        },
      },
    });
    await countSectionsWithDetector(defaultEligibleStrictNotEligibleText, "all", {
      detector: "wasm",
      contentGate: { mode: "strict" },
      detectorDebug: {
        evidence: { verbosity: "compact", mode: "chunk", section: "all" },
        emit(event, details) {
          if (event === "detector.window.evidence") {
            sectionEvents.push(details ?? {});
          }
        },
      },
    });

    for (const evidence of [countEvents[0], segmentEvents[0], sectionEvents[0]]) {
      expect(evidence?.minScriptChars).toBe(30);
      expect(evidence?.eligible).toBe(false);
      expect(evidence?.contentGate).toEqual({
        applied: true,
        passed: false,
        policy: "latinProse",
        mode: "strict",
      });
      expect((evidence?.decision as Record<string, unknown> | undefined)?.fallbackReason).toBe(
        "notEligible",
      );
    }
  });

  test("lowers Latin eligibility thresholds for loose mode while keeping off on default thresholds", async () => {
    if (!hasWasmDetectorRuntime()) {
      return;
    }

    const defaultEvents: Array<Record<string, unknown>> = [];
    const looseCountEvents: Array<Record<string, unknown>> = [];
    const looseSegmentEvents: Array<Record<string, unknown>> = [];
    const looseSectionEvents: Array<Record<string, unknown>> = [];
    const offCountEvents: Array<Record<string, unknown>> = [];
    const offSegmentEvents: Array<Record<string, unknown>> = [];
    const offSectionEvents: Array<Record<string, unknown>> = [];

    await wordCounterWithDetector(defaultNotEligibleLooseEligibleText, {
      detector: "wasm",
      detectorDebug: {
        evidence: { verbosity: "compact", mode: "chunk", section: "all" },
        emit(event, details) {
          if (event === "detector.window.evidence") {
            defaultEvents.push(details ?? {});
          }
        },
      },
    });
    await wordCounterWithDetector(defaultNotEligibleLooseEligibleText, {
      detector: "wasm",
      contentGate: { mode: "loose" },
      detectorDebug: {
        evidence: { verbosity: "compact", mode: "chunk", section: "all" },
        emit(event, details) {
          if (event === "detector.window.evidence") {
            looseCountEvents.push(details ?? {});
          }
        },
      },
    });
    await segmentTextByLocaleWithDetector(defaultNotEligibleLooseEligibleText, {
      detector: "wasm",
      contentGate: { mode: "loose" },
      detectorDebug: {
        evidence: { verbosity: "compact", mode: "chunk", section: "all" },
        emit(event, details) {
          if (event === "detector.window.evidence") {
            looseSegmentEvents.push(details ?? {});
          }
        },
      },
    });
    await countSectionsWithDetector(defaultNotEligibleLooseEligibleText, "all", {
      detector: "wasm",
      contentGate: { mode: "loose" },
      detectorDebug: {
        evidence: { verbosity: "compact", mode: "chunk", section: "all" },
        emit(event, details) {
          if (event === "detector.window.evidence") {
            looseSectionEvents.push(details ?? {});
          }
        },
      },
    });
    await wordCounterWithDetector(defaultNotEligibleLooseEligibleText, {
      detector: "wasm",
      contentGate: { mode: "off" },
      detectorDebug: {
        evidence: { verbosity: "compact", mode: "chunk", section: "all" },
        emit(event, details) {
          if (event === "detector.window.evidence") {
            offCountEvents.push(details ?? {});
          }
        },
      },
    });
    await segmentTextByLocaleWithDetector(defaultNotEligibleLooseEligibleText, {
      detector: "wasm",
      contentGate: { mode: "off" },
      detectorDebug: {
        evidence: { verbosity: "compact", mode: "chunk", section: "all" },
        emit(event, details) {
          if (event === "detector.window.evidence") {
            offSegmentEvents.push(details ?? {});
          }
        },
      },
    });
    await countSectionsWithDetector(defaultNotEligibleLooseEligibleText, "all", {
      detector: "wasm",
      contentGate: { mode: "off" },
      detectorDebug: {
        evidence: { verbosity: "compact", mode: "chunk", section: "all" },
        emit(event, details) {
          if (event === "detector.window.evidence") {
            offSectionEvents.push(details ?? {});
          }
        },
      },
    });

    expect(defaultEvents[0]?.minScriptChars).toBe(24);
    expect(defaultEvents[0]?.eligible).toBe(false);
    for (const evidence of [looseCountEvents[0], looseSegmentEvents[0], looseSectionEvents[0]]) {
      expect(evidence?.minScriptChars).toBe(20);
      expect(evidence?.eligible).toBe(true);
      expect(evidence?.contentGate).toEqual({
        applied: true,
        passed: true,
        policy: "latinProse",
        mode: "loose",
      });
    }
    for (const evidence of [offCountEvents[0], offSegmentEvents[0], offSectionEvents[0]]) {
      expect(evidence?.minScriptChars).toBe(24);
      expect(evidence?.eligible).toBe(false);
      expect(evidence?.contentGate).toEqual({
        applied: false,
        passed: true,
        policy: "none",
        mode: "off",
      });
    }
  });

  test("keeps short Hani windows ineligible across detector subpath runtime entrypoints", async () => {
    if (!hasWasmDetectorRuntime()) {
      return;
    }

    const defaultCountEvents: Array<Record<string, unknown>> = [];
    const strictCountEvents: Array<Record<string, unknown>> = [];
    const looseSegmentEvents: Array<Record<string, unknown>> = [];
    const offSectionEvents: Array<Record<string, unknown>> = [];

    await wordCounterWithDetector(shortHaniText, {
      detector: "wasm",
      detectorDebug: {
        evidence: { verbosity: "compact", mode: "chunk", section: "all" },
        emit(event, details) {
          if (event === "detector.window.evidence") {
            defaultCountEvents.push(details ?? {});
          }
        },
      },
    });
    await wordCounterWithDetector(shortHaniText, {
      detector: "wasm",
      contentGate: { mode: "strict" },
      detectorDebug: {
        evidence: { verbosity: "compact", mode: "chunk", section: "all" },
        emit(event, details) {
          if (event === "detector.window.evidence") {
            strictCountEvents.push(details ?? {});
          }
        },
      },
    });
    await segmentTextByLocaleWithDetector(shortHaniText, {
      detector: "wasm",
      contentGate: { mode: "loose" },
      detectorDebug: {
        evidence: { verbosity: "compact", mode: "chunk", section: "all" },
        emit(event, details) {
          if (event === "detector.window.evidence") {
            looseSegmentEvents.push(details ?? {});
          }
        },
      },
    });
    await countSectionsWithDetector(shortHaniText, "all", {
      detector: "wasm",
      contentGate: { mode: "off" },
      detectorDebug: {
        evidence: { verbosity: "compact", mode: "chunk", section: "all" },
        emit(event, details) {
          if (event === "detector.window.evidence") {
            offSectionEvents.push(details ?? {});
          }
        },
      },
    });

    expect(defaultCountEvents[0]?.minScriptChars).toBe(12);
    expect(defaultCountEvents[0]?.eligible).toBe(false);
    expect(strictCountEvents[0]?.minScriptChars).toBe(16);
    expect(strictCountEvents[0]?.eligible).toBe(false);
    expect(looseSegmentEvents[0]?.minScriptChars).toBe(4);
    expect(looseSegmentEvents[0]?.eligible).toBe(false);
    expect(offSectionEvents[0]?.minScriptChars).toBe(12);
    expect(offSectionEvents[0]?.eligible).toBe(false);
    const expectedModes = ["default", "strict", "loose", "off"] as const;
    for (const [index, evidence] of [
      defaultCountEvents[0],
      strictCountEvents[0],
      looseSegmentEvents[0],
      offSectionEvents[0],
    ].entries()) {
      expect(evidence?.contentGate).toEqual({
        applied: false,
        passed: true,
        policy: "none",
        mode: expectedModes[index],
      });
    }
  });

  test("uses Hani loose mode for idiom-length windows without turning borrowed context into a shortcut", async () => {
    if (!hasWasmDetectorRuntime()) {
      return;
    }

    const idiomDefaultEvents: Array<Record<string, unknown>> = [];
    const idiomLooseEvents: Array<Record<string, unknown>> = [];
    const borrowedShortLooseEvents: Array<Record<string, unknown>> = [];
    const borrowedLongDefaultEvents: Array<Record<string, unknown>> = [];
    const borrowedLongStrictEvents: Array<Record<string, unknown>> = [];
    const borrowedLongLooseEvents: Array<Record<string, unknown>> = [];
    const borrowedLongOffEvents: Array<Record<string, unknown>> = [];

    await wordCounterWithDetector(idiomLengthHaniText, {
      detector: "wasm",
      detectorDebug: {
        evidence: { verbosity: "compact", mode: "chunk", section: "all" },
        emit(event, details) {
          if (event === "detector.window.evidence") {
            idiomDefaultEvents.push(details ?? {});
          }
        },
      },
    });
    await wordCounterWithDetector(idiomLengthHaniText, {
      detector: "wasm",
      contentGate: { mode: "loose" },
      detectorDebug: {
        evidence: { verbosity: "compact", mode: "chunk", section: "all" },
        emit(event, details) {
          if (event === "detector.window.evidence") {
            idiomLooseEvents.push(details ?? {});
          }
        },
      },
    });
    await wordCounterWithDetector(borrowedShortHaniText, {
      detector: "wasm",
      contentGate: { mode: "loose" },
      detectorDebug: {
        evidence: { verbosity: "compact", mode: "chunk", section: "all" },
        emit(event, details) {
          if (event === "detector.window.evidence") {
            borrowedShortLooseEvents.push(details ?? {});
          }
        },
      },
    });
    await wordCounterWithDetector(borrowedLongHaniText, {
      detector: "wasm",
      detectorDebug: {
        evidence: { verbosity: "compact", mode: "chunk", section: "all" },
        emit(event, details) {
          if (event === "detector.window.evidence") {
            borrowedLongDefaultEvents.push(details ?? {});
          }
        },
      },
    });
    await segmentTextByLocaleWithDetector(borrowedLongHaniText, {
      detector: "wasm",
      contentGate: { mode: "strict" },
      detectorDebug: {
        evidence: { verbosity: "compact", mode: "chunk", section: "all" },
        emit(event, details) {
          if (event === "detector.window.evidence") {
            borrowedLongStrictEvents.push(details ?? {});
          }
        },
      },
    });
    await countSectionsWithDetector(borrowedLongHaniText, "all", {
      detector: "wasm",
      contentGate: { mode: "loose" },
      detectorDebug: {
        evidence: { verbosity: "compact", mode: "chunk", section: "all" },
        emit(event, details) {
          if (event === "detector.window.evidence") {
            borrowedLongLooseEvents.push(details ?? {});
          }
        },
      },
    });
    await wordCounterWithDetector(borrowedLongHaniText, {
      detector: "wasm",
      contentGate: { mode: "off" },
      detectorDebug: {
        evidence: { verbosity: "compact", mode: "chunk", section: "all" },
        emit(event, details) {
          if (event === "detector.window.evidence") {
            borrowedLongOffEvents.push(details ?? {});
          }
        },
      },
    });

    expect(idiomDefaultEvents[0]?.minScriptChars).toBe(12);
    expect(idiomDefaultEvents[0]?.eligible).toBe(false);
    expect(idiomDefaultEvents[0]?.contentGate).toEqual({
      applied: false,
      passed: true,
      policy: "none",
      mode: "default",
    });
    expect(idiomLooseEvents[0]?.minScriptChars).toBe(4);
    expect(idiomLooseEvents[0]?.eligible).toBe(true);
    expect(idiomLooseEvents[0]?.contentGate).toEqual({
      applied: false,
      passed: true,
      policy: "none",
      mode: "loose",
    });
    expect(borrowedShortLooseEvents[0]?.minScriptChars).toBe(4);
    expect(borrowedShortLooseEvents[0]?.eligible).toBe(false);
    expect(borrowedShortLooseEvents[0]?.contentGate).toEqual({
      applied: false,
      passed: true,
      policy: "none",
      mode: "loose",
    });
    expect(borrowedLongDefaultEvents[0]?.minScriptChars).toBe(12);
    expect(borrowedLongDefaultEvents[0]?.eligible).toBe(true);
    expect(borrowedLongDefaultEvents[0]?.contentGate).toEqual({
      applied: false,
      passed: true,
      policy: "none",
      mode: "default",
    });
    expect(borrowedLongStrictEvents[0]?.minScriptChars).toBe(16);
    expect(borrowedLongStrictEvents[0]?.eligible).toBe(false);
    expect(borrowedLongStrictEvents[0]?.contentGate).toEqual({
      applied: false,
      passed: true,
      policy: "none",
      mode: "strict",
    });
    expect(borrowedLongLooseEvents[0]?.minScriptChars).toBe(4);
    expect(borrowedLongLooseEvents[0]?.eligible).toBe(false);
    expect(borrowedLongLooseEvents[0]?.contentGate).toEqual({
      applied: false,
      passed: true,
      policy: "none",
      mode: "loose",
    });
    expect(borrowedLongOffEvents[0]?.minScriptChars).toBe(12);
    expect(borrowedLongOffEvents[0]?.eligible).toBe(true);
    expect(borrowedLongOffEvents[0]?.contentGate).toEqual({
      applied: false,
      passed: true,
      policy: "none",
      mode: "off",
    });
  });

  test("threads content gate mode through wasm segment and section detector entrypoints", async () => {
    if (!hasWasmDetectorRuntime()) {
      return;
    }

    const segmentEvents: Array<Record<string, unknown>> = [];
    const sectionEvents: Array<Record<string, unknown>> = [];

    const segments = await segmentTextByLocaleWithDetector(
      "Internationalization documentation remains understandable.",
      {
        detector: "wasm",
        contentGate: { mode: "strict" },
        detectorDebug: {
          emit(event, details) {
            if (event === "detector.window.sample") {
              segmentEvents.push(details ?? {});
            }
          },
        },
      },
    );
    const sections = await countSectionsWithDetector(
      "Internationalization documentation remains understandable.",
      "all",
      {
        detector: "wasm",
        contentGate: { mode: "strict" },
        detectorDebug: {
          emit(event, details) {
            if (event === "detector.window.sample") {
              sectionEvents.push(details ?? {});
            }
          },
        },
      },
    );

    expect(segments.map((chunk) => chunk.locale)).toEqual(["und-Latn"]);
    expect(sections.total).toBe(4);
    expect(segmentEvents[0]?.contentGate).toEqual({
      applied: true,
      passed: false,
      policy: "latinProse",
      mode: "strict",
    });
    expect(sectionEvents[0]?.contentGate).toEqual({
      applied: true,
      passed: false,
      policy: "latinProse",
      mode: "strict",
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
