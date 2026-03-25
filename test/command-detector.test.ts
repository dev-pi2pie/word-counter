import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { createCliHarness } from "./support/cli-harness";
import { hasWasmDetectorRuntime } from "./support/wasm-detector-runtime";

const { captureCli, findDebugEvents, listDebugEventNames } = createCliHarness();

describe("detector mode", () => {
  test("keeps regex as the default detector mode", async () => {
    const output = await captureCli(["--format", "json", "Hello world"]);

    expect(output.exitCode).toBe(0);
    expect(JSON.parse(output.stdout[0] ?? "{}")).toMatchObject({ total: 2 });
  });

  test("accepts explicit regex detector mode", async () => {
    const output = await captureCli(["--detector", "regex", "--format", "json", "Hello world"]);

    expect(output.exitCode).toBe(0);
    expect(JSON.parse(output.stdout[0] ?? "{}")).toMatchObject({ total: 2 });
  });

  test("accepts explicit content gate mode on the counting CLI", async () => {
    const output = await captureCli([
      "--detector",
      "regex",
      "--content-gate",
      "strict",
      "--format",
      "json",
      "Hello world",
    ]);

    expect(output.exitCode).toBe(0);
    expect(JSON.parse(output.stdout[0] ?? "{}")).toMatchObject({ total: 2 });
  });

  test("threads content gate mode into wasm counting policy evaluation", async () => {
    if (!hasWasmDetectorRuntime()) {
      return;
    }

    const output = await captureCli([
      "--detector",
      "wasm",
      "--content-gate",
      "strict",
      "--format",
      "raw",
      "--debug",
      "--verbose",
      "Internationalization documentation remains understandable.",
    ]);

    expect(output.exitCode).toBe(0);
    const sampleEvents = findDebugEvents(output.stderr, "detector.window.sample");
    expect(sampleEvents).toHaveLength(1);
    expect(sampleEvents[0]?.contentGate).toEqual({
      applied: true,
      passed: false,
      policy: "latinProse",
      mode: "strict",
    });
    expect(sampleEvents[0]?.qualityGate).toBe(false);
  });

  test("rejects invalid content gate modes on the counting CLI", async () => {
    const result = spawnSync(
      process.execPath,
      ["run", "src/bin.ts", "--content-gate", "aggressive", "Hello world"],
      {
        cwd: process.cwd(),
        encoding: "utf8",
      },
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "option '--content-gate <mode>' argument 'aggressive' is invalid",
    );
  });

  test("supports wasm detector mode for long ambiguous Latin text", async () => {
    if (!hasWasmDetectorRuntime()) {
      return;
    }

    const output = await captureCli([
      "--detector",
      "wasm",
      "--format",
      "json",
      "This sentence should clearly be detected as English for the wasm detector path.",
    ]);

    expect(output.exitCode).toBe(0);
    const parsed = JSON.parse(output.stdout[0] ?? "{}");
    expect(parsed.breakdown.items[0]?.locale).toBe("en");
  });

  test("keeps detector-derived locale when latin tag hint is set in wasm mode", async () => {
    if (!hasWasmDetectorRuntime()) {
      return;
    }

    const output = await captureCli([
      "--detector",
      "wasm",
      "--latin-tag",
      "en",
      "--format",
      "json",
      "Ceci est une phrase francaise suffisamment longue pour que le detecteur identifie correctement la langue.",
    ]);

    expect(output.exitCode).toBe(0);
    const parsed = JSON.parse(output.stdout[0] ?? "{}");
    expect(parsed.total).toBe(15);
    expect(parsed.breakdown.items[0]?.locale).toBe("fr");
  });

  test("emits runtime and detector debug events for single-input wasm runs", async () => {
    if (!hasWasmDetectorRuntime()) {
      return;
    }

    const output = await captureCli([
      "--detector",
      "wasm",
      "--format",
      "raw",
      "--debug",
      "--verbose",
      "This sentence should clearly be detected as English for the wasm detector path.",
    ]);

    const eventNames = listDebugEventNames(output.stderr);
    expect(eventNames.includes("runtime.single.start")).toBeTrue();
    expect(eventNames.includes("runtime.single.complete")).toBeTrue();
    expect(eventNames.includes("detector.window.start")).toBeTrue();
    expect(eventNames.includes("detector.window.accepted")).toBeTrue();
    expect(eventNames.includes("detector.summary")).toBeTrue();

    const sampleEvents = findDebugEvents(output.stderr, "detector.window.sample");
    expect(sampleEvents.length).toBe(1);
    expect(sampleEvents[0]?.contentGate).toEqual({
      applied: true,
      passed: true,
      policy: "latinProse",
      mode: "default",
    });
    expect(sampleEvents[0]?.qualityGate).toBe(true);
  });

  test("rejects --detector-evidence without --debug", async () => {
    const result = spawnSync(
      process.execPath,
      [
        "run",
        "src/bin.ts",
        "--detector",
        "wasm",
        "--detector-evidence",
        "This sentence should clearly be detected as English for the wasm detector path.",
      ],
      {
        cwd: process.cwd(),
        encoding: "utf8",
      },
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("`--detector-evidence` requires `--debug`.");
  });

  test("rejects --detector-evidence without --detector wasm", async () => {
    const result = spawnSync(
      process.execPath,
      [
        "run",
        "src/bin.ts",
        "--debug",
        "--detector-evidence",
        "This sentence should clearly be detected as English for the wasm detector path.",
      ],
      {
        cwd: process.cwd(),
        encoding: "utf8",
      },
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("`--detector-evidence` requires `--detector wasm`.");
  });

  test("emits compact detector evidence previews without verbose mode", async () => {
    if (!hasWasmDetectorRuntime()) {
      return;
    }

    const sample = [
      "This sentence should clearly be detected as English for the wasm detector path.",
      "",
      "This second sentence adds enough length to force compact preview truncation while remaining strong prose for the detector quality gate.",
      "This third sentence keeps the sample comfortably above the preview cap and introduces extra spacing.",
    ].join("\n");

    const output = await captureCli([
      "--detector",
      "wasm",
      "--format",
      "raw",
      "--debug",
      "--detector-evidence",
      sample,
    ]);

    const evidenceEvents = findDebugEvents(output.stderr, "detector.window.evidence");
    expect(evidenceEvents.length).toBe(1);
    const evidence = evidenceEvents[0]!;
    expect(evidence.verbosity).toBe("compact");
    expect(evidence.mode).toBe("chunk");
    expect(evidence.section).toBe("all");
    expect(typeof evidence.textPreview).toBe("string");
    expect(typeof evidence.normalizedPreview).toBe("string");
    expect(evidence.textPreviewTruncated).toBeTrue();
    expect(evidence.text).toBeUndefined();
    expect(evidence.normalizedText).toBeUndefined();
    expect(String(evidence.textPreview)).not.toContain("\n");
    expect(String(evidence.textPreview)).not.toContain("  ");
    expect(evidence.contentGate).toEqual({
      applied: true,
      passed: true,
      policy: "latinProse",
      mode: "default",
    });
    expect(evidence.qualityGate).toBe(true);
  });

  test("keeps qualityGate compatibility alias for strict detector evidence payloads", async () => {
    if (!hasWasmDetectorRuntime()) {
      return;
    }

    const output = await captureCli([
      "--detector",
      "wasm",
      "--content-gate",
      "strict",
      "--format",
      "raw",
      "--debug",
      "--detector-evidence",
      "Internationalization documentation remains understandable.",
    ]);

    const evidenceEvents = findDebugEvents(output.stderr, "detector.window.evidence");
    expect(evidenceEvents.length).toBe(1);
    const evidence = evidenceEvents[0]!;
    expect(evidence.contentGate).toEqual({
      applied: true,
      passed: false,
      policy: "latinProse",
      mode: "strict",
    });
    expect(evidence.qualityGate).toBe(false);
  });

  test("keeps qualityGate compatibility alias for off detector evidence payloads", async () => {
    if (!hasWasmDetectorRuntime()) {
      return;
    }

    const output = await captureCli([
      "--detector",
      "wasm",
      "--content-gate",
      "off",
      "--format",
      "raw",
      "--debug",
      "--detector-evidence",
      ["mode: debug", "tee: true", "path: logs", "Use this for testing."].join("\n"),
    ]);

    const evidenceEvents = findDebugEvents(output.stderr, "detector.window.evidence");
    expect(evidenceEvents.length).toBe(1);
    const evidence = evidenceEvents[0]!;
    expect(evidence.contentGate).toEqual({
      applied: false,
      passed: true,
      policy: "none",
      mode: "off",
    });
    expect(evidence.qualityGate).toBe(true);
  });

  test("reports hinted Latin fallback tags in detector evidence", async () => {
    const output = await captureCli([
      "--detector",
      "wasm",
      "--format",
      "raw",
      "--debug",
      "--detector-evidence",
      "--latin-language",
      "de",
      "Über",
    ]);

    const evidenceEvents = findDebugEvents(output.stderr, "detector.window.evidence");
    expect(evidenceEvents.length).toBe(1);
    const evidenceDecision = evidenceEvents[0]?.decision as Record<string, unknown> | undefined;
    expect(evidenceDecision?.finalTag).toBe("de");

    const fallbackEvents = findDebugEvents(output.stderr, "detector.window.fallback");
    expect(fallbackEvents.length).toBe(1);
    expect(fallbackEvents[0]?.finalTag).toBe("de");
  });

  test("emits full detector evidence text in verbose mode", async () => {
    if (!hasWasmDetectorRuntime()) {
      return;
    }

    const sample = [
      "This sentence should clearly be detected as English for the wasm detector path.",
      "",
      "This second sentence adds enough length to make the verbose detector evidence payload interesting.",
    ].join("\n");

    const output = await captureCli([
      "--detector",
      "wasm",
      "--format",
      "raw",
      "--debug",
      "--verbose",
      "--detector-evidence",
      sample,
    ]);

    const evidenceEvents = findDebugEvents(output.stderr, "detector.window.evidence");
    expect(evidenceEvents.length).toBe(1);
    const evidence = evidenceEvents[0]!;
    expect(evidence.verbosity).toBe("verbose");
    expect(evidence.text).toBe(sample);
    expect(typeof evidence.normalizedText).toBe("string");
    expect(String(evidence.text)).toContain("\n\n");
    expect(evidence.textPreview).toBeUndefined();
    expect(evidence.normalizedPreview).toBeUndefined();
  });

  test("reports borrowed Japanese context in detector evidence for mixed Hani windows", async () => {
    if (!hasWasmDetectorRuntime()) {
      return;
    }

    const output = await captureCli([
      "--detector",
      "wasm",
      "--format",
      "raw",
      "--debug",
      "--verbose",
      "--detector-evidence",
      "こんにちは、世界！これはテストです。",
    ]);

    const evidenceEvents = findDebugEvents(output.stderr, "detector.window.evidence");
    expect(evidenceEvents.length).toBe(1);
    const evidence = evidenceEvents[0]!;
    expect(evidence.textSource).toBe("borrowed-context");
    expect(evidence.borrowedContext).toEqual({ leftChunkIndex: 0, rightChunkIndex: 2 });
    expect(evidence.text).toBe("こんにちは、世界！これはテストです。");
    expect(evidence.normalizedText).toBe("世界");
    expect(evidence.eligible).toBe(true);
    const decision = evidence.decision as Record<string, unknown> | undefined;
    expect(decision?.accepted).toBe(true);
    expect(decision?.finalTag).toBe("ja");
  });

  test("keeps detector evidence window counts stable across output modes", async () => {
    if (!hasWasmDetectorRuntime()) {
      return;
    }

    const sample =
      "This sentence should clearly be detected as English for the wasm detector path. This follow-up sentence keeps the window long enough for detector evidence regardless of output mode.";

    const collectorOutput = await captureCli([
      "--detector",
      "wasm",
      "--mode",
      "collector",
      "--format",
      "raw",
      "--debug",
      "--detector-evidence",
      sample,
    ]);
    const charOutput = await captureCli([
      "--detector",
      "wasm",
      "--mode",
      "char",
      "--format",
      "raw",
      "--debug",
      "--detector-evidence",
      sample,
    ]);

    const collectorEvidence = findDebugEvents(collectorOutput.stderr, "detector.window.evidence");
    const charEvidence = findDebugEvents(charOutput.stderr, "detector.window.evidence");

    expect(collectorEvidence.length).toBeGreaterThan(0);
    expect(collectorEvidence.length).toBe(charEvidence.length);
    expect(collectorEvidence[0]?.mode).toBe("collector");
    expect(charEvidence[0]?.mode).toBe("char");
  });

  test("adds debug detector summary to single-input json only when --debug is enabled", async () => {
    if (!hasWasmDetectorRuntime()) {
      return;
    }

    const baseOutput = await captureCli([
      "--detector",
      "wasm",
      "--format",
      "json",
      "This sentence should clearly be detected as English for the wasm detector path.",
    ]);
    const baseParsed = JSON.parse(baseOutput.stdout[0] ?? "{}");
    expect(baseParsed.debug).toBeUndefined();

    const debugOutput = await captureCli([
      "--detector",
      "wasm",
      "--format",
      "json",
      "--debug",
      "This sentence should clearly be detected as English for the wasm detector path.",
    ]);
    const debugParsed = JSON.parse(debugOutput.stdout[0] ?? "{}");
    expect(debugParsed.debug?.detector?.mode).toBe("wasm");
    expect(debugParsed.debug?.detector?.engine).toBe("whatlang-wasm");
    expect(debugParsed.debug?.detector?.windowsTotal).toBeGreaterThanOrEqual(1);
  });

  test("rejects invalid detector mode values", () => {
    const result = spawnSync(
      process.execPath,
      ["run", "src/bin.ts", "--detector", "invalid", "Hello world"],
      {
        cwd: process.cwd(),
        encoding: "utf8",
      },
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("option '--detector <mode>' argument 'invalid' is invalid");
  });
});
