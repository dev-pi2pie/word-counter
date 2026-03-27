import { describe, expect, test } from "bun:test";
import { resolveUserConfigDirectory } from "../src/cli/config";

describe("cli user config directory resolution", () => {
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

  test("uses HOME/.config on macOS", () => {
    const resolved = resolveUserConfigDirectory({
      platform: "darwin",
      env: {
        HOME: "/Users/example",
      },
    });

    expect(resolved).toBe("/Users/example/.config");
  });

  test("prefers XDG_CONFIG_HOME on macOS when it is set", () => {
    const resolved = resolveUserConfigDirectory({
      platform: "darwin",
      env: {
        XDG_CONFIG_HOME: "/Users/example/custom-config",
        HOME: "/Users/example",
      },
    });

    expect(resolved).toBe("/Users/example/custom-config");
  });

  test("returns undefined on macOS when HOME is unavailable", () => {
    const resolved = resolveUserConfigDirectory({
      platform: "darwin",
      env: {},
    });

    expect(resolved).toBeUndefined();
  });

  test("uses USERPROFILE/.config on Windows", () => {
    const resolved = resolveUserConfigDirectory({
      platform: "win32",
      env: {
        USERPROFILE: "C:\\Users\\Example",
      },
    });

    expect(resolved).toBe("C:\\Users\\Example\\.config");
  });

  test("prefers USERPROFILE/.config on Windows even when APPDATA is available", () => {
    const resolved = resolveUserConfigDirectory({
      platform: "win32",
      env: {
        APPDATA: "C:\\Users\\Example\\AppData\\Roaming",
        USERPROFILE: "C:\\Users\\Example",
      },
    });

    expect(resolved).toBe("C:\\Users\\Example\\.config");
  });

  test("falls back to APPDATA on Windows when USERPROFILE is unavailable", () => {
    const resolved = resolveUserConfigDirectory({
      platform: "win32",
      env: {
        APPDATA: "C:\\Users\\Example\\AppData\\Roaming",
      },
    });

    expect(resolved).toBe("C:\\Users\\Example\\AppData\\Roaming");
  });

  test("returns undefined on Windows when USERPROFILE and APPDATA are unavailable", () => {
    const resolved = resolveUserConfigDirectory({
      platform: "win32",
      env: {},
    });

    expect(resolved).toBeUndefined();
  });
});
