import { describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { discoverConfigFileInDirectory, discoverConfigFiles } from "../src/cli/config";

describe("cli config discovery", () => {
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

  test("falls back to the legacy macOS user config directory when HOME/.config has no config", async () => {
    const root = await mkdtemp(join(tmpdir(), "wc-config-macos-legacy-"));
    const home = join(root, "home");
    const legacyUserDirectory = join(home, "Library", "Application Support");
    const cwd = join(root, "project");
    await mkdir(legacyUserDirectory, { recursive: true });
    await mkdir(cwd);

    const legacyConfigPath = join(legacyUserDirectory, "wc-intl-seg.config.toml");
    await writeFile(legacyConfigPath, 'detector = "wasm"\n');

    const discovered = await discoverConfigFiles({
      cwd,
      platform: "darwin",
      env: {
        HOME: home,
      },
    });

    expect(discovered.user?.path).toBe(legacyConfigPath);
    expect(
      discovered.user?.notes.some((note) => note.includes("legacy macOS user config location")),
    ).toBeTrue();
  });

  test("prefers XDG_CONFIG_HOME over HOME/.config on macOS", async () => {
    const root = await mkdtemp(join(tmpdir(), "wc-config-macos-xdg-"));
    const home = join(root, "home");
    const xdgDirectory = join(root, "xdg-config");
    const primaryUserDirectory = join(home, ".config");
    const cwd = join(root, "project");
    await mkdir(xdgDirectory, { recursive: true });
    await mkdir(primaryUserDirectory, { recursive: true });
    await mkdir(cwd);

    const xdgConfigPath = join(xdgDirectory, "wc-intl-seg.config.toml");
    const homeConfigPath = join(primaryUserDirectory, "wc-intl-seg.config.json");
    await writeFile(xdgConfigPath, 'detector = "regex"\n');
    await writeFile(homeConfigPath, JSON.stringify({ detector: "wasm" }));

    const discovered = await discoverConfigFiles({
      cwd,
      platform: "darwin",
      env: {
        HOME: home,
        XDG_CONFIG_HOME: xdgDirectory,
      },
    });

    expect(discovered.user?.path).toBe(xdgConfigPath);
    expect(discovered.user?.notes.some((note) => note.includes(`"${homeConfigPath}"`))).toBeTrue();
  });

  test("falls back to APPDATA on Windows when USERPROFILE/.config has no config", async () => {
    const root = await mkdtemp(join(tmpdir(), "wc-config-win-legacy-"));
    const appData = join(root, "AppData", "Roaming");
    const cwd = join(root, "project");
    await mkdir(appData, { recursive: true });
    await mkdir(cwd);

    const legacyConfigPath = join(appData, "wc-intl-seg.config.toml");
    await writeFile(legacyConfigPath, 'detector = "wasm"\n');

    const discovered = await discoverConfigFiles({
      cwd,
      platform: "win32",
      env: {
        APPDATA: appData,
      },
    });

    expect(discovered.user?.path).toBe(legacyConfigPath);
    expect(
      discovered.user?.notes.some((note) => note.includes("legacy Windows user config location")),
    ).toBeTrue();
  });

  test("prefers HOME/.config over the legacy macOS user config directory", async () => {
    const root = await mkdtemp(join(tmpdir(), "wc-config-macos-primary-"));
    const home = join(root, "home");
    const primaryUserDirectory = join(home, ".config");
    const legacyUserDirectory = join(home, "Library", "Application Support");
    const cwd = join(root, "project");
    await mkdir(primaryUserDirectory, { recursive: true });
    await mkdir(legacyUserDirectory, { recursive: true });
    await mkdir(cwd);

    const primaryConfigPath = join(primaryUserDirectory, "wc-intl-seg.config.toml");
    const legacyConfigPath = join(legacyUserDirectory, "wc-intl-seg.config.json");
    await writeFile(primaryConfigPath, 'detector = "regex"\n');
    await writeFile(legacyConfigPath, JSON.stringify({ detector: "wasm" }));

    const discovered = await discoverConfigFiles({
      cwd,
      platform: "darwin",
      env: {
        HOME: home,
      },
    });

    expect(discovered.user?.path).toBe(primaryConfigPath);
    expect(
      discovered.user?.notes.some((note) => note.includes(`"${legacyConfigPath}"`)),
    ).toBeTrue();
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
});
