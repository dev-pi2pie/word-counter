import { describe, expect, test } from "bun:test";
import { inspectTextWithDetector } from "../src/detector";
import { hasWasmDetectorRuntime } from "./support/wasm-detector-runtime";

describe("detector inspect library API", () => {
  const defaultEligibleStrictNotEligibleText = "Readers understand the feature.";
  const defaultNotEligibleLooseEligibleText = "Users understand this now.";
  const shortHaniText = "世界";
  const idiomLengthHaniText = "四字成語";
  const borrowedShortHaniText = "こんにちは、世界！";
  const borrowedLongHaniText = "こんにちは、世界！これはテストです。";

  test("returns deterministic regex pipeline inspection", async () => {
    const result = await inspectTextWithDetector("こんにちは、世界！これはテストです。", {
      detector: "regex",
      view: "pipeline",
    });

    expect(result.view).toBe("pipeline");
    expect(result.detector).toBe("regex");
    if (result.view !== "pipeline") {
      throw new Error("Expected pipeline inspect result.");
    }
    expect(result.chunks.map((chunk) => chunk.locale)).toEqual(["ja", "und-Hani", "ja"]);
    expect(result.chunks[1]?.source).toBe("fallback");
    expect(result.chunks[1]?.reason).toBe("han-fallback-after-boundary");
    expect(result.resolvedChunks.map((chunk) => chunk.locale)).toEqual(["ja", "und-Hani", "ja"]);
    expect(result.windows).toBeUndefined();
  });

  test("returns empty pipeline inspection for empty wasm input", async () => {
    const result = await inspectTextWithDetector("", {
      detector: "wasm",
      view: "pipeline",
    });

    expect(result.view).toBe("pipeline");
    expect(result.detector).toBe("wasm");
    if (result.view !== "pipeline") {
      throw new Error("Expected pipeline inspect result.");
    }
    expect(result.chunks).toEqual([]);
    expect(result.windows).toEqual([]);
    expect(result.resolvedChunks).toEqual([]);
    expect(result.decision).toEqual({
      kind: "empty",
      notes: ["No detector-eligible content was present."],
    });
  });

  test("returns empty engine inspection for empty input", async () => {
    const result = await inspectTextWithDetector("", {
      detector: "wasm",
      view: "engine",
    });

    expect(result.view).toBe("engine");
    expect(result.detector).toBe("wasm");
    if (result.view !== "engine") {
      throw new Error("Expected engine inspect result.");
    }
    expect(result.sample.text).toBe("");
    expect(result.decision).toEqual({
      kind: "empty",
      notes: ["No detector-eligible content was present."],
    });
  });

  test("defaults pipeline inspection to wasm when detector is omitted", async () => {
    if (!hasWasmDetectorRuntime()) {
      return;
    }

    const result = await inspectTextWithDetector(
      "This sentence should clearly be detected as English for the wasm detector path.",
    );

    expect(result.view).toBe("pipeline");
    expect(result.detector).toBe("wasm");
    if (result.view !== "pipeline") {
      throw new Error("Expected pipeline inspect result.");
    }
    expect(result.windows?.length).toBe(1);
    expect(result.windows?.[0]?.engine.executed).toBeTrue();
  });

  test("defaults engine inspection to wasm when engine view is requested", async () => {
    if (!hasWasmDetectorRuntime()) {
      return;
    }

    const result = await inspectTextWithDetector(
      "This sentence should clearly be detected as English for the wasm detector path.",
      { view: "engine" },
    );

    expect(result.view).toBe("engine");
    expect(result.detector).toBe("wasm");
    if (result.view !== "engine") {
      throw new Error("Expected engine inspect result.");
    }
    expect(result.routeTag).toBe("und-Latn");
    expect(result.engine?.remapped.rawTag).toBe("en");
  });

  test("rejects regex engine inspection requests", async () => {
    await expect(
      inspectTextWithDetector("Hello world", {
        detector: "regex",
        view: "engine",
      }),
    ).rejects.toThrow('`view: "engine"` requires `detector: "wasm"`.');
  });

  test("returns wasm engine inspection for the first ambiguous route sample", async () => {
    if (!hasWasmDetectorRuntime()) {
      return;
    }

    const result = await inspectTextWithDetector("こんにちは、世界！これはテストです。", {
      detector: "wasm",
      view: "engine",
    });

    expect(result.view).toBe("engine");
    if (result.view !== "engine") {
      throw new Error("Expected engine inspect result.");
    }
    expect(result.routeTag).toBe("und-Hani");
    expect(result.sample.textSource).toBe("borrowed-context");
    expect(result.sample.normalizedText).toBe("世界");
    expect(result.engine?.remapped.rawTag).toBe("ja");
  });

  test("reports noCandidate fallback when wasm engine returns an unmapped Latin language", async () => {
    if (!hasWasmDetectorRuntime()) {
      return;
    }

    const result = await inspectTextWithDetector(
      "Ini adalah kalimat bahasa Indonesia yang cukup panjang untuk menguji cabang fallback detektor wasm.",
      {
        detector: "wasm",
        view: "pipeline",
      },
    );

    expect(result.view).toBe("pipeline");
    expect(result.detector).toBe("wasm");
    if (result.view !== "pipeline") {
      throw new Error("Expected pipeline inspect result.");
    }
    const windows = result.windows ?? [];
    const [window] = windows;
    expect(windows).toHaveLength(1);
    expect(window?.routeTag).toBe("und-Latn");
    expect(window?.engine.executed).toBeTrue();
    expect(window?.decision.fallbackReason).toBe("noCandidate");
    expect(result.resolvedChunks.map((chunk) => chunk.locale)).toEqual(["und-Latn"]);
  });

  test("applies strict and off content gate modes in wasm pipeline inspection", async () => {
    if (!hasWasmDetectorRuntime()) {
      return;
    }

    const text = "Readers understand this behavior.";
    const defaultResult = await inspectTextWithDetector(text, {
      detector: "wasm",
      view: "pipeline",
    });
    const strictResult = await inspectTextWithDetector(text, {
      detector: "wasm",
      view: "pipeline",
      contentGate: { mode: "strict" },
    });
    const offResult = await inspectTextWithDetector(text, {
      detector: "wasm",
      view: "pipeline",
      contentGate: { mode: "off" },
    });

    if (
      defaultResult.view !== "pipeline" ||
      strictResult.view !== "pipeline" ||
      offResult.view !== "pipeline"
    ) {
      throw new Error("Expected pipeline inspect result.");
    }

    expect(defaultResult.windows?.[0]?.contentGate).toEqual({
      applied: true,
      passed: true,
      policy: "latinProse",
      mode: "default",
    });
    expect(strictResult.windows?.[0]?.contentGate).toEqual({
      applied: true,
      passed: false,
      policy: "latinProse",
      mode: "strict",
    });
    expect(offResult.windows?.[0]?.contentGate).toEqual({
      applied: false,
      passed: true,
      policy: "none",
      mode: "off",
    });
    expect(
      (offResult.windows?.[0] as Record<string, unknown> | undefined)?.qualityGate,
    ).toBeUndefined();
  });

  test("raises Latin eligibility thresholds for strict mode in wasm pipeline inspection", async () => {
    if (!hasWasmDetectorRuntime()) {
      return;
    }

    const defaultResult = await inspectTextWithDetector(defaultEligibleStrictNotEligibleText, {
      detector: "wasm",
      view: "pipeline",
    });
    const strictResult = await inspectTextWithDetector(defaultEligibleStrictNotEligibleText, {
      detector: "wasm",
      view: "pipeline",
      contentGate: { mode: "strict" },
    });

    if (defaultResult.view !== "pipeline" || strictResult.view !== "pipeline") {
      throw new Error("Expected pipeline inspect result.");
    }

    expect(defaultResult.windows?.[0]?.eligibility).toEqual({
      scriptChars: 27,
      minScriptChars: 24,
      passed: true,
    });
    expect(defaultResult.windows?.[0]?.engine).toEqual({
      executed: true,
    });
    expect(strictResult.windows?.[0]?.eligibility).toEqual({
      scriptChars: 27,
      minScriptChars: 30,
      passed: false,
    });
    expect(strictResult.windows?.[0]?.engine).toEqual({
      executed: false,
      reason: "notEligible",
    });
    expect(strictResult.windows?.[0]?.decision.fallbackReason).toBe("notEligible");
  });

  test("applies loose content gate mode in wasm pipeline inspection", async () => {
    if (!hasWasmDetectorRuntime()) {
      return;
    }

    const text = ["mode: debug", "tee: true", "path: logs", "Use this for testing."].join("\n");
    const defaultResult = await inspectTextWithDetector(text, {
      detector: "wasm",
      view: "pipeline",
    });
    const looseResult = await inspectTextWithDetector(text, {
      detector: "wasm",
      view: "pipeline",
      contentGate: { mode: "loose" },
    });

    if (defaultResult.view !== "pipeline" || looseResult.view !== "pipeline") {
      throw new Error("Expected pipeline inspect result.");
    }

    expect(defaultResult.windows?.[0]?.contentGate).toEqual({
      applied: true,
      passed: false,
      policy: "latinProse",
      mode: "default",
    });
    expect(looseResult.windows?.[0]?.contentGate).toEqual({
      applied: true,
      passed: true,
      policy: "latinProse",
      mode: "loose",
    });
  });

  test("lowers Latin eligibility thresholds for loose mode while keeping off on default thresholds", async () => {
    if (!hasWasmDetectorRuntime()) {
      return;
    }

    const defaultResult = await inspectTextWithDetector(defaultNotEligibleLooseEligibleText, {
      detector: "wasm",
      view: "pipeline",
    });
    const looseResult = await inspectTextWithDetector(defaultNotEligibleLooseEligibleText, {
      detector: "wasm",
      view: "pipeline",
      contentGate: { mode: "loose" },
    });
    const offResult = await inspectTextWithDetector(defaultNotEligibleLooseEligibleText, {
      detector: "wasm",
      view: "pipeline",
      contentGate: { mode: "off" },
    });

    if (
      defaultResult.view !== "pipeline" ||
      looseResult.view !== "pipeline" ||
      offResult.view !== "pipeline"
    ) {
      throw new Error("Expected pipeline inspect result.");
    }

    expect(defaultResult.windows?.[0]?.eligibility).toEqual({
      scriptChars: 22,
      minScriptChars: 24,
      passed: false,
    });
    expect(looseResult.windows?.[0]?.eligibility).toEqual({
      scriptChars: 22,
      minScriptChars: 20,
      passed: true,
    });
    expect(looseResult.windows?.[0]?.engine.executed).toBeTrue();
    expect(offResult.windows?.[0]?.eligibility).toEqual({
      scriptChars: 22,
      minScriptChars: 24,
      passed: false,
    });
    expect(offResult.windows?.[0]?.contentGate).toEqual({
      applied: false,
      passed: true,
      policy: "none",
      mode: "off",
    });
    expect(offResult.windows?.[0]?.engine).toEqual({
      executed: false,
      reason: "notEligible",
    });
  });

  test("keeps short Hani windows ineligible across all modes while preserving no-op content gate disclosure", async () => {
    if (!hasWasmDetectorRuntime()) {
      return;
    }

    const assertPipelineResult = (result: Awaited<ReturnType<typeof inspectTextWithDetector>>) => {
      if (result.view !== "pipeline") {
        throw new Error("Expected pipeline inspect result.");
      }
      return result;
    };

    const defaultResult = await inspectTextWithDetector(shortHaniText, {
      detector: "wasm",
      view: "pipeline",
    });
    const strictResult = await inspectTextWithDetector(shortHaniText, {
      detector: "wasm",
      view: "pipeline",
      contentGate: { mode: "strict" },
    });
    const looseResult = await inspectTextWithDetector(shortHaniText, {
      detector: "wasm",
      view: "pipeline",
      contentGate: { mode: "loose" },
    });
    const offResult = await inspectTextWithDetector(shortHaniText, {
      detector: "wasm",
      view: "pipeline",
      contentGate: { mode: "off" },
    });

    const pipelineResults = [
      assertPipelineResult(defaultResult),
      assertPipelineResult(strictResult),
      assertPipelineResult(looseResult),
      assertPipelineResult(offResult),
    ];
    const expectedModes = ["default", "strict", "loose", "off"] as const;
    for (const [index, result] of pipelineResults.entries()) {
      expect(result.windows?.[0]?.contentGate).toEqual({
        applied: false,
        passed: true,
        policy: "none",
        mode: expectedModes[index]!,
      });
      expect(result.windows?.[0]?.engine).toEqual({
        executed: false,
        reason: "notEligible",
      });
    }

    const defaultPipeline = pipelineResults[0]!;
    const strictPipeline = pipelineResults[1]!;
    const loosePipeline = pipelineResults[2]!;
    const offPipeline = pipelineResults[3]!;
    expect(defaultPipeline.windows?.[0]?.eligibility).toEqual({
      scriptChars: 2,
      minScriptChars: 12,
      passed: false,
    });
    expect(strictPipeline.windows?.[0]?.eligibility).toEqual({
      scriptChars: 2,
      minScriptChars: 16,
      passed: false,
    });
    expect(loosePipeline.windows?.[0]?.eligibility).toEqual({
      scriptChars: 2,
      minScriptChars: 4,
      passed: false,
    });
    expect(offPipeline.windows?.[0]?.eligibility).toEqual({
      scriptChars: 2,
      minScriptChars: 12,
      passed: false,
    });
  });

  test("admits idiom-length Hani windows only in loose mode", async () => {
    if (!hasWasmDetectorRuntime()) {
      return;
    }

    const defaultResult = await inspectTextWithDetector(idiomLengthHaniText, {
      detector: "wasm",
      view: "pipeline",
    });
    const looseResult = await inspectTextWithDetector(idiomLengthHaniText, {
      detector: "wasm",
      view: "pipeline",
      contentGate: { mode: "loose" },
    });
    const offResult = await inspectTextWithDetector(idiomLengthHaniText, {
      detector: "wasm",
      view: "pipeline",
      contentGate: { mode: "off" },
    });

    if (
      defaultResult.view !== "pipeline" ||
      looseResult.view !== "pipeline" ||
      offResult.view !== "pipeline"
    ) {
      throw new Error("Expected pipeline inspect result.");
    }

    expect(defaultResult.windows?.[0]?.eligibility).toEqual({
      scriptChars: 4,
      minScriptChars: 12,
      passed: false,
    });
    expect(looseResult.windows?.[0]?.eligibility).toEqual({
      scriptChars: 4,
      minScriptChars: 4,
      passed: true,
    });
    expect(offResult.windows?.[0]?.eligibility).toEqual({
      scriptChars: 4,
      minScriptChars: 12,
      passed: false,
    });
    expect(looseResult.windows?.[0]?.contentGate).toEqual({
      applied: false,
      passed: true,
      policy: "none",
      mode: "loose",
    });
  });

  test("keeps borrowed-context Hani windows mode-aware without turning loose into a context-only shortcut", async () => {
    if (!hasWasmDetectorRuntime()) {
      return;
    }

    const borrowedShortLooseResult = await inspectTextWithDetector(borrowedShortHaniText, {
      detector: "wasm",
      view: "pipeline",
      contentGate: { mode: "loose" },
    });
    const borrowedLongDefaultResult = await inspectTextWithDetector(borrowedLongHaniText, {
      detector: "wasm",
      view: "pipeline",
    });
    const borrowedLongStrictResult = await inspectTextWithDetector(borrowedLongHaniText, {
      detector: "wasm",
      view: "pipeline",
      contentGate: { mode: "strict" },
    });
    const borrowedLongLooseResult = await inspectTextWithDetector(borrowedLongHaniText, {
      detector: "wasm",
      view: "pipeline",
      contentGate: { mode: "loose" },
    });
    const borrowedLongOffResult = await inspectTextWithDetector(borrowedLongHaniText, {
      detector: "wasm",
      view: "pipeline",
      contentGate: { mode: "off" },
    });

    if (
      borrowedShortLooseResult.view !== "pipeline" ||
      borrowedLongDefaultResult.view !== "pipeline" ||
      borrowedLongStrictResult.view !== "pipeline" ||
      borrowedLongLooseResult.view !== "pipeline" ||
      borrowedLongOffResult.view !== "pipeline"
    ) {
      throw new Error("Expected pipeline inspect result.");
    }

    expect(borrowedShortLooseResult.windows?.[0]?.eligibility).toEqual({
      scriptChars: 2,
      minScriptChars: 4,
      passed: false,
    });
    expect(borrowedLongDefaultResult.windows?.[0]?.eligibility).toEqual({
      scriptChars: 15,
      minScriptChars: 12,
      passed: true,
    });
    expect(borrowedLongStrictResult.windows?.[0]?.eligibility).toEqual({
      scriptChars: 15,
      minScriptChars: 16,
      passed: false,
    });
    expect(borrowedLongStrictResult.windows?.[0]?.contentGate).toEqual({
      applied: false,
      passed: true,
      policy: "none",
      mode: "strict",
    });
    expect(borrowedLongLooseResult.windows?.[0]?.eligibility).toEqual({
      scriptChars: 2,
      minScriptChars: 4,
      passed: false,
    });
    expect(borrowedLongOffResult.windows?.[0]?.eligibility).toEqual({
      scriptChars: 15,
      minScriptChars: 12,
      passed: true,
    });
    expect(borrowedLongOffResult.windows?.[0]?.contentGate).toEqual({
      applied: false,
      passed: true,
      policy: "none",
      mode: "off",
    });
    expect(borrowedLongDefaultResult.windows?.[0]?.contentGate).toEqual({
      applied: false,
      passed: true,
      policy: "none",
      mode: "default",
    });
    expect(borrowedLongLooseResult.windows?.[0]?.contentGate).toEqual({
      applied: false,
      passed: true,
      policy: "none",
      mode: "loose",
    });
  });
});
