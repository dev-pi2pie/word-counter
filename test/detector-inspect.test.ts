import { describe, expect, test } from "bun:test";
import { inspectTextWithDetector } from "../src/detector";
import { hasWasmDetectorRuntime } from "./support/wasm-detector-runtime";

describe("detector inspect library API", () => {
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
    });
    expect(strictResult.windows?.[0]?.contentGate).toEqual({
      applied: true,
      passed: false,
      policy: "latinProse",
    });
    expect(offResult.windows?.[0]?.contentGate).toEqual({
      applied: false,
      passed: true,
      policy: "none",
    });
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
    });
    expect(looseResult.windows?.[0]?.contentGate).toEqual({
      applied: true,
      passed: true,
      policy: "latinProse",
    });
  });
});
