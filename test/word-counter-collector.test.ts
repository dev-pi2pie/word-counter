import { describe, expect, test } from "bun:test";
import wordCounter from "../src/wc";

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
