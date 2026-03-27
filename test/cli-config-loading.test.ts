import { describe, expect, test } from "bun:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfigFile } from "../src/cli/config";

describe("cli config file loading", () => {
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
});
