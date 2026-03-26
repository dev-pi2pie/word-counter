import { describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  discoverConfigFileInDirectory,
  discoverConfigFiles,
  loadConfigFile,
  parseConfigText,
  resolveEnvConfig,
  resolveUserConfigDirectory,
} from "../src/cli/config";

describe("cli config parsing and discovery", () => {
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

  test("loads config files from disk", async () => {
    const root = await mkdtemp(join(tmpdir(), "wc-config-load-"));
    const filePath = join(root, "wc-intl-seg.config.json");
    await writeFile(filePath, JSON.stringify({ detector: "regex", contentGate: { mode: "off" } }));

    const loaded = await loadConfigFile(filePath, "json");

    expect(loaded.path).toBe(filePath);
    expect(loaded.format).toBe("json");
    expect(loaded.config).toEqual({ detector: "regex", contentGate: { mode: "off" } });
  });

  test("reports config read failures with the file path", async () => {
    const missingPath = join(tmpdir(), "wc-config-missing", "wc-intl-seg.config.json");

    await expect(loadConfigFile(missingPath, "json")).rejects.toThrow(
      `Failed to read config file (${missingPath})`,
    );
  });

  test("resolves Linux user config directory from XDG_CONFIG_HOME", () => {
    const resolved = resolveUserConfigDirectory({
      platform: "linux",
      env: {
        XDG_CONFIG_HOME: "/tmp/config-home",
        HOME: "/tmp/home",
      },
    });

    expect(resolved).toBe("/tmp/config-home");
  });

  test("falls back to HOME/.config on Linux", () => {
    const resolved = resolveUserConfigDirectory({
      platform: "linux",
      env: {
        HOME: "/tmp/home",
      },
    });

    expect(resolved).toBe("/tmp/home/.config");
  });

  test("returns undefined on Linux when no config-home inputs are available", () => {
    const resolved = resolveUserConfigDirectory({
      platform: "linux",
      env: {},
    });

    expect(resolved).toBeUndefined();
  });

  test("resolves macOS user config directory", () => {
    const resolved = resolveUserConfigDirectory({
      platform: "darwin",
      env: {
        HOME: "/Users/example",
      },
    });

    expect(resolved).toBe("/Users/example/Library/Application Support");
  });

  test("returns undefined on macOS when HOME is unavailable", () => {
    const resolved = resolveUserConfigDirectory({
      platform: "darwin",
      env: {},
    });

    expect(resolved).toBeUndefined();
  });

  test("resolves Windows user config directory from APPDATA", () => {
    const resolved = resolveUserConfigDirectory({
      platform: "win32",
      env: {
        APPDATA: "C:\\Users\\Example\\AppData\\Roaming",
      },
    });

    expect(resolved).toBe("C:\\Users\\Example\\AppData\\Roaming");
  });

  test("falls back to USERPROFILE on Windows when APPDATA is unavailable", () => {
    const resolved = resolveUserConfigDirectory({
      platform: "win32",
      env: {
        USERPROFILE: "C:\\Users\\Example",
      },
    });

    expect(resolved).toBe("C:\\Users\\Example\\AppData\\Roaming");
  });

  test("returns undefined on Windows when APPDATA and USERPROFILE are unavailable", () => {
    const resolved = resolveUserConfigDirectory({
      platform: "win32",
      env: {},
    });

    expect(resolved).toBeUndefined();
  });

  test("prefers TOML over JSONC and JSON in the same directory", async () => {
    const root = await mkdtemp(join(tmpdir(), "wc-config-priority-"));
    const tomlPath = join(root, "wc-intl-seg.config.toml");
    const jsoncPath = join(root, "wc-intl-seg.config.jsonc");
    const jsonPath = join(root, "wc-intl-seg.config.json");
    await writeFile(jsonPath, JSON.stringify({ detector: "regex" }));
    await writeFile(jsoncPath, '{ "detector": "wasm" }');
    await writeFile(tomlPath, 'detector = "regex"\n');

    const discovered = await discoverConfigFileInDirectory(root, "cwd");

    expect(discovered?.path).toBe(tomlPath);
    expect(discovered?.format).toBe("toml");
    expect(discovered?.ignoredSiblingPaths).toEqual([jsoncPath, jsonPath]);
    expect(discovered?.notes[0]).toContain("Ignoring lower-priority sibling config files");
  });

  test("prefers JSONC over JSON when TOML is absent", async () => {
    const root = await mkdtemp(join(tmpdir(), "wc-config-priority-jsonc-"));
    const jsoncPath = join(root, "wc-intl-seg.config.jsonc");
    const jsonPath = join(root, "wc-intl-seg.config.json");
    await writeFile(jsonPath, JSON.stringify({ detector: "regex" }));
    await writeFile(jsoncPath, '{ "detector": "wasm" }');

    const discovered = await discoverConfigFileInDirectory(root, "user");

    expect(discovered?.path).toBe(jsoncPath);
    expect(discovered?.format).toBe("jsonc");
    expect(discovered?.ignoredSiblingPaths).toEqual([jsonPath]);
  });

  test("discovers both user-scope and cwd-scope config files together", async () => {
    const root = await mkdtemp(join(tmpdir(), "wc-config-combined-"));
    const userDirectory = join(root, "user-config");
    const cwd = join(root, "project");
    await mkdir(userDirectory);
    await mkdir(cwd);

    const userConfigPath = join(userDirectory, "wc-intl-seg.config.json");
    const cwdConfigPath = join(cwd, "wc-intl-seg.config.toml");
    await writeFile(userConfigPath, JSON.stringify({ detector: "regex" }));
    await writeFile(cwdConfigPath, 'detector = "wasm"\n');

    const discovered = await discoverConfigFiles({
      cwd,
      platform: "linux",
      env: {
        XDG_CONFIG_HOME: userDirectory,
      },
    });

    expect(discovered.user?.path).toBe(userConfigPath);
    expect(discovered.user?.format).toBe("json");
    expect(discovered.cwd?.path).toBe(cwdConfigPath);
    expect(discovered.cwd?.format).toBe("toml");
  });

  test("ignores non-file entries when discovering config files", async () => {
    const root = await mkdtemp(join(tmpdir(), "wc-config-directory-entry-"));
    const jsonDirectory = join(root, "wc-intl-seg.config.json");
    await mkdir(jsonDirectory);
    const jsoncPath = join(root, "wc-intl-seg.config.jsonc");
    await writeFile(jsoncPath, '{ "detector": "regex" }');

    const discovered = await discoverConfigFileInDirectory(root, "cwd");

    expect(discovered?.path).toBe(jsoncPath);
    expect(discovered?.format).toBe("jsonc");
    expect(discovered?.ignoredSiblingPaths).toEqual([]);
  });

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
