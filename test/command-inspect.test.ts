import { describe, expect, test } from "bun:test";
import { chmod, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createCliHarness } from "./support/cli-harness";
import { hasWasmDetectorRuntime } from "./support/wasm-detector-runtime";

const { captureCli, makeTempFixture } = createCliHarness();

describe("inspect command", () => {
  test("supports default wasm pipeline inspection", async () => {
    if (!hasWasmDetectorRuntime()) {
      return;
    }

    const output = await captureCli(["inspect", "こんにちは、世界！これはテストです。"]);

    expect(output.exitCode).toBe(0);
    expect(output.stdout).toContain("Detector inspect");
    expect(output.stdout).toContain("View: pipeline");
    expect(output.stdout).toContain("Detector: wasm");
  });

  test("supports wasm engine inspection", async () => {
    if (!hasWasmDetectorRuntime()) {
      return;
    }

    const output = await captureCli([
      "inspect",
      "--view",
      "engine",
      "こんにちは、世界！これはテストです。",
    ]);

    expect(output.exitCode).toBe(0);
    expect(output.stdout).toContain("View: engine");
    expect(output.stdout.some((line) => line.includes("Route tag: und-Hani"))).toBeTrue();
  });

  test("bounds standard engine inspection output to previews", async () => {
    if (!hasWasmDetectorRuntime()) {
      return;
    }

    const root = await makeTempFixture("inspect-engine-preview");
    const filePath = join(root, "large.txt");
    const longText = "This sentence should clearly be detected as English for the wasm detector path. ".repeat(
      8,
    );
    await writeFile(filePath, longText);

    const output = await captureCli([
      "inspect",
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

  test("returns valid empty inspect result for empty path input", async () => {
    const root = await makeTempFixture("inspect-empty-path");
    const filePath = join(root, "empty.txt");
    await writeFile(filePath, "");

    const output = await captureCli([
      "inspect",
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

    const output = await captureCli([
      "inspect",
      "--format",
      "json",
      "--pretty",
      "--path",
      root,
    ]);

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
      const output = await captureCli([
        "inspect",
        "--format",
        "json",
        "--path",
        root,
      ]);

      expect(output.exitCode).toBe(0);
      const parsed = JSON.parse(output.stdout[0] ?? "{}");
      expect(parsed.summary.succeeded).toBe(1);
      expect(parsed.summary.skipped).toBe(1);
      expect(parsed.summary.failed).toBe(0);
      expect(parsed.skipped.some((entry: { path: string; reason: string }) =>
        entry.path === unreadablePath && entry.reason.startsWith("not readable:"),
      )).toBeTrue();
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
    expect(output.stderr.some((line) => line.includes("`--view engine` requires `--detector wasm`."))).toBeTrue();
  });

  test("rejects inspect raw format", async () => {
    const output = await captureCli(["inspect", "--format", "raw", "Hello world"]);

    expect(output.exitCode).toBe(1);
    expect(output.stderr.some((line) => line.includes("`inspect` does not support `--format raw`."))).toBeTrue();
  });
});
