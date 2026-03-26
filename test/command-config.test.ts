import { describe, expect, test } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createCliHarness } from "./support/cli-harness";
import { hasWasmDetectorRuntime } from "./support/wasm-detector-runtime";

const { captureCli, findDebugEvents, makeTempFixture } = createCliHarness();

describe("CLI config precedence and detector defaults", () => {
  const defaultEligibleStrictNotEligibleText = "Readers understand the feature.";
  const inspectContentGateText = [
    "mode: debug",
    "tee: true",
    "path: logs",
    "Use this for testing.",
  ].join("\n");

  test("lets cwd config override user config, env override cwd config, and CLI override env", async () => {
    const root = await makeTempFixture("cli-config-precedence");
    const userConfigDir = join(root, "user-config");
    const cwd = join(root, "project");
    await mkdir(userConfigDir);
    await mkdir(cwd);

    await writeFile(
      join(userConfigDir, "wc-intl-seg.config.json"),
      JSON.stringify({
        output: {
          totalOf: ["punctuation"],
        },
      }),
    );
    await writeFile(
      join(cwd, "wc-intl-seg.config.toml"),
      ["[output]", 'totalOf = ["words", "emoji"]'].join("\n"),
    );

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

  test("uses inspect.detector from config as an inspect-only override", async () => {
    const cwd = await makeTempFixture("inspect-detector-config");
    await writeFile(
      join(cwd, "wc-intl-seg.config.toml"),
      ['detector = "wasm"', "", "[inspect]", 'detector = "regex"'].join("\n"),
    );

    const output = await captureCli(
      ["inspect", "--format", "json", "こんにちは、世界！これはテストです。"],
      { cwd },
    );

    expect(output.exitCode).toBe(0);
    const parsed = JSON.parse(output.stdout[0] ?? "{}");
    expect(parsed.detector).toBe("regex");
    expect(parsed.view).toBe("pipeline");
  });

  test("uses root detector config for counting when no detector flag is provided", async () => {
    if (!hasWasmDetectorRuntime()) {
      return;
    }

    const cwd = await makeTempFixture("count-detector-config");
    await writeFile(join(cwd, "wc-intl-seg.config.toml"), 'detector = "wasm"\n');

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

  test("lets inspect inherit the root detector from config when inspect.detector is absent", async () => {
    if (!hasWasmDetectorRuntime()) {
      return;
    }

    const cwd = await makeTempFixture("inspect-root-detector-config");
    await writeFile(join(cwd, "wc-intl-seg.config.toml"), 'detector = "wasm"\n');

    const output = await captureCli(
      ["inspect", "--format", "json", "こんにちは、世界！これはテストです。"],
      { cwd },
    );

    expect(output.exitCode).toBe(0);
    const parsed = JSON.parse(output.stdout[0] ?? "{}");
    expect(parsed.detector).toBe("wasm");
  });

  test("applies root contentGate.mode from config to counting when the CLI does not override it", async () => {
    if (!hasWasmDetectorRuntime()) {
      return;
    }

    const cwd = await makeTempFixture("count-content-gate-config");
    await writeFile(
      join(cwd, "wc-intl-seg.config.toml"),
      ['detector = "wasm"', "", "[contentGate]", 'mode = "strict"'].join("\n"),
    );

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
    await writeFile(
      join(cwd, "wc-intl-seg.config.toml"),
      ['detector = "wasm"', "", "[contentGate]", 'mode = "strict"'].join("\n"),
    );

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
    await writeFile(
      join(cwd, "wc-intl-seg.config.toml"),
      ['detector = "wasm"', "", "[contentGate]", 'mode = "strict"'].join("\n"),
    );

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

  test("lets inspect inherit root contentGate.mode when inspect.contentGate.mode is absent", async () => {
    if (!hasWasmDetectorRuntime()) {
      return;
    }

    const cwd = await makeTempFixture("inspect-root-content-gate-config");
    await writeFile(
      join(cwd, "wc-intl-seg.config.toml"),
      ['detector = "wasm"', "", "[contentGate]", 'mode = "strict"'].join("\n"),
    );

    const output = await captureCli(["inspect", "--format", "json", inspectContentGateText], {
      cwd,
    });

    expect(output.exitCode).toBe(0);
    const parsed = JSON.parse(output.stdout[0] ?? "{}");
    expect(parsed.detector).toBe("wasm");
    expect(parsed.windows?.[0]?.contentGate).toEqual({
      applied: true,
      passed: false,
      policy: "latinProse",
      mode: "strict",
    });
  });

  test("lets WORD_COUNTER_CONTENT_GATE override inspect-specific config defaults", async () => {
    if (!hasWasmDetectorRuntime()) {
      return;
    }

    const cwd = await makeTempFixture("inspect-content-gate-env");
    await writeFile(
      join(cwd, "wc-intl-seg.config.toml"),
      [
        'detector = "wasm"',
        "",
        "[contentGate]",
        'mode = "strict"',
        "",
        "[inspect.contentGate]",
        'mode = "off"',
      ].join("\n"),
    );

    const output = await captureCli(["inspect", "--format", "json", inspectContentGateText], {
      cwd,
      env: {
        WORD_COUNTER_CONTENT_GATE: "loose",
      },
    });

    expect(output.exitCode).toBe(0);
    const parsed = JSON.parse(output.stdout[0] ?? "{}");
    expect(parsed.windows?.[0]?.contentGate).toEqual({
      applied: true,
      passed: true,
      policy: "latinProse",
      mode: "loose",
    });
  });

  test("lets inspect.contentGate.mode override the root content gate without changing counting defaults", async () => {
    if (!hasWasmDetectorRuntime()) {
      return;
    }

    const cwd = await makeTempFixture("inspect-content-gate-override-config");
    await writeFile(
      join(cwd, "wc-intl-seg.config.toml"),
      [
        'detector = "wasm"',
        "",
        "[contentGate]",
        'mode = "strict"',
        "",
        "[inspect.contentGate]",
        'mode = "off"',
      ].join("\n"),
    );

    const inspectOutput = await captureCli(["inspect", "--format", "json", inspectContentGateText], {
      cwd,
    });
    const countOutput = await captureCli(
      ["--format", "raw", "--debug", "--detector-evidence", defaultEligibleStrictNotEligibleText],
      { cwd },
    );

    expect(inspectOutput.exitCode).toBe(0);
    expect(countOutput.exitCode).toBe(0);
    const inspectParsed = JSON.parse(inspectOutput.stdout[0] ?? "{}");
    expect(inspectParsed.windows?.[0]?.contentGate).toEqual({
      applied: false,
      passed: true,
      policy: "none",
      mode: "off",
    });
    const countEvidence = findDebugEvents(countOutput.stderr, "detector.window.evidence")[0];
    expect(countEvidence?.contentGate).toEqual({
      applied: true,
      passed: false,
      policy: "latinProse",
      mode: "strict",
    });
  });

  test("keeps inspect --content-gate as the highest-precedence override over env and config", async () => {
    if (!hasWasmDetectorRuntime()) {
      return;
    }

    const cwd = await makeTempFixture("inspect-content-gate-cli");
    await writeFile(
      join(cwd, "wc-intl-seg.config.toml"),
      [
        'detector = "wasm"',
        "",
        "[contentGate]",
        'mode = "strict"',
        "",
        "[inspect.contentGate]",
        'mode = "off"',
      ].join("\n"),
    );

    const output = await captureCli(
      ["inspect", "--content-gate", "strict", "--format", "json", inspectContentGateText],
      {
        cwd,
        env: {
          WORD_COUNTER_CONTENT_GATE: "loose",
        },
      },
    );

    expect(output.exitCode).toBe(0);
    const parsed = JSON.parse(output.stdout[0] ?? "{}");
    expect(parsed.windows?.[0]?.contentGate).toEqual({
      applied: true,
      passed: false,
      policy: "latinProse",
      mode: "strict",
    });
  });

  test("keeps inspect.detector = regex incompatible with engine view", async () => {
    const cwd = await makeTempFixture("inspect-detector-engine-validation");
    await writeFile(
      join(cwd, "wc-intl-seg.config.toml"),
      ['detector = "wasm"', "", "[inspect]", 'detector = "regex"'].join("\n"),
    );

    const output = await captureCli(["inspect", "--view", "engine", "Hello world"], { cwd });

    expect(output.exitCode).toBe(1);
    expect(
      output.stderr.some((line) => line.includes("`--view engine` requires `--detector wasm`.")),
    ).toBeTrue();
  });

  test("accepts -d as a detector alias on the counting CLI", async () => {
    const output = await captureCli(["-d", "regex", "--format", "json", "Hello world"]);

    expect(output.exitCode).toBe(0);
    expect(JSON.parse(output.stdout[0] ?? "{}")).toMatchObject({ total: 2 });
  });

  test("accepts -d as a detector alias on inspect", async () => {
    const output = await captureCli([
      "inspect",
      "-d",
      "regex",
      "--format",
      "json",
      "こんにちは、世界！これはテストです。",
    ]);

    expect(output.exitCode).toBe(0);
    const parsed = JSON.parse(output.stdout[0] ?? "{}");
    expect(parsed.detector).toBe("regex");
  });

  test("defaults inspect to regex when no detector source overrides it", async () => {
    const output = await captureCli([
      "inspect",
      "--format",
      "json",
      "こんにちは、世界！これはテストです。",
    ]);

    expect(output.exitCode).toBe(0);
    const parsed = JSON.parse(output.stdout[0] ?? "{}");
    expect(parsed.detector).toBe("regex");
  });

  test("surfaces a warning when lower-priority sibling config files are ignored", async () => {
    const cwd = await makeTempFixture("config-sibling-warning");
    await writeFile(
      join(cwd, "wc-intl-seg.config.toml"),
      ["[output]", 'totalOf = ["emoji"]'].join("\n"),
    );
    await writeFile(
      join(cwd, "wc-intl-seg.config.json"),
      JSON.stringify({
        output: {
          totalOf: ["words"],
        },
      }),
    );

    const output = await captureCli(["--format", "raw", "Hello there 👋!"], { cwd });

    expect(output.exitCode).toBe(0);
    expect(output.stdout).toEqual(["1"]);
    expect(
      output.stderr.some((line) => line.includes("Ignoring lower-priority sibling config files")),
    ).toBeTrue();
  });

  test("respects path.detectBinary = false for inspect path inputs", async () => {
    const cwd = await makeTempFixture("inspect-detect-binary-config");
    await writeFile(
      join(cwd, "wc-intl-seg.config.toml"),
      ["[path]", "detectBinary = false"].join("\n"),
    );
    const filePath = join(cwd, "sample.bin");
    await writeFile(filePath, Buffer.from([0x00, 0x41, 0x20, 0x42]));

    const output = await captureCli(["inspect", "-p", filePath, "--format", "json"], { cwd });

    expect(output.exitCode).toBe(0);
    const parsed = JSON.parse(output.stdout[0] ?? "{}");
    expect(parsed.input.path).toBe(filePath);
  });

  test("respects path.detectBinary = false for counting path inputs across jobs modes", async () => {
    const cwd = await makeTempFixture("count-detect-binary-config");
    await writeFile(
      join(cwd, "wc-intl-seg.config.toml"),
      ["[path]", "detectBinary = false"].join("\n"),
    );
    const filePath = join(cwd, "sample.bin");
    await writeFile(filePath, Buffer.from([0x00, 0x41, 0x20, 0x42]));

    const asyncOutput = await captureCli(["--path", filePath, "--format", "json"], { cwd });
    const jobsOutput = await captureCli(["--path", filePath, "--format", "json", "--jobs", "2"], {
      cwd,
    });

    expect(asyncOutput.exitCode).toBe(0);
    expect(jobsOutput.exitCode).toBe(0);
    expect(JSON.parse(asyncOutput.stdout[0] ?? "{}").total).toBe(2);
    expect(JSON.parse(jobsOutput.stdout[0] ?? "{}").total).toBe(2);
  });
});
