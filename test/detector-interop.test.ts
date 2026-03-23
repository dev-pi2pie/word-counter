import { describe, expect, test } from "bun:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

describe("detector subpath interop", () => {
  test("ESM detector entry is reachable", async () => {
    const detector = await import("../dist/esm/detector.mjs");

    expect(detector.DEFAULT_DETECTOR_MODE).toBe("regex");
    await expect(
      detector.wordCounterWithDetector("Hello world", { detector: "regex" }),
    ).resolves.toMatchObject({ total: 2 });
    await expect(
      detector.wordCounterWithDetector("Hello world", { detector: "wasm" }),
    ).rejects.toThrow("Detector mode `wasm` is not implemented yet.");
  });

  test("CJS detector entry is reachable", async () => {
    const detector = require("../dist/cjs/detector.cjs");

    expect(typeof detector.wordCounterWithDetector).toBe("function");
    await expect(
      detector.wordCounterWithDetector("Hello world", { detector: "regex" }),
    ).resolves.toMatchObject({ total: 2 });
  });
});
