import { describe, expect, test } from "bun:test";
import { chmod, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createCliHarness } from "./support/cli-harness";
import { hasWasmDetectorRuntime } from "./support/wasm-detector-runtime";

const { captureCli, makeTempFixture } = createCliHarness();

describe("inspect command", () => {
  const defaultEligibleStrictNotEligibleText = "Readers understand the feature.";
  const defaultNotEligibleLooseEligibleText = "Users understand this now.";
  const shortHaniText = "世界";
  const idiomLengthHaniText = "四字成語";
  const borrowedShortHaniText = "こんにちは、世界！";
  const borrowedLongHaniText = "こんにちは、世界！これはテストです。";

  test("supports default regex pipeline inspection", async () => {
    const output = await captureCli(["inspect", "こんにちは、世界！これはテストです。"]);

    expect(output.exitCode).toBe(0);
    expect(output.stdout).toContain("Detector inspect");
    expect(output.stdout).toContain("View: pipeline");
    expect(output.stdout).toContain("Detector: regex");
  });

  test("supports wasm engine inspection", async () => {
    if (!hasWasmDetectorRuntime()) {
      return;
    }

    const output = await captureCli([
      "inspect",
      "--detector",
      "wasm",
      "--view",
      "engine",
      "こんにちは、世界！これはテストです。",
    ]);

    expect(output.exitCode).toBe(0);
    expect(output.stdout).toContain("View: engine");
    expect(output.stdout.some((line) => line.includes("Route tag: und-Hani"))).toBeTrue();
  });

  test("does not emit an engine-view info note for inherited default content-gate mode", async () => {
    if (!hasWasmDetectorRuntime()) {
      return;
    }

    const output = await captureCli([
      "inspect",
      "--detector",
      "wasm",
      "--view",
      "engine",
      "This sentence should clearly be detected as English for the wasm detector path.",
    ]);

    expect(output.exitCode).toBe(0);
    expect(
      output.stderr.some(
        (line) =>
          line.includes("Info:") && line.includes("does not affect `inspect --view engine`"),
      ),
    ).toBeFalse();
  });

  test("emits an engine-view info note for explicit --content-gate default", async () => {
    if (!hasWasmDetectorRuntime()) {
      return;
    }

    const output = await captureCli([
      "inspect",
      "--detector",
      "wasm",
      "--view",
      "engine",
      "--content-gate",
      "default",
      "This sentence should clearly be detected as English for the wasm detector path.",
    ]);

    expect(output.exitCode).toBe(0);
    expect(
      output.stderr.filter(
        (line) =>
          line.includes("Info:") && line.includes("does not affect `inspect --view engine`"),
      ),
    ).toHaveLength(1);
    expect(
      output.stderr.some(
        (line) =>
          line.includes("Info:") && line.includes("Use `--view pipeline` to inspect eligibility"),
      ),
    ).toBeTrue();
  });

  test("keeps engine-view JSON output on stdout while emitting the info note on stderr", async () => {
    if (!hasWasmDetectorRuntime()) {
      return;
    }

    const output = await captureCli([
      "inspect",
      "--detector",
      "wasm",
      "--view",
      "engine",
      "--content-gate",
      "strict",
      "--format",
      "json",
      "Readers understand this behavior.",
    ]);

    expect(output.exitCode).toBe(0);
    expect(output.stdout.length).toBe(1);
    expect(output.stdout[0]?.includes("does not affect `inspect --view engine`")).toBeFalse();
    expect(
      output.stderr.filter(
        (line) =>
          line.includes("Info:") && line.includes("does not affect `inspect --view engine`"),
      ),
    ).toHaveLength(1);
    const parsed = JSON.parse(output.stdout[0] ?? "{}");
    expect(parsed.view).toBe("engine");
    expect(parsed.detector).toBe("wasm");
  });

  test("bounds standard engine inspection output to previews", async () => {
    if (!hasWasmDetectorRuntime()) {
      return;
    }

    const root = await makeTempFixture("inspect-engine-preview");
    const filePath = join(root, "large.txt");
    const longText =
      "This sentence should clearly be detected as English for the wasm detector path. ".repeat(8);
    await writeFile(filePath, longText);

    const output = await captureCli([
      "inspect",
      "--detector",
      "wasm",
      "--view",
      "engine",
      "--path",
      filePath,
    ]);

    expect(output.exitCode).toBe(0);
    expect(output.stdout.some((line) => line.startsWith("Sample text preview: "))).toBeTrue();
    expect(output.stdout.some((line) => line === "Sample text truncated: true")).toBeTrue();
    expect(output.stdout.some((line) => line.includes(longText))).toBeFalse();
  });

  test("supports regex pipeline inspection in json format", async () => {
    const output = await captureCli([
      "inspect",
      "--detector",
      "regex",
      "--view",
      "pipeline",
      "--format",
      "json",
      "こんにちは、世界！これはテストです。",
    ]);

    expect(output.exitCode).toBe(0);
    const parsed = JSON.parse(output.stdout[0] ?? "{}");
    expect(parsed.detector).toBe("regex");
    expect(parsed.view).toBe("pipeline");
    expect(parsed.chunks[1]?.reason).toBe("han-fallback-after-boundary");
    expect(parsed.windows).toBeUndefined();
  });

  test("supports inspect --path for one regular file", async () => {
    const root = await makeTempFixture("inspect-path");
    const filePath = join(root, "sample.txt");
    await writeFile(filePath, "Hello world");

    const output = await captureCli([
      "inspect",
      "--detector",
      "regex",
      "--format",
      "json",
      "--path",
      filePath,
    ]);

    expect(output.exitCode).toBe(0);
    const parsed = JSON.parse(output.stdout[0] ?? "{}");
    expect(parsed.input.sourceType).toBe("path");
    expect(parsed.input.path).toBe(filePath);
  });

  test("supports inspect -p alias for one regular file", async () => {
    const root = await makeTempFixture("inspect-path-alias");
    const filePath = join(root, "sample.txt");
    await writeFile(filePath, "Hello world");

    const output = await captureCli([
      "inspect",
      "--detector",
      "regex",
      "--format",
      "json",
      "-p",
      filePath,
    ]);

    expect(output.exitCode).toBe(0);
    const parsed = JSON.parse(output.stdout[0] ?? "{}");
    expect(parsed.input.sourceType).toBe("path");
    expect(parsed.input.path).toBe(filePath);
  });

  test("supports inspect -f alias for json output", async () => {
    const output = await captureCli([
      "inspect",
      "--detector",
      "regex",
      "-f",
      "json",
      "こんにちは、世界！これはテストです。",
    ]);

    expect(output.exitCode).toBe(0);
    const parsed = JSON.parse(output.stdout[0] ?? "{}");
    expect(parsed.detector).toBe("regex");
    expect(parsed.view).toBe("pipeline");
  });

  test("supports inspect --format json --pretty for single input", async () => {
    const output = await captureCli([
      "inspect",
      "--detector",
      "regex",
      "--format",
      "json",
      "--pretty",
      "こんにちは、世界！これはテストです。",
    ]);

    expect(output.exitCode).toBe(0);
    expect(output.stdout.length).toBe(1);
    expect(output.stdout[0]).toContain('\n  "detector": "regex"');
    const parsed = JSON.parse(output.stdout[0] ?? "{}");
    expect(parsed.detector).toBe("regex");
    expect(parsed.view).toBe("pipeline");
  });

  test("supports inspect --content-gate for explicit mode selection", async () => {
    const output = await captureCli([
      "inspect",
      "--detector",
      "regex",
      "--content-gate",
      "loose",
      "--format",
      "json",
      "こんにちは、世界！これはテストです。",
    ]);

    expect(output.exitCode).toBe(0);
    const parsed = JSON.parse(output.stdout[0] ?? "{}");
    expect(parsed.detector).toBe("regex");
    expect(parsed.view).toBe("pipeline");
  });

  test("threads inspect --content-gate into wasm pipeline evaluation", async () => {
    if (!hasWasmDetectorRuntime()) {
      return;
    }

    const output = await captureCli([
      "inspect",
      "--detector",
      "wasm",
      "--content-gate",
      "off",
      "--format",
      "json",
      ["mode: debug", "tee: true", "path: logs", "Use this for testing."].join("\n"),
    ]);

    expect(output.exitCode).toBe(0);
    const parsed = JSON.parse(output.stdout[0] ?? "{}");
    expect(parsed.windows?.[0]?.contentGate).toEqual({
      applied: false,
      passed: true,
      policy: "none",
      mode: "off",
    });
  });

  test("shows configured content gate mode in standard inspect output", async () => {
    if (!hasWasmDetectorRuntime()) {
      return;
    }

    const output = await captureCli([
      "inspect",
      "--detector",
      "wasm",
      "--content-gate",
      "off",
      ["mode: debug", "tee: true", "path: logs", "Use this for testing."].join("\n"),
    ]);

    expect(output.exitCode).toBe(0);
    expect(
      output.stdout.some((line) =>
        line.includes("Content gate: mode=off policy=none applied=false passed=true"),
      ),
    ).toBeTrue();
  });

  test("emits the engine-view info note once per batch inspect invocation", async () => {
    if (!hasWasmDetectorRuntime()) {
      return;
    }

    const root = await makeTempFixture("inspect-engine-content-gate-batch-note");
    const firstPath = join(root, "a.txt");
    const secondPath = join(root, "b.txt");
    const text = "This sentence should clearly be detected as English for the wasm detector path.";
    await writeFile(firstPath, text);
    await writeFile(secondPath, text);

    const output = await captureCli([
      "inspect",
      "--detector",
      "wasm",
      "--view",
      "engine",
      "--content-gate",
      "off",
      "--format",
      "json",
      "--path",
      firstPath,
      "--path",
      secondPath,
    ]);

    expect(output.exitCode).toBe(0);
    expect(
      output.stderr.filter(
        (line) =>
          line.includes("Info:") && line.includes("does not affect `inspect --view engine`"),
      ),
    ).toHaveLength(1);
    const parsed = JSON.parse(output.stdout[0] ?? "{}");
    expect(parsed.kind).toBe("detector-inspect-batch");
    expect(parsed.files).toHaveLength(2);
  });

  test("shows strict inspect eligibility and content gate details in standard output", async () => {
    if (!hasWasmDetectorRuntime()) {
      return;
    }

    const output = await captureCli([
      "inspect",
      "--detector",
      "wasm",
      "--content-gate",
      "strict",
      defaultEligibleStrictNotEligibleText,
    ]);

    expect(output.exitCode).toBe(0);
    expect(
      output.stdout.some((line) => line.includes("Eligibility: 27/30 passed=false")),
    ).toBeTrue();
    expect(
      output.stdout.some((line) =>
        line.includes("Content gate: mode=strict policy=latinProse applied=true passed=false"),
      ),
    ).toBeTrue();
  });

  test("raises Latin eligibility thresholds for strict inspect mode", async () => {
    if (!hasWasmDetectorRuntime()) {
      return;
    }

    const defaultOutput = await captureCli([
      "inspect",
      "--detector",
      "wasm",
      "--format",
      "json",
      defaultEligibleStrictNotEligibleText,
    ]);
    const strictOutput = await captureCli([
      "inspect",
      "--detector",
      "wasm",
      "--content-gate",
      "strict",
      "--format",
      "json",
      defaultEligibleStrictNotEligibleText,
    ]);

    expect(defaultOutput.exitCode).toBe(0);
    expect(strictOutput.exitCode).toBe(0);
    const defaultParsed = JSON.parse(defaultOutput.stdout[0] ?? "{}");
    const strictParsed = JSON.parse(strictOutput.stdout[0] ?? "{}");
    expect(defaultParsed.windows?.[0]?.eligibility).toEqual({
      scriptChars: 27,
      minScriptChars: 24,
      passed: true,
    });
    expect(defaultParsed.windows?.[0]?.engine).toEqual({
      executed: true,
    });
    expect(strictParsed.windows?.[0]?.eligibility).toEqual({
      scriptChars: 27,
      minScriptChars: 30,
      passed: false,
    });
    expect(strictParsed.windows?.[0]?.engine).toEqual({
      executed: false,
      reason: "notEligible",
    });
    expect(strictParsed.windows?.[0]?.decision?.fallbackReason).toBe("notEligible");
  });

  test("lowers Latin eligibility thresholds for loose inspect mode while keeping off on default thresholds", async () => {
    if (!hasWasmDetectorRuntime()) {
      return;
    }

    const defaultOutput = await captureCli([
      "inspect",
      "--detector",
      "wasm",
      "--format",
      "json",
      defaultNotEligibleLooseEligibleText,
    ]);
    const looseOutput = await captureCli([
      "inspect",
      "--detector",
      "wasm",
      "--content-gate",
      "loose",
      "--format",
      "json",
      defaultNotEligibleLooseEligibleText,
    ]);
    const offOutput = await captureCli([
      "inspect",
      "--detector",
      "wasm",
      "--content-gate",
      "off",
      "--format",
      "json",
      defaultNotEligibleLooseEligibleText,
    ]);

    expect(defaultOutput.exitCode).toBe(0);
    expect(looseOutput.exitCode).toBe(0);
    expect(offOutput.exitCode).toBe(0);
    const defaultParsed = JSON.parse(defaultOutput.stdout[0] ?? "{}");
    const looseParsed = JSON.parse(looseOutput.stdout[0] ?? "{}");
    const offParsed = JSON.parse(offOutput.stdout[0] ?? "{}");
    expect(defaultParsed.windows?.[0]?.eligibility).toEqual({
      scriptChars: 22,
      minScriptChars: 24,
      passed: false,
    });
    expect(looseParsed.windows?.[0]?.eligibility).toEqual({
      scriptChars: 22,
      minScriptChars: 20,
      passed: true,
    });
    expect(looseParsed.windows?.[0]?.engine).toEqual({
      executed: true,
    });
    expect(offParsed.windows?.[0]?.eligibility).toEqual({
      scriptChars: 22,
      minScriptChars: 24,
      passed: false,
    });
    expect(offParsed.windows?.[0]?.contentGate).toEqual({
      applied: false,
      passed: true,
      policy: "none",
      mode: "off",
    });
  });

  test("shows loose inspect eligibility and content gate details in standard output", async () => {
    if (!hasWasmDetectorRuntime()) {
      return;
    }

    const output = await captureCli([
      "inspect",
      "--detector",
      "wasm",
      "--content-gate",
      "loose",
      defaultNotEligibleLooseEligibleText,
    ]);

    expect(output.exitCode).toBe(0);
    expect(
      output.stdout.some((line) => line.includes("Eligibility: 22/20 passed=true")),
    ).toBeTrue();
    expect(
      output.stdout.some((line) =>
        line.includes("Content gate: mode=loose policy=latinProse applied=true passed=true"),
      ),
    ).toBeTrue();
  });

  test("shows Hani loose idiom eligibility in inspect json output", async () => {
    if (!hasWasmDetectorRuntime()) {
      return;
    }

    const defaultOutput = await captureCli([
      "inspect",
      "--detector",
      "wasm",
      "--format",
      "json",
      idiomLengthHaniText,
    ]);
    const looseOutput = await captureCli([
      "inspect",
      "--detector",
      "wasm",
      "--content-gate",
      "loose",
      "--format",
      "json",
      idiomLengthHaniText,
    ]);
    const offOutput = await captureCli([
      "inspect",
      "--detector",
      "wasm",
      "--content-gate",
      "off",
      "--format",
      "json",
      idiomLengthHaniText,
    ]);

    expect(defaultOutput.exitCode).toBe(0);
    expect(looseOutput.exitCode).toBe(0);
    expect(offOutput.exitCode).toBe(0);
    const defaultParsed = JSON.parse(defaultOutput.stdout[0] ?? "{}");
    const looseParsed = JSON.parse(looseOutput.stdout[0] ?? "{}");
    const offParsed = JSON.parse(offOutput.stdout[0] ?? "{}");
    expect(defaultParsed.windows?.[0]?.eligibility).toEqual({
      scriptChars: 4,
      minScriptChars: 12,
      passed: false,
    });
    expect(looseParsed.windows?.[0]?.eligibility).toEqual({
      scriptChars: 4,
      minScriptChars: 4,
      passed: true,
    });
    expect(offParsed.windows?.[0]?.eligibility).toEqual({
      scriptChars: 4,
      minScriptChars: 12,
      passed: false,
    });
    expect(looseParsed.windows?.[0]?.contentGate).toEqual({
      applied: false,
      passed: true,
      policy: "none",
      mode: "loose",
    });
  });

  test("shows Hani loose idiom eligibility in standard inspect output", async () => {
    if (!hasWasmDetectorRuntime()) {
      return;
    }

    const output = await captureCli([
      "inspect",
      "--detector",
      "wasm",
      "--content-gate",
      "loose",
      idiomLengthHaniText,
    ]);

    expect(output.exitCode).toBe(0);
    expect(output.stdout.some((line) => line.includes("Eligibility: 4/4 passed=true"))).toBeTrue();
    expect(
      output.stdout.some((line) =>
        line.includes("Content gate: mode=loose policy=none applied=false passed=true"),
      ),
    ).toBeTrue();
  });

  test("keeps short Hani windows ineligible across all inspect modes", async () => {
    if (!hasWasmDetectorRuntime()) {
      return;
    }

    const defaultOutput = await captureCli([
      "inspect",
      "--detector",
      "wasm",
      "--format",
      "json",
      shortHaniText,
    ]);
    const strictOutput = await captureCli([
      "inspect",
      "--detector",
      "wasm",
      "--content-gate",
      "strict",
      "--format",
      "json",
      shortHaniText,
    ]);
    const looseOutput = await captureCli([
      "inspect",
      "--detector",
      "wasm",
      "--content-gate",
      "loose",
      "--format",
      "json",
      shortHaniText,
    ]);
    const offOutput = await captureCli([
      "inspect",
      "--detector",
      "wasm",
      "--content-gate",
      "off",
      "--format",
      "json",
      shortHaniText,
    ]);

    const parsedResults = [defaultOutput, strictOutput, looseOutput, offOutput].map((output) =>
      JSON.parse(output.stdout[0] ?? "{}"),
    );
    const expectedModes = ["default", "strict", "loose", "off"] as const;
    for (const [index, parsed] of parsedResults.entries()) {
      expect(parsed.windows?.[0]?.contentGate.policy).toBe("none");
      expect(parsed.windows?.[0]?.contentGate.applied).toBe(false);
      expect(parsed.windows?.[0]?.contentGate.mode).toBe(expectedModes[index]);
      expect(parsed.windows?.[0]?.engine).toEqual({
        executed: false,
        reason: "notEligible",
      });
    }
    expect(parsedResults[0].windows?.[0]?.eligibility).toEqual({
      scriptChars: 2,
      minScriptChars: 12,
      passed: false,
    });
    expect(parsedResults[1].windows?.[0]?.eligibility).toEqual({
      scriptChars: 2,
      minScriptChars: 16,
      passed: false,
    });
    expect(parsedResults[2].windows?.[0]?.eligibility).toEqual({
      scriptChars: 2,
      minScriptChars: 4,
      passed: false,
    });
    expect(parsedResults[3].windows?.[0]?.eligibility).toEqual({
      scriptChars: 2,
      minScriptChars: 12,
      passed: false,
    });
  });

  test("keeps borrowed-context Hani inspect output truthful across default strict loose and off", async () => {
    if (!hasWasmDetectorRuntime()) {
      return;
    }

    const borrowedShortLooseOutput = await captureCli([
      "inspect",
      "--detector",
      "wasm",
      "--content-gate",
      "loose",
      "--format",
      "json",
      borrowedShortHaniText,
    ]);
    const borrowedLongDefaultOutput = await captureCli([
      "inspect",
      "--detector",
      "wasm",
      "--format",
      "json",
      borrowedLongHaniText,
    ]);
    const borrowedLongStrictOutput = await captureCli([
      "inspect",
      "--detector",
      "wasm",
      "--content-gate",
      "strict",
      "--format",
      "json",
      borrowedLongHaniText,
    ]);
    const borrowedLongLooseOutput = await captureCli([
      "inspect",
      "--detector",
      "wasm",
      "--content-gate",
      "loose",
      "--format",
      "json",
      borrowedLongHaniText,
    ]);
    const borrowedLongOffOutput = await captureCli([
      "inspect",
      "--detector",
      "wasm",
      "--content-gate",
      "off",
      "--format",
      "json",
      borrowedLongHaniText,
    ]);

    const borrowedShortLooseParsed = JSON.parse(borrowedShortLooseOutput.stdout[0] ?? "{}");
    const borrowedLongDefaultParsed = JSON.parse(borrowedLongDefaultOutput.stdout[0] ?? "{}");
    const borrowedLongStrictParsed = JSON.parse(borrowedLongStrictOutput.stdout[0] ?? "{}");
    const borrowedLongLooseParsed = JSON.parse(borrowedLongLooseOutput.stdout[0] ?? "{}");
    const borrowedLongOffParsed = JSON.parse(borrowedLongOffOutput.stdout[0] ?? "{}");

    expect(borrowedShortLooseParsed.windows?.[0]?.eligibility).toEqual({
      scriptChars: 2,
      minScriptChars: 4,
      passed: false,
    });
    expect(borrowedLongDefaultParsed.windows?.[0]?.eligibility).toEqual({
      scriptChars: 15,
      minScriptChars: 12,
      passed: true,
    });
    expect(borrowedLongDefaultParsed.windows?.[0]?.contentGate).toEqual({
      applied: false,
      passed: true,
      policy: "none",
      mode: "default",
    });
    expect(borrowedLongStrictParsed.windows?.[0]?.eligibility).toEqual({
      scriptChars: 15,
      minScriptChars: 16,
      passed: false,
    });
    expect(borrowedLongStrictParsed.windows?.[0]?.contentGate).toEqual({
      applied: false,
      passed: true,
      policy: "none",
      mode: "strict",
    });
    expect(borrowedLongLooseParsed.windows?.[0]?.eligibility).toEqual({
      scriptChars: 2,
      minScriptChars: 4,
      passed: false,
    });
    expect(borrowedLongLooseParsed.windows?.[0]?.contentGate).toEqual({
      applied: false,
      passed: true,
      policy: "none",
      mode: "loose",
    });
    expect(borrowedLongOffParsed.windows?.[0]?.eligibility).toEqual({
      scriptChars: 15,
      minScriptChars: 12,
      passed: true,
    });
    expect(borrowedLongOffParsed.windows?.[0]?.contentGate).toEqual({
      applied: false,
      passed: true,
      policy: "none",
      mode: "off",
    });
  });

  test("reports configured content gate mode consistently for single and batch inspect", async () => {
    if (!hasWasmDetectorRuntime()) {
      return;
    }

    const root = await makeTempFixture("inspect-content-gate-batch-mode");
    const filePath = join(root, "doc.md");
    await writeFile(filePath, defaultEligibleStrictNotEligibleText);

    const singleOutput = await captureCli([
      "inspect",
      "--detector",
      "wasm",
      "--content-gate",
      "strict",
      "--format",
      "json",
      "--path",
      filePath,
    ]);
    const batchOutput = await captureCli([
      "inspect",
      "--detector",
      "wasm",
      "--content-gate",
      "strict",
      "--format",
      "json",
      "--path",
      root,
    ]);

    expect(singleOutput.exitCode).toBe(0);
    expect(batchOutput.exitCode).toBe(0);
    const singleParsed = JSON.parse(singleOutput.stdout[0] ?? "{}");
    const batchParsed = JSON.parse(batchOutput.stdout[0] ?? "{}");
    expect(singleParsed.windows?.[0]?.contentGate).toEqual({
      applied: true,
      passed: false,
      policy: "latinProse",
      mode: "strict",
    });
    expect(singleParsed.windows?.[0]?.eligibility).toEqual({
      scriptChars: 27,
      minScriptChars: 30,
      passed: false,
    });
    expect(batchParsed.files?.[0]?.result?.windows?.[0]?.contentGate).toEqual({
      applied: true,
      passed: false,
      policy: "latinProse",
      mode: "strict",
    });
    expect(batchParsed.files?.[0]?.result?.windows?.[0]?.eligibility).toEqual({
      scriptChars: 27,
      minScriptChars: 30,
      passed: false,
    });
  });

  test("shows configured content gate mode in standard batch inspect output", async () => {
    if (!hasWasmDetectorRuntime()) {
      return;
    }

    const root = await makeTempFixture("inspect-content-gate-batch-standard");
    await writeFile(
      join(root, "doc.md"),
      ["mode: debug", "tee: true", "path: logs", "Use this for testing."].join("\n"),
    );

    const output = await captureCli([
      "inspect",
      "--detector",
      "wasm",
      "--content-gate",
      "off",
      "--path",
      root,
    ]);

    expect(output.exitCode).toBe(0);
    expect(output.stdout.some((line) => line.startsWith("Detector inspect batch"))).toBeTrue();
    expect(output.stdout.some((line) => line.startsWith("File: "))).toBeTrue();
    expect(
      output.stdout.some((line) =>
        line.includes("Content gate: mode=off policy=none applied=false passed=true"),
      ),
    ).toBeTrue();
  });

  test("returns valid empty inspect result for empty path input", async () => {
    const root = await makeTempFixture("inspect-empty-path");
    const filePath = join(root, "empty.txt");
    await writeFile(filePath, "");

    const output = await captureCli(["inspect", "--format", "json", "--path", filePath]);

    expect(output.exitCode).toBe(0);
    const parsed = JSON.parse(output.stdout[0] ?? "{}");
    expect(parsed.decision).toEqual({
      kind: "empty",
      notes: ["No detector-eligible content was present."],
    });
  });

  test("returns valid empty inspect result for whitespace-only path input", async () => {
    const root = await makeTempFixture("inspect-whitespace-path");
    const filePath = join(root, "blank.txt");
    await writeFile(filePath, " \n\t ");

    const output = await captureCli([
      "inspect",
      "--detector",
      "regex",
      "--format",
      "json",
      "--path",
      filePath,
    ]);

    expect(output.exitCode).toBe(0);
    const parsed = JSON.parse(output.stdout[0] ?? "{}");
    expect(parsed.decision).toEqual({
      kind: "empty",
      notes: ["No detector-eligible content was present."],
    });
  });

  test("rejects missing inspect input", async () => {
    const output = await captureCli(["inspect"]);

    expect(output.exitCode).toBe(1);
    expect(output.stderr.some((line) => line.includes("No inspect input provided."))).toBeTrue();
  });

  test("rejects invalid inspect --content-gate values", async () => {
    const output = await captureCli(["inspect", "--content-gate", "aggressive", "Hello world"]);

    expect(output.exitCode).toBe(1);
    expect(
      output.stderr.some((line) =>
        line.includes("`--content-gate` must be `default`, `strict`, `loose`, or `off`."),
      ),
    ).toBeTrue();
  });

  test("rejects mixed positional text and path inspect input", async () => {
    const root = await makeTempFixture("inspect-mixed-input");
    const filePath = join(root, "sample.txt");
    await writeFile(filePath, "Hello world");

    const output = await captureCli(["inspect", "--path", filePath, "Hello"]);

    expect(output.exitCode).toBe(1);
    expect(
      output.stderr.some((line) =>
        line.includes("`inspect` accepts either positional text or --path inputs, not both."),
      ),
    ).toBeTrue();
  });

  test("supports inspect directory expansion in json mode", async () => {
    const root = await makeTempFixture("inspect-directory");
    await writeFile(join(root, "a.md"), "Hello world");
    await writeFile(join(root, "ignored.js"), "const x = 1;");

    const output = await captureCli(["inspect", "--format", "json", "--path", root]);

    expect(output.exitCode).toBe(0);
    const parsed = JSON.parse(output.stdout[0] ?? "{}");
    expect(parsed.kind).toBe("detector-inspect-batch");
    expect(parsed.summary.requestedInputs).toBe(1);
    expect(parsed.summary.succeeded).toBe(1);
    expect(parsed.summary.skipped).toBe(1);
    expect(parsed.summary.failed).toBe(0);
    expect(parsed.files[0]?.path).toBe(join(root, "a.md"));
    expect(parsed.skipped[0]?.reason).toBe("extension excluded");
  });

  test("supports inspect batch json pretty output", async () => {
    const root = await makeTempFixture("inspect-batch-pretty");
    await writeFile(join(root, "a.md"), "Hello world");
    await writeFile(join(root, "ignored.js"), "const x = 1;");

    const output = await captureCli(["inspect", "--format", "json", "--pretty", "--path", root]);

    expect(output.exitCode).toBe(0);
    expect(output.stdout.length).toBe(1);
    expect(output.stdout[0]).toContain('\n  "kind": "detector-inspect-batch"');
    expect(output.stdout[0]).toContain('\n  "summary": {');
    const parsed = JSON.parse(output.stdout[0] ?? "{}");
    expect(parsed.kind).toBe("detector-inspect-batch");
    expect(parsed.summary.succeeded).toBe(1);
    expect(parsed.summary.skipped).toBe(1);
  });

  test("treats unreadable directory-discovered files as skipped", async () => {
    const root = await makeTempFixture("inspect-unreadable-directory-file");
    const readablePath = join(root, "a.md");
    const unreadablePath = join(root, "b.md");
    await writeFile(readablePath, "Hello world");
    await writeFile(unreadablePath, "Hidden text");
    await chmod(unreadablePath, 0o000);

    try {
      const output = await captureCli(["inspect", "--format", "json", "--path", root]);

      expect(output.exitCode).toBe(0);
      const parsed = JSON.parse(output.stdout[0] ?? "{}");
      expect(parsed.summary.succeeded).toBe(1);
      expect(parsed.summary.skipped).toBe(1);
      expect(parsed.summary.failed).toBe(0);
      expect(
        parsed.skipped.some(
          (entry: { path: string; reason: string }) =>
            entry.path === unreadablePath && entry.reason.startsWith("not readable:"),
        ),
      ).toBeTrue();
    } finally {
      await chmod(unreadablePath, 0o644);
    }
  });

  test("reports explicit inspect path directories as failures in manual mode", async () => {
    const root = await makeTempFixture("inspect-directory-manual");

    const output = await captureCli([
      "inspect",
      "--format",
      "json",
      "--path",
      root,
      "--path-mode",
      "manual",
    ]);

    expect(output.exitCode).toBe(1);
    const parsed = JSON.parse(output.stdout[0] ?? "{}");
    expect(parsed.kind).toBe("detector-inspect-batch");
    expect(parsed.summary.failed).toBe(1);
    expect(parsed.failures[0]).toEqual({
      path: root,
      reason: "not a regular file",
    });
  });

  test("supports inspect batch section content selection", async () => {
    const root = await makeTempFixture("inspect-section-content");
    const filePath = join(root, "doc.md");
    await writeFile(filePath, ["---", "title: Hello", "---", "Body world"].join("\n"));

    const output = await captureCli([
      "inspect",
      "--format",
      "json",
      "--path",
      filePath,
      "--section",
      "content",
    ]);

    expect(output.exitCode).toBe(0);
    const parsed = JSON.parse(output.stdout[0] ?? "{}");
    expect(parsed.input.path).toBe(filePath);
    expect(parsed.input.textLength).toBe("Body world".length);
  });

  test("rejects unsupported inspect detector and view combinations", async () => {
    const output = await captureCli([
      "inspect",
      "--detector",
      "regex",
      "--view",
      "engine",
      "Hello world",
    ]);

    expect(output.exitCode).toBe(1);
    expect(
      output.stderr.some((line) => line.includes("`--view engine` requires `--detector wasm`.")),
    ).toBeTrue();
  });

  test("rejects inspect raw format", async () => {
    const output = await captureCli(["inspect", "--format", "raw", "Hello world"]);

    expect(output.exitCode).toBe(1);
    expect(
      output.stderr.some((line) => line.includes("`inspect` does not support `--format raw`.")),
    ).toBeTrue();
  });
});
