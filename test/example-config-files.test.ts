import { describe, expect, test } from "bun:test";
import { readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { loadConfigFile } from "../src/cli/config";
import { createCliHarness } from "./support/cli-harness";

const { captureCli, makeTempFixture } = createCliHarness();

const EXAMPLE_CONFIG_PATHS = [
  "examples/wc-config/wc-intl-seg.config.toml",
  "examples/wc-config/wc-intl-seg.config.json",
  "examples/wc-config/wc-intl-seg.config.jsonc",
] as const;

function formatFromPath(path: (typeof EXAMPLE_CONFIG_PATHS)[number]): "toml" | "json" | "jsonc" {
  if (path.endsWith(".toml")) {
    return "toml";
  }
  if (path.endsWith(".jsonc")) {
    return "jsonc";
  }
  return "json";
}

describe("example config files", () => {
  for (const examplePath of EXAMPLE_CONFIG_PATHS) {
    test(`supports CLI execution with ${basename(examplePath)}`, async () => {
      const cwd = await makeTempFixture(`example-config-${basename(examplePath)}`);
      const targetPath = join(cwd, basename(examplePath));
      const source = await readFile(examplePath, "utf8");
      await writeFile(targetPath, source);

      const loaded = await loadConfigFile(targetPath, formatFromPath(examplePath));
      expect(loaded.config).toEqual({
        detector: "regex",
        inspect: {
          detector: "regex",
        },
        path: {
          mode: "auto",
          recursive: true,
          includeExtensions: [".md", ".markdown", ".mdx", ".mdc", ".txt"],
          excludeExtensions: [],
          detectBinary: true,
        },
        progress: {
          mode: "auto",
        },
        output: {
          totalOf: [],
        },
        reporting: {
          skippedFiles: false,
          debugReport: {
            tee: false,
          },
        },
        logging: {
          level: "info",
          verbosity: "compact",
        },
      });

      const output = await captureCli(["--format", "json", "Hello world"], { cwd });

      expect(output.exitCode).toBe(0);
      expect(JSON.parse(output.stdout[0] ?? "{}")).toMatchObject({ total: 2 });
    });
  }
});
