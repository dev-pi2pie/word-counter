import { describe, expect, test } from "bun:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const cjs = require("../dist/cjs/index.cjs");
const detectorCjs = require("../dist/cjs/detector.cjs");

describe("CJS wrapper interop", () => {
  test("require() returns default function with named properties", () => {
    expect(typeof cjs).toBe("function");
    expect(cjs.default).toBe(cjs);
    expect(cjs.wordCounter).toBe(cjs);
    expect(typeof cjs.countWordsForLocale).toBe("function");
    expect(typeof cjs.segmentTextByLocale).toBe("function");
    expect(typeof cjs.showSingularOrPluralWord).toBe("function");
  });

  test("default function works", () => {
    const result = cjs("Hello world");
    expect(result.total).toBe(2);
  });

  test("detector wrapper exports the runtime unavailable message", () => {
    expect(detectorCjs.WASM_DETECTOR_RUNTIME_UNAVAILABLE_MESSAGE).toBe(
      "WASM detector runtime is unavailable. Run `bun run build:wasm` to generate it.",
    );
  });
});
