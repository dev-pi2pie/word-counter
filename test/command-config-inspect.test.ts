import { describe, expect, test } from "bun:test";
import { createCliHarness } from "./support/cli-harness";
import { writeTomlConfig } from "./support/config-fixtures";
import { hasWasmDetectorRuntime } from "./support/wasm-detector-runtime";

const { captureCli, findDebugEvents, makeTempFixture } = createCliHarness();

describe("CLI inspect config overrides and defaults", () => {
  const defaultEligibleStrictNotEligibleText = "Readers understand the feature.";
  const inspectContentGateText = [
    "mode: debug",
    "tee: true",
    "path: logs",
    "Use this for testing.",
  ].join("\n");

  test("uses inspect.detector from config as an inspect-only override", async () => {
    const cwd = await makeTempFixture("inspect-detector-config");
    await writeTomlConfig(cwd, ['detector = "wasm"', "", "[inspect]", 'detector = "regex"']);

    const output = await captureCli(
      ["inspect", "--format", "json", "こんにちは、世界！これはテストです。"],
      { cwd },
    );

    expect(output.exitCode).toBe(0);
    const parsed = JSON.parse(output.stdout[0] ?? "{}");
    expect(parsed.detector).toBe("regex");
    expect(parsed.view).toBe("pipeline");
  });

  test("lets inspect inherit the root detector from config when inspect.detector is absent", async () => {
    if (!hasWasmDetectorRuntime()) {
      return;
    }

    const cwd = await makeTempFixture("inspect-root-detector-config");
    await writeTomlConfig(cwd, ['detector = "wasm"']);

    const output = await captureCli(
      ["inspect", "--format", "json", "こんにちは、世界！これはテストです。"],
      { cwd },
    );

    expect(output.exitCode).toBe(0);
    const parsed = JSON.parse(output.stdout[0] ?? "{}");
    expect(parsed.detector).toBe("wasm");
  });

  test("allows inspect --view engine when root detector = wasm comes from config", async () => {
    if (!hasWasmDetectorRuntime()) {
      return;
    }

    const cwd = await makeTempFixture("inspect-engine-root-detector-config");
    await writeTomlConfig(cwd, ['detector = "wasm"']);

    const output = await captureCli(
      ["inspect", "--view", "engine", "--format", "json", "こんにちは、世界！これはテストです。"],
      { cwd },
    );

    expect(output.exitCode).toBe(0);
    const parsed = JSON.parse(output.stdout[0] ?? "{}");
    expect(parsed.detector).toBe("wasm");
    expect(parsed.view).toBe("engine");
  });

  test("lets inspect inherit root contentGate.mode when inspect.contentGate.mode is absent", async () => {
    if (!hasWasmDetectorRuntime()) {
      return;
    }

    const cwd = await makeTempFixture("inspect-root-content-gate-config");
    await writeTomlConfig(cwd, ['detector = "wasm"', "", "[contentGate]", 'mode = "strict"']);

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
    await writeTomlConfig(cwd, [
      'detector = "wasm"',
      "",
      "[contentGate]",
      'mode = "strict"',
      "",
      "[inspect.contentGate]",
      'mode = "off"',
    ]);

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
    await writeTomlConfig(cwd, [
      'detector = "wasm"',
      "",
      "[contentGate]",
      'mode = "strict"',
      "",
      "[inspect.contentGate]",
      'mode = "off"',
    ]);

    const inspectOutput = await captureCli(
      ["inspect", "--format", "json", inspectContentGateText],
      {
        cwd,
      },
    );
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
    await writeTomlConfig(cwd, [
      'detector = "wasm"',
      "",
      "[contentGate]",
      'mode = "strict"',
      "",
      "[inspect.contentGate]",
      'mode = "off"',
    ]);

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
    await writeTomlConfig(cwd, ['detector = "wasm"', "", "[inspect]", 'detector = "regex"']);

    const output = await captureCli(["inspect", "--view", "engine", "Hello world"], { cwd });

    expect(output.exitCode).toBe(1);
    expect(
      output.stderr.some((line) => line.includes("`--view engine` requires `--detector wasm`.")),
    ).toBeTrue();
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
});
