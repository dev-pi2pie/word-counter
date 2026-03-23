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
      detector.wordCounterWithDetector(
        "This sentence should clearly be detected as English for the wasm detector path.",
        { detector: "wasm" },
      ),
    ).resolves.toMatchObject({ total: 13 });
  });

  test("CJS detector entry is reachable", async () => {
    const detector = require("../dist/cjs/detector.cjs");

    expect(typeof detector.wordCounterWithDetector).toBe("function");
    await expect(
      detector.wordCounterWithDetector("Hello world", { detector: "regex" }),
    ).resolves.toMatchObject({ total: 2 });
  });
});
