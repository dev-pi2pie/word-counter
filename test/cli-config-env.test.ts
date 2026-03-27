import { describe, expect, test } from "bun:test";
import { resolveEnvConfig } from "../src/cli/config";

describe("cli environment config resolution", () => {
  test("resolves WORD_COUNTER_CONTENT_GATE from environment config", () => {
    const config = resolveEnvConfig({
      WORD_COUNTER_CONTENT_GATE: "strict",
    });

    expect(config).toEqual({
      contentGate: {
        mode: "strict",
      },
      inspect: {
        contentGate: {
          mode: "strict",
        },
      },
    });
  });

  test("rejects invalid WORD_COUNTER_CONTENT_GATE values", () => {
    expect(() =>
      resolveEnvConfig({
        WORD_COUNTER_CONTENT_GATE: "aggressive",
      }),
    ).toThrow(
      'Invalid config in environment variables at "contentGate.mode": expected one of: "default", "strict", "loose", "off".',
    );
  });
});
