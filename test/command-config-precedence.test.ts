import { describe, expect, test } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { createCliHarness } from "./support/cli-harness";
import { writeJsonConfig, writeTomlConfig } from "./support/config-fixtures";
import { hasWasmDetectorRuntime } from "./support/wasm-detector-runtime";

const { captureCli, findDebugEvents, makeTempFixture } = createCliHarness();

describe("CLI config precedence and counting defaults", () => {
  const defaultEligibleStrictNotEligibleText = "Readers understand the feature.";

  test("lets cwd config override user config, env override cwd config, and CLI override env", async () => {
    const root = await makeTempFixture("cli-config-precedence");
    const userConfigDir = join(root, "user-config");
    const cwd = join(root, "project");
    await mkdir(userConfigDir);
    await mkdir(cwd);

    await writeJsonConfig(userConfigDir, {
      output: {
        totalOf: ["punctuation"],
      },
    });
    await writeTomlConfig(cwd, ["[output]", 'totalOf = ["words", "emoji"]']);

    const baseEnv = {
      XDG_CONFIG_HOME: userConfigDir,
    };

    const fromCwdConfig = await captureCli(["--format", "raw", "Hello there 👋!"], {
      cwd,
      env: baseEnv,
    });
    expect(fromCwdConfig.exitCode).toBe(0);
    expect(fromCwdConfig.stdout).toEqual(["3"]);

    const fromEnv = await captureCli(["--format", "raw", "Hello there 👋!"], {
      cwd,
      env: {
        ...baseEnv,
        WORD_COUNTER_TOTAL_OF: "emoji",
      },
    });
    expect(fromEnv.exitCode).toBe(0);
    expect(fromEnv.stdout).toEqual(["1"]);

    const fromCli = await captureCli(
      ["--format", "raw", "--total-of", "words", "Hello there 👋!"],
      {
        cwd,
        env: {
          ...baseEnv,
          WORD_COUNTER_TOTAL_OF: "emoji",
        },
      },
    );
    expect(fromCli.exitCode).toBe(0);
    expect(fromCli.stdout).toEqual(["2"]);
  });

  test("uses root detector config for counting when no detector flag is provided", async () => {
    if (!hasWasmDetectorRuntime()) {
      return;
    }

    const cwd = await makeTempFixture("count-detector-config");
    await writeTomlConfig(cwd, ['detector = "wasm"']);

    const output = await captureCli(
      [
        "--format",
        "raw",
        "--debug",
        "--detector-evidence",
        "This sentence should clearly be detected as English for the wasm detector path.",
      ],
      { cwd },
    );

    expect(output.exitCode).toBe(0);
    expect(findDebugEvents(output.stderr, "detector.window.evidence")).toHaveLength(1);
  });

  test("applies root contentGate.mode from config to counting when the CLI does not override it", async () => {
    if (!hasWasmDetectorRuntime()) {
      return;
    }

    const cwd = await makeTempFixture("count-content-gate-config");
    await writeTomlConfig(cwd, ['detector = "wasm"', "", "[contentGate]", 'mode = "strict"']);

    const output = await captureCli(
      ["--format", "raw", "--debug", "--detector-evidence", defaultEligibleStrictNotEligibleText],
      { cwd },
    );

    expect(output.exitCode).toBe(0);
    const evidence = findDebugEvents(output.stderr, "detector.window.evidence")[0];
    expect(evidence?.contentGate).toEqual({
      applied: true,
      passed: false,
      policy: "latinProse",
      mode: "strict",
    });
  });

  test("lets WORD_COUNTER_CONTENT_GATE override config for counting", async () => {
    if (!hasWasmDetectorRuntime()) {
      return;
    }

    const cwd = await makeTempFixture("count-content-gate-env");
    await writeTomlConfig(cwd, ['detector = "wasm"', "", "[contentGate]", 'mode = "strict"']);

    const output = await captureCli(
      ["--format", "raw", "--debug", "--detector-evidence", defaultEligibleStrictNotEligibleText],
      {
        cwd,
        env: {
          WORD_COUNTER_CONTENT_GATE: "off",
        },
      },
    );

    expect(output.exitCode).toBe(0);
    const evidence = findDebugEvents(output.stderr, "detector.window.evidence")[0];
    expect(evidence?.contentGate).toEqual({
      applied: false,
      passed: true,
      policy: "none",
      mode: "off",
    });
  });

  test("keeps --content-gate as the highest-precedence override for counting", async () => {
    if (!hasWasmDetectorRuntime()) {
      return;
    }

    const cwd = await makeTempFixture("count-content-gate-cli");
    await writeTomlConfig(cwd, ['detector = "wasm"', "", "[contentGate]", 'mode = "strict"']);

    const output = await captureCli(
      [
        "--content-gate",
        "loose",
        "--format",
        "raw",
        "--debug",
        "--detector-evidence",
        defaultEligibleStrictNotEligibleText,
      ],
      {
        cwd,
        env: {
          WORD_COUNTER_CONTENT_GATE: "off",
        },
      },
    );

    expect(output.exitCode).toBe(0);
    const evidence = findDebugEvents(output.stderr, "detector.window.evidence")[0];
    expect(evidence?.contentGate).toEqual({
      applied: true,
      passed: true,
      policy: "latinProse",
      mode: "loose",
    });
  });

  test("accepts -d as a detector alias on the counting CLI", async () => {
    const output = await captureCli(["-d", "regex", "--format", "json", "Hello world"]);

    expect(output.exitCode).toBe(0);
    expect(JSON.parse(output.stdout[0] ?? "{}")).toMatchObject({ total: 2 });
  });
});
