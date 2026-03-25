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
    ).rejects.toThrow("`view: \"engine\"` requires `detector: \"wasm\"`.");
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
});
