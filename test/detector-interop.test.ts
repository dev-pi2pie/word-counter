import { describe, expect, test } from "bun:test";

describe("detector subpath interop", () => {
  test("ESM detector entry is reachable", async () => {
    const detector = await import("../src/detector/index.ts");

    expect(detector.DEFAULT_DETECTOR_MODE).toBe("regex");
    await expect(
      detector.wordCounterWithDetector("Hello world", { detector: "regex" }),
    ).resolves.toMatchObject({ total: 2 });
  });
});
