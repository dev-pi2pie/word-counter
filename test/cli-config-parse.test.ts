import { describe, expect, test } from "bun:test";
import { parseConfigText } from "../src/cli/config";

describe("cli config parsing and validation", () => {
  test("parses JSON config into the normalized schema shape", () => {
    const config = parseConfigText(
      JSON.stringify({
        detector: "regex",
        contentGate: { mode: "strict" },
        inspect: { detector: "wasm" },
        path: {
          mode: "manual",
          recursive: false,
          includeExtensions: [".md", ".txt"],
          excludeExtensions: [".log"],
          detectBinary: true,
        },
        output: { totalOf: ["words", "emoji"] },
        logging: { level: "debug", verbosity: "verbose" },
      }),
      "json",
      "inline.json",
    );

    expect(config).toEqual({
      detector: "regex",
      contentGate: { mode: "strict" },
      inspect: { detector: "wasm" },
      path: {
        mode: "manual",
        recursive: false,
        includeExtensions: [".md", ".txt"],
        excludeExtensions: [".log"],
        detectBinary: true,
      },
      output: { totalOf: ["words", "emoji"] },
      logging: { level: "debug", verbosity: "verbose" },
    });
  });

  test("parses JSONC config with line and block comments", () => {
    const config = parseConfigText(
      [
        "{",
        "  // detector defaults",
        '  "detector": "regex",',
        '  "contentGate": { "mode": "loose" },',
        '  "inspect": { /* inspect override */ "detector": "wasm", "contentGate": { "mode": "off" } },',
        '  "progress": { "mode": "auto" }',
        "}",
      ].join("\n"),
      "jsonc",
      "inline.jsonc",
    );

    expect(config).toEqual({
      detector: "regex",
      contentGate: { mode: "loose" },
      inspect: { detector: "wasm", contentGate: { mode: "off" } },
      progress: { mode: "auto" },
    });
  });

  test("parses TOML config with nested tables and arrays", () => {
    const config = parseConfigText(
      [
        'detector = "regex"',
        "",
        "[contentGate]",
        'mode = "strict"',
        "",
        "[inspect]",
        'detector = "wasm"',
        "",
        "[inspect.contentGate]",
        'mode = "off"',
        "",
        "[path]",
        'mode = "manual"',
        "recursive = false",
        'includeExtensions = [".md", ".txt"]',
        "",
        "[reporting]",
        "skippedFiles = true",
        "",
        "[reporting.debugReport]",
        'path = "logs/debug.jsonl"',
        "tee = true",
      ].join("\n"),
      "toml",
      "inline.toml",
    );

    expect(config).toEqual({
      detector: "regex",
      contentGate: { mode: "strict" },
      inspect: { detector: "wasm", contentGate: { mode: "off" } },
      path: {
        mode: "manual",
        recursive: false,
        includeExtensions: [".md", ".txt"],
      },
      reporting: {
        skippedFiles: true,
        debugReport: {
          path: "logs/debug.jsonl",
          tee: true,
        },
      },
    });
  });

  test("rejects unknown config keys", () => {
    expect(() =>
      parseConfigText(
        JSON.stringify({
          detector: "regex",
          unknownThing: true,
        }),
        "json",
        "invalid.json",
      ),
    ).toThrow('Invalid config in invalid.json at "unknownThing": unknown key.');
  });

  test("rejects invalid enum values", () => {
    expect(() =>
      parseConfigText(
        JSON.stringify({
          detector: "nope",
        }),
        "json",
        "invalid.json",
      ),
    ).toThrow('Invalid config in invalid.json at "detector": expected one of: "regex", "wasm".');
  });

  test("rejects invalid array shapes", () => {
    expect(() =>
      parseConfigText(
        JSON.stringify({
          output: {
            totalOf: ["words", 12],
          },
        }),
        "json",
        "invalid.json",
      ),
    ).toThrow('Invalid config in invalid.json at "output.totalOf": expected an array of strings.');
  });

  test("rejects non-object contentGate config", () => {
    expect(() =>
      parseConfigText(
        JSON.stringify({
          contentGate: "strict",
        }),
        "json",
        "invalid.json",
      ),
    ).toThrow('Invalid config in invalid.json at "contentGate": expected an object.');
  });

  test("rejects invalid nested contentGate mode values", () => {
    expect(() =>
      parseConfigText(
        JSON.stringify({
          inspect: {
            contentGate: {
              mode: "aggressive",
            },
          },
        }),
        "json",
        "invalid.json",
      ),
    ).toThrow(
      'Invalid config in invalid.json at "inspect.contentGate.mode": expected one of: "default", "strict", "loose", "off".',
    );
  });

  test("rejects malformed inspect.contentGate objects", () => {
    expect(() =>
      parseConfigText(
        JSON.stringify({
          inspect: {
            contentGate: "strict",
          },
        }),
        "json",
        "invalid.json",
      ),
    ).toThrow('Invalid config in invalid.json at "inspect.contentGate": expected an object.');

    expect(() =>
      parseConfigText(
        JSON.stringify({
          inspect: {
            contentGate: {
              mode: "default",
              extra: true,
            },
          },
        }),
        "json",
        "invalid.json",
      ),
    ).toThrow('Invalid config in invalid.json at "inspect.contentGate.extra": unknown key.');
  });

  test("rejects unknown keys inside contentGate config", () => {
    expect(() =>
      parseConfigText(
        JSON.stringify({
          contentGate: {
            mode: "default",
            extra: true,
          },
        }),
        "json",
        "invalid.json",
      ),
    ).toThrow('Invalid config in invalid.json at "contentGate.extra": unknown key.');
  });

  test("rejects malformed JSON config", () => {
    expect(() => parseConfigText('{"detector": "regex"', "json", "broken.json")).toThrow(
      "Invalid JSON config in broken.json",
    );
  });

  test("rejects malformed JSONC block comments", () => {
    expect(() =>
      parseConfigText('{ /* broken comment\n "detector": "regex" }', "jsonc", "broken.jsonc"),
    ).toThrow("Invalid JSONC config in broken.jsonc: Unterminated block comment in JSONC config.");
  });

  test("rejects malformed TOML assignments", () => {
    expect(() => parseConfigText('detector "regex"', "toml", "broken.toml")).toThrow(
      "Invalid TOML config in broken.toml: Invalid TOML assignment",
    );
  });

  test("rejects duplicate TOML keys", () => {
    expect(() =>
      parseConfigText(
        ['detector = "regex"', 'detector = "wasm"'].join("\n"),
        "toml",
        "broken.toml",
      ),
    ).toThrow("Invalid TOML config in broken.toml: Duplicate TOML key: detector");
  });
});
