import { describe, expect, test } from "bun:test";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createDebugChannel } from "../src/cli/debug/channel";
import { createCliHarness } from "./support/cli-harness";
import { hasWasmDetectorRuntime } from "./support/wasm-detector-runtime";

const { captureCli, listDebugEventNames, makeTempFixture, parseDebugEvents } = createCliHarness();

describe("CLI debug diagnostics", () => {
  test("emits structured lifecycle diagnostics to stderr only", async () => {
    const root = await makeTempFixture("cli-debug-lifecycle");
    await writeFile(join(root, "a.txt"), "alpha");
    await writeFile(join(root, "b.txt"), "beta");

    const output = await captureCli([
      "--path",
      root,
      "--format",
      "raw",
      "--debug",
      "--quiet-skips",
    ]);
    const events = parseDebugEvents(output.stderr);
    const eventNames = listDebugEventNames(output.stderr);
    const stageTimingNames = events
      .filter((item) => item.event === "batch.stage.timing")
      .map((item) => item.stage)
      .filter((stage): stage is string => typeof stage === "string");

    expect(eventNames.includes("batch.resolve.start")).toBeTrue();
    expect(eventNames.includes("batch.resolve.complete")).toBeTrue();
    expect(eventNames.includes("batch.progress.start")).toBeTrue();
    expect(eventNames.includes("batch.progress.complete")).toBeTrue();
    expect(stageTimingNames.includes("resolve")).toBeTrue();
    expect(stageTimingNames.includes("load")).toBeTrue();
    expect(stageTimingNames.includes("count")).toBeTrue();
    expect(stageTimingNames.includes("finalize")).toBeTrue();
    expect(events.every((item) => item.schemaVersion === 1)).toBeTrue();
    expect(
      events.every(
        (item) =>
          typeof item.timestamp === "string" && !Number.isNaN(Date.parse(String(item.timestamp))),
      ),
    ).toBeTrue();
    expect(
      events.every(
        (item) => typeof item.runId === "string" && String(item.runId).startsWith("wc-debug-"),
      ),
    ).toBeTrue();
    expect(events.every((item) => item.topic === "batch" || item.topic === "path")).toBeTrue();
    expect(events.every((item) => item.scope === "run" || item.scope === "file")).toBeTrue();
    expect(output.stdout).toEqual(["2"]);
  });

  test("emits compact path-resolution summaries by default", async () => {
    const root = await makeTempFixture("cli-debug-path-resolution");
    const explicit = join(root, "keep.log");
    await writeFile(join(root, "note.md"), "alpha beta");
    await writeFile(explicit, "explicit log");

    const output = await captureCli([
      "--path",
      root,
      "--path",
      explicit,
      "--path",
      explicit,
      "--include-ext",
      ".md",
      "--exclude-ext",
      ".md",
      "--format",
      "raw",
      "--debug",
      "--quiet-skips",
    ]);
    const eventNames = listDebugEventNames(output.stderr);

    expect(eventNames.includes("path.resolve.root.expand")).toBeTrue();
    expect(eventNames.includes("path.resolve.filter.summary")).toBeTrue();
    expect(eventNames.includes("path.resolve.dedupe.summary")).toBeTrue();
    expect(eventNames.includes("path.resolve.filter.excluded")).toBeFalse();
    expect(eventNames.includes("path.resolve.dedupe.accept")).toBeFalse();
    expect(eventNames.includes("path.resolve.dedupe.duplicate")).toBeFalse();
    expect(output.stdout).toEqual(["2"]);
  });

  test("emits per-file path-resolution diagnostics in verbose mode", async () => {
    const root = await makeTempFixture("cli-debug-path-resolution-verbose");
    const explicit = join(root, "keep.log");
    await writeFile(join(root, "note.md"), "alpha beta");
    await writeFile(explicit, "explicit log");

    const output = await captureCli([
      "--path",
      root,
      "--path",
      explicit,
      "--path",
      explicit,
      "--include-ext",
      ".md",
      "--exclude-ext",
      ".md",
      "--format",
      "raw",
      "--debug",
      "--verbose",
      "--quiet-skips",
    ]);
    const eventNames = listDebugEventNames(output.stderr);

    expect(eventNames.includes("path.resolve.filter.excluded")).toBeTrue();
    expect(eventNames.includes("path.resolve.dedupe.accept")).toBeTrue();
    expect(eventNames.includes("path.resolve.dedupe.duplicate")).toBeTrue();
    const events = parseDebugEvents(output.stderr).filter((item) => item.topic === "path");
    expect(events.some((item) => item.scope === "file")).toBeTrue();
    expect(output.stdout).toEqual(["2"]);
  });

  test("emits regex exclusion diagnostics in verbose mode", async () => {
    const root = await makeTempFixture("cli-debug-regex-verbose");
    await writeFile(join(root, "keep.md"), "alpha beta");
    await writeFile(join(root, "skip.md"), "gamma delta");

    const output = await captureCli([
      "--path",
      root,
      "--regex",
      "^keep\\.md$",
      "--format",
      "raw",
      "--debug",
      "--verbose",
      "--quiet-skips",
    ]);
    const eventNames = listDebugEventNames(output.stderr);

    expect(eventNames.includes("path.resolve.regex.excluded")).toBeTrue();
    expect(output.stdout).toEqual(["2"]);
  });

  test("routes debug output to file when --debug-report is enabled", async () => {
    const root = await makeTempFixture("cli-debug-report-file");
    const reportPath = join(root, "reports", "diagnostics.jsonl");
    await writeFile(join(root, "a.txt"), "alpha");
    await writeFile(join(root, "b.txt"), "beta");

    const output = await captureCli([
      "--path",
      root,
      "--format",
      "raw",
      "--debug",
      "--debug-report",
      reportPath,
      "--quiet-skips",
    ]);

    expect(listDebugEventNames(output.stderr)).toEqual([]);
    const report = await readFile(reportPath, "utf8");
    const lines = report
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    const eventNames = lines
      .map((line) => JSON.parse(line) as { event?: string })
      .map((entry) => entry.event)
      .filter((event): event is string => typeof event === "string");

    expect(eventNames.includes("batch.resolve.start")).toBeTrue();
    expect(eventNames.includes("batch.progress.complete")).toBeTrue();
    expect(output.stdout).toEqual(["2"]);
  });

  test("mirrors debug output to terminal when --debug-report-tee is enabled", async () => {
    const root = await makeTempFixture("cli-debug-report-tee");
    const reportPath = join(root, "diagnostics.jsonl");
    await writeFile(join(root, "a.txt"), "alpha");
    await writeFile(join(root, "b.txt"), "beta");

    const output = await captureCli([
      "--path",
      root,
      "--format",
      "raw",
      "--debug",
      "--debug-report",
      reportPath,
      "--debug-report-tee",
      "--quiet-skips",
    ]);

    expect(listDebugEventNames(output.stderr).length > 0).toBeTrue();
    const report = await readFile(reportPath, "utf8");
    expect(report.includes('"event":"batch.resolve.start"')).toBeTrue();
    expect(output.stdout).toEqual(["2"]);
  });

  test("supports --debug-tee alias for --debug-report-tee", async () => {
    const root = await makeTempFixture("cli-debug-tee-alias");
    const reportPath = join(root, "diagnostics.jsonl");
    await writeFile(join(root, "a.txt"), "alpha");
    await writeFile(join(root, "b.txt"), "beta");

    const output = await captureCli([
      "--path",
      root,
      "--format",
      "raw",
      "--debug",
      "--debug-report",
      reportPath,
      "--debug-tee",
      "--quiet-skips",
    ]);

    expect(listDebugEventNames(output.stderr).length > 0).toBeTrue();
    const report = await readFile(reportPath, "utf8");
    expect(report.includes('"event":"batch.resolve.start"')).toBeTrue();
    expect(output.stdout).toEqual(["2"]);
  });

  test("fails fast when debug report path is not writable", async () => {
    const root = await makeTempFixture("cli-debug-report-unwritable");
    const overlongName = `${"a".repeat(320)}.jsonl`;
    const invalidPath = join(root, overlongName);

    expect(() =>
      createDebugChannel({
        enabled: true,
        verbosity: "compact",
        report: { path: invalidPath, tee: false, cwd: root },
      }),
    ).toThrow("debug report path is not writable");
  });

  test("fails fast when explicit debug report path targets an existing directory", async () => {
    const root = await makeTempFixture("cli-debug-report-directory");
    const reportDirectory = join(root, "logs");
    await mkdir(reportDirectory, { recursive: true });

    expect(() =>
      createDebugChannel({
        enabled: true,
        verbosity: "compact",
        report: { path: reportDirectory, tee: false, cwd: root },
      }),
    ).toThrow("debug report path must be a file");
  });

  test("keeps explicit debug report path when target file already exists", async () => {
    const root = await makeTempFixture("cli-debug-report-explicit-existing-file");
    const reportPath = join(root, "diagnostics.jsonl");
    await writeFile(reportPath, '{"event":"existing"}\n');

    const debug = createDebugChannel({
      enabled: true,
      verbosity: "compact",
      report: { path: reportPath, tee: false, cwd: root },
    });

    expect(debug.reportPath).toBe(reportPath);
    debug.emit("batch.resolve.start", { files: 1 });
    await debug.close();

    const report = await readFile(reportPath, "utf8");
    expect(report.includes('{"event":"existing"}')).toBeTrue();
    expect(report.includes('"event":"batch.resolve.start"')).toBeTrue();

    const entries = await readdir(root);
    expect(entries.includes("diagnostics-1.jsonl")).toBeFalse();
  });

  test("keeps runId stable within a single debug channel", async () => {
    const root = await makeTempFixture("cli-debug-run-id-stable");
    const reportPath = join(root, "diagnostics.jsonl");
    const fixedNow = new Date(Date.UTC(2026, 2, 24, 5, 32, 21, 123));
    const debug = createDebugChannel({
      enabled: true,
      verbosity: "compact",
      report: { path: reportPath, tee: false, cwd: root },
      now: () => fixedNow,
      pid: 55149,
    });

    debug.emit("batch.resolve.start", { inputs: 1 });
    debug.emit("batch.resolve.complete", { files: 1 });
    await debug.close();

    const report = await readFile(reportPath, "utf8");
    const entries = report
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map(
        (line) =>
          JSON.parse(line) as { runId?: string; timestamp?: string; schemaVersion?: number },
      );

    expect(entries.length).toBe(2);
    expect(entries.every((entry) => entry.runId === "wc-debug-1774330341123-55149")).toBeTrue();
    expect(entries.every((entry) => entry.timestamp === "2026-03-24T05:32:21.123Z")).toBeTrue();
    expect(entries.every((entry) => entry.schemaVersion === 1)).toBeTrue();
  });

  test("creates deterministic default debug report name in cwd", async () => {
    const root = await makeTempFixture("cli-debug-report-default-name");
    const previousCwd = process.cwd();
    await writeFile(join(root, "a.txt"), "alpha");
    await writeFile(join(root, "b.txt"), "beta");

    process.chdir(root);
    try {
      await captureCli([
        "--path",
        root,
        "--format",
        "raw",
        "--debug",
        "--debug-report",
        "--quiet-skips",
      ]);
    } finally {
      process.chdir(previousCwd);
    }

    const entries = await readdir(root);
    const reports = entries.filter((entry) =>
      /^wc-debug-\d{8}-\d{6}-utc-\d+(-\d+)?\.jsonl$/.test(entry),
    );
    expect(reports.length).toBe(1);
  });

  test("creates deterministic detector evidence debug report name in cwd", async () => {
    if (!hasWasmDetectorRuntime()) {
      return;
    }

    const root = await makeTempFixture("cli-detector-evidence-report-default-name");
    const previousCwd = process.cwd();

    process.chdir(root);
    try {
      await captureCli([
        "--debug",
        "--debug-report",
        "--detector",
        "wasm",
        "--detector-evidence",
        "This sentence should clearly be detected as English for the wasm detector path.",
      ]);
    } finally {
      process.chdir(previousCwd);
    }

    const entries = await readdir(root);
    const reports = entries.filter((entry) =>
      /^wc-detector-evidence-\d{8}-\d{6}-utc-\d+(-\d+)?\.jsonl$/.test(entry),
    );
    expect(reports.length).toBe(1);
  });

  test("adds collision suffix for default debug report filenames", async () => {
    const root = await makeTempFixture("cli-debug-report-collision");
    const fixedNow = new Date(Date.UTC(2026, 1, 16, 12, 34, 56));
    const baseName = "wc-debug-20260216-123456-utc-4321.jsonl";
    await writeFile(join(root, baseName), "existing");

    const debug = createDebugChannel({
      enabled: true,
      verbosity: "compact",
      report: { tee: false, cwd: root },
      now: () => fixedNow,
      pid: 4321,
    });
    const expectedPath = join(root, "wc-debug-20260216-123456-utc-4321-1.jsonl");

    expect(debug.reportPath).toBe(expectedPath);
    debug.emit("batch.resolve.start", { files: 1 });
    await debug.close();

    const report = await readFile(expectedPath, "utf8");
    expect(report.includes('"event":"batch.resolve.start"')).toBeTrue();
  });

  test("adds collision suffix for default detector evidence report filenames", async () => {
    const root = await makeTempFixture("cli-detector-evidence-report-collision");
    const fixedNow = new Date(Date.UTC(2026, 1, 16, 12, 34, 56));
    const baseName = "wc-detector-evidence-20260216-123456-utc-4321.jsonl";
    await writeFile(join(root, baseName), "existing");

    const debug = createDebugChannel({
      enabled: true,
      verbosity: "compact",
      report: {
        tee: false,
        cwd: root,
        autogeneratedNamePrefix: "wc-detector-evidence",
      },
      now: () => fixedNow,
      pid: 4321,
    });
    const expectedPath = join(root, "wc-detector-evidence-20260216-123456-utc-4321-1.jsonl");

    expect(debug.reportPath).toBe(expectedPath);
    debug.emit("detector.window.evidence", { windowIndex: 0 });
    await debug.close();

    const report = await readFile(expectedPath, "utf8");
    expect(report.includes('"event":"detector.window.evidence"')).toBeTrue();
  });
});
