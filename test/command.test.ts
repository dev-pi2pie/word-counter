import { afterEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { buildBatchSummary, loadBatchInputs, resolveBatchFilePaths, runCli } from "../src/command";
import { createDebugChannel } from "../src/cli/debug/channel";
import {
  WorkerRouteUnavailableError,
  countBatchInputsWithWorkerJobs,
} from "../src/cli/batch/jobs/load-count-worker";
import { resolveBatchJobsLimit } from "../src/cli/batch/jobs/limits";
import { DEFAULT_INCLUDE_EXTENSIONS, buildDirectoryExtensionFilter } from "../src/cli/path/filter";
import type { ProgressOutputStream } from "../src/cli/progress/reporter";
import type { DoctorRuntimeOverrides } from "../src/cli/doctor/types";
import {
  parseInlineLatinHintRule,
  validateSingleRegexOptionUsage,
  validateStandalonePrintJobsLimitUsage,
} from "../src/cli/runtime/options";
import { TOTAL_OF_PARTS } from "../src/cli/total-of";
import { hasWasmDetectorRuntime } from "./support/wasm-detector-runtime";

const tempRoots: string[] = [];

afterEach(async () => {
  while (tempRoots.length > 0) {
    const next = tempRoots.pop();
    if (!next) {
      continue;
    }
    await rm(next, { recursive: true, force: true });
  }
});

async function makeTempFixture(prefix: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), `${prefix}-`));
  tempRoots.push(root);
  return root;
}

type CaptureCliOptions = {
  stderr?: ProgressOutputStream;
  doctorRuntime?: DoctorRuntimeOverrides;
};

async function captureCli(
  args: string[],
  options: CaptureCliOptions = {},
): Promise<{ stdout: string[]; stderr: string[]; exitCode: number | undefined }> {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const originalLog = console.log;
  const originalError = console.error;
  const originalStderrWrite = process.stderr.write.bind(process.stderr);
  const originalExitCode = process.exitCode;
  let exitCode: number | undefined;

  console.log = (...chunks: unknown[]) => {
    stdout.push(chunks.map((chunk) => String(chunk)).join(" "));
  };
  console.error = (...chunks: unknown[]) => {
    stderr.push(chunks.map((chunk) => String(chunk)).join(" "));
  };
  process.stderr.write = ((chunk: string | Uint8Array): boolean => {
    stderr.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));
    return true;
  }) as typeof process.stderr.write;
  process.exitCode = undefined;

  try {
    await runCli(["node", "word-counter", ...args], {
      stderr: options.stderr,
      doctor: options.doctorRuntime,
    });
  } finally {
    exitCode = process.exitCode;
    console.log = originalLog;
    console.error = originalError;
    process.stderr.write = originalStderrWrite as typeof process.stderr.write;
    process.exitCode = originalExitCode;
  }

  return { stdout, stderr, exitCode };
}

async function captureBatchJsonAcrossJobs(args: string[]): Promise<{
  noJobs: unknown;
  jobsOne: unknown;
  jobsFour: unknown;
}> {
  const noJobs = await captureCli(args);
  const jobsOne = await captureCli([...args, "--jobs", "1"]);
  const jobsFour = await captureCli([...args, "--jobs", "4"]);

  return {
    noJobs: JSON.parse(noJobs.stdout[0] ?? "{}"),
    jobsOne: JSON.parse(jobsOne.stdout[0] ?? "{}"),
    jobsFour: JSON.parse(jobsFour.stdout[0] ?? "{}"),
  };
}

function createCapturedStream(isTTY: boolean): { stream: ProgressOutputStream; writes: string[] } {
  const writes: string[] = [];
  return {
    writes,
    stream: {
      isTTY,
      write(chunk) {
        writes.push(chunk);
        return true;
      },
    },
  };
}

function parseDebugEvents(stderr: string[]): Array<Record<string, unknown>> {
  return stderr
    .filter((line) => line.startsWith("[debug] "))
    .map((line) => JSON.parse(line.slice(8)) as Record<string, unknown>);
}

function listDebugEventNames(stderr: string[]): string[] {
  return parseDebugEvents(stderr)
    .map((item) => item.event)
    .filter((event): event is string => typeof event === "string");
}

function findDebugEvents(
  stderr: string[],
  eventName: string,
): Array<Record<string, unknown>> {
  return parseDebugEvents(stderr).filter((item) => item.event === eventName);
}

describe("batch path resolution", () => {
  test("expands directory recursively with deterministic ordering", async () => {
    const root = await makeTempFixture("batch-order");
    await mkdir(join(root, "nested"), { recursive: true });
    await writeFile(join(root, "z.txt"), "zulu text");
    await writeFile(join(root, "a.md"), "alpha text");
    await writeFile(join(root, "nested", "b.markdown"), "beta text");
    await writeFile(join(root, "ignored.js"), "const x = 1;");

    const resolved = await resolveBatchFilePaths([root], {
      pathMode: "auto",
      recursive: true,
    });

    expect(resolved.files.map((file) => basename(file))).toEqual(["a.md", "b.markdown", "z.txt"]);
    expect(resolved.skipped.some((entry) => entry.path.endsWith("ignored.js"))).toBeTrue();
  });

  test("supports no-recursive directory traversal", async () => {
    const root = await makeTempFixture("batch-no-recursive");
    await mkdir(join(root, "nested"), { recursive: true });
    await writeFile(join(root, "a.md"), "alpha");
    await writeFile(join(root, "nested", "b.md"), "beta");

    const resolved = await resolveBatchFilePaths([root], {
      pathMode: "auto",
      recursive: false,
    });

    expect(resolved.files.map((file) => basename(file))).toEqual(["a.md"]);
  });

  test("deduplicates overlapping directory and file path inputs", async () => {
    const root = await makeTempFixture("batch-overlap");
    const explicitPath = join(root, "a.md");
    await writeFile(explicitPath, "alpha");
    await writeFile(join(root, "b.txt"), "beta");

    const resolved = await resolveBatchFilePaths([root, explicitPath, root], {
      pathMode: "auto",
      recursive: true,
    });

    expect(resolved.files.map((file) => basename(file))).toEqual(["a.md", "b.txt"]);
  });

  test("keeps mixed file + directory inputs deterministic via absolute-path sort", async () => {
    const root = await makeTempFixture("batch-mixed-order");
    const firstDir = join(root, "first");
    const secondDir = join(root, "second");
    const explicitFile = join(root, "z.log");

    await mkdir(firstDir, { recursive: true });
    await mkdir(secondDir, { recursive: true });
    await writeFile(join(firstDir, "b.txt"), "from first");
    await writeFile(join(secondDir, "a.md"), "from second");
    await writeFile(explicitFile, "explicit file");

    const resolved = await resolveBatchFilePaths([secondDir, explicitFile, firstDir], {
      pathMode: "auto",
      recursive: true,
    });

    const expected = [join(firstDir, "b.txt"), join(secondDir, "a.md"), explicitFile].sort(
      (left, right) => left.localeCompare(right),
    );

    expect(resolved.files).toEqual(expected);
  });

  test("deduplicates files discovered from overlapping directory roots", async () => {
    const root = await makeTempFixture("batch-overlap-roots");
    const nested = join(root, "nested");
    await mkdir(nested, { recursive: true });
    await writeFile(join(root, "root.md"), "root file");
    await writeFile(join(nested, "child.md"), "nested file");

    const resolved = await resolveBatchFilePaths([root, nested], {
      pathMode: "auto",
      recursive: true,
    });

    expect(resolved.files.map((file) => basename(file))).toEqual(["child.md", "root.md"]);
    expect(resolved.files.filter((file) => file.endsWith("child.md")).length).toBe(1);
  });
});

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
        line.includes("`inspect` accepts either positional text or one `--path <file>`, not both."),
      ),
    ).toBeTrue();
  });

  test("rejects inspect path directories", async () => {
    const root = await makeTempFixture("inspect-directory");

    const output = await captureCli(["inspect", "--path", root]);

    expect(output.exitCode).toBe(1);
    expect(output.stderr.some((line) => line.includes("`inspect --path` requires a regular file."))).toBeTrue();
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

describe("batch aggregation", () => {
  test("keeps merged breakdown order deterministic across files", async () => {
    const root = await makeTempFixture("batch-aggregate-order");
    await writeFile(join(root, "z.txt"), "zeta");
    await writeFile(join(root, "a.txt"), "alpha");

    const resolved = await resolveBatchFilePaths([root], {
      pathMode: "auto",
      recursive: true,
    });
    const loaded = await loadBatchInputs(resolved.files);
    const summary = await buildBatchSummary(loaded.files, "all", { mode: "chunk" });

    if ("section" in summary.aggregate) {
      throw new Error("Expected non-section aggregate result.");
    }

    expect(summary.aggregate.breakdown.mode).toBe("chunk");
    if (summary.aggregate.breakdown.mode === "chunk") {
      expect(summary.aggregate.breakdown.items[0]?.text.trim()).toBe("alpha");
      expect(summary.aggregate.breakdown.items[1]?.text.trim()).toBe("zeta");
    }
  });

  test("aggregates section split mode across markdown and txt", async () => {
    const root = await makeTempFixture("batch-section");
    const markdown = ["---", "title: One", "---", "Body one"].join("\n");
    await writeFile(join(root, "doc.md"), markdown);
    await writeFile(join(root, "plain.txt"), "plain file text");

    const resolved = await resolveBatchFilePaths([root], {
      pathMode: "auto",
      recursive: true,
    });
    const loaded = await loadBatchInputs(resolved.files);
    const summary = await buildBatchSummary(loaded.files, "split", { mode: "chunk" });

    if (!("section" in summary.aggregate)) {
      throw new Error("Expected section aggregate result.");
    }

    expect(summary.aggregate.total).toBe(7);
    const frontmatter = summary.aggregate.items.find((item) => item.source === "frontmatter");
    const content = summary.aggregate.items.find((item) => item.source === "content");
    expect(frontmatter?.result.total).toBe(2);
    expect(content?.result.total).toBe(5);
  });

  test("can compact collector segments during batch aggregation", async () => {
    const summary = await buildBatchSummary(
      [
        { path: "/tmp/a.txt", content: "alpha beta" },
        { path: "/tmp/b.txt", content: "gamma delta" },
      ],
      "all",
      { mode: "collector" },
      { preserveCollectorSegments: false },
    );

    if ("section" in summary.aggregate) {
      throw new Error("Expected non-section aggregate result.");
    }

    expect(summary.aggregate.breakdown.mode).toBe("collector");
    if (summary.aggregate.breakdown.mode === "collector") {
      expect(
        summary.aggregate.breakdown.items.every((item) => item.segments.length === 0),
      ).toBeTrue();
    }

    for (const file of summary.files) {
      if ("section" in file.result) {
        continue;
      }
      if (file.result.breakdown.mode !== "collector") {
        continue;
      }
      expect(file.result.breakdown.items.every((item) => item.segments.length === 0)).toBeTrue();
    }
  });

  test("aggregates char-collector locale totals across files", async () => {
    const summary = await buildBatchSummary(
      [
        { path: "/tmp/a.txt", content: "Hi 世界" },
        { path: "/tmp/b.txt", content: "Yo 世界" },
      ],
      "all",
      { mode: "char-collector" },
    );

    if ("section" in summary.aggregate) {
      throw new Error("Expected non-section aggregate result.");
    }

    expect(summary.aggregate.breakdown.mode).toBe("char-collector");
    if (summary.aggregate.breakdown.mode === "char-collector") {
      expect(summary.aggregate.breakdown.items).toEqual([
        { locale: "und-Latn", chars: 4, nonWords: undefined },
        { locale: "und-Hani", chars: 4, nonWords: undefined },
      ]);
    }
  });
});

describe("CLI batch output", () => {
  test("counts large multi-markdown batches in collector mode", async () => {
    const root = await makeTempFixture("cli-many-markdown-files");
    const fileCount = 1091;

    for (let index = 0; index < fileCount; index += 1) {
      const name = `file-${String(index).padStart(4, "0")}.md`;
      await writeFile(join(root, name), "alpha beta!");
    }

    const output = await captureCli([
      "--path",
      root,
      "--mode",
      "collector",
      "--non-words",
      "--format",
      "raw",
      "--quiet-skips",
    ]);

    expect(output.stderr.some((line) => line.includes("Maximum call stack"))).toBeFalse();
    expect(output.stdout).toEqual([String(fileCount * 3)]);
  });

  test("handles large collector merges without stack overflow", async () => {
    const root = await makeTempFixture("cli-collector-large-merge");
    await writeFile(join(root, "a.md"), "hello");
    await writeFile(join(root, "z.md"), "word ".repeat(900_000).trimEnd());

    const output = await captureCli([
      "--path",
      root,
      "--mode",
      "collector",
      "--non-words",
      "--format",
      "raw",
      "--quiet-skips",
    ]);

    expect(output.stderr.some((line) => line.includes("Maximum call stack"))).toBeFalse();
    expect(output.stdout).toEqual(["900001"]);
  });

  test("supports per-file output plus merged summary", async () => {
    const root = await makeTempFixture("cli-per-file");
    await writeFile(join(root, "a.txt"), "alpha words");
    await writeFile(join(root, "b.txt"), "beta words");

    const output = await captureCli(["--path", root, "--per-file", "--quiet-skips"]);

    expect(output.stdout.some((line) => line.includes("[File]"))).toBeTrue();
    expect(output.stdout.some((line) => line.includes("[Merged] 2 file(s)"))).toBeTrue();
  });

  test("keeps collector segments in merged json output", async () => {
    const root = await makeTempFixture("cli-collector-json-segments");
    await writeFile(join(root, "a.txt"), "alpha beta");
    await writeFile(join(root, "b.txt"), "gamma delta");

    const output = await captureCli([
      "--path",
      root,
      "--mode",
      "collector",
      "--format",
      "json",
      "--quiet-skips",
    ]);
    const parsed = JSON.parse(output.stdout[0] ?? "{}");

    expect(parsed.breakdown.mode).toBe("collector");
    expect(
      parsed.breakdown.items.some(
        (item: { segments?: string[] }) => (item.segments?.length ?? 0) > 0,
      ),
    ).toBeTrue();
  });

  test("shows skip diagnostics only with --debug", async () => {
    const root = await makeTempFixture("cli-skips");
    const binary = join(root, "binary.dat");
    await writeFile(join(root, "note.txt"), "plain text");
    await writeFile(binary, Buffer.from([0, 1, 2, 3]));

    const withoutDebug = await captureCli(["--path", root, "--path", binary, "--format", "raw"]);
    expect(withoutDebug.stderr.some((line) => line.includes("Skipped"))).toBeFalse();

    const withDebug = await captureCli([
      "--path",
      root,
      "--path",
      binary,
      "--format",
      "raw",
      "--debug",
    ]);
    expect(withDebug.stderr.some((line) => line.includes("Skipped"))).toBeTrue();

    const quiet = await captureCli([
      "--path",
      root,
      "--path",
      binary,
      "--format",
      "raw",
      "--debug",
      "--quiet-skips",
    ]);
    expect(quiet.stderr.some((line) => line.includes("Skipped"))).toBeFalse();
  });

  test("omits skipped details from per-file json without --debug", async () => {
    const root = await makeTempFixture("cli-json-skips");
    await writeFile(join(root, "note.txt"), "plain text");
    await writeFile(join(root, "ignore.js"), "const x = 1;");

    const output = await captureCli(["--path", root, "--per-file", "--format", "json"]);
    const parsed = JSON.parse(output.stdout[0] ?? "{}");
    expect(parsed.skipped).toBeUndefined();

    const debugOutput = await captureCli([
      "--path",
      root,
      "--per-file",
      "--format",
      "json",
      "--debug",
    ]);
    const debugParsed = JSON.parse(debugOutput.stdout[0] ?? "{}");
    expect(Array.isArray(debugParsed.skipped)).toBeTrue();
    expect(Array.isArray(debugParsed.debug?.skipped)).toBeTrue();
    expect(debugParsed.debug?.skipped).toEqual(debugParsed.skipped);
  });

  test("adds detector debug summaries to per-file json and keeps parity across jobs routes", async () => {
    if (!hasWasmDetectorRuntime()) {
      return;
    }

    const root = await makeTempFixture("cli-json-detector-debug-summaries");
    await writeFile(
      join(root, "a.txt"),
      "This sentence should clearly be detected as English for the wasm detector path.",
    );
    await writeFile(
      join(root, "b.txt"),
      "Ceci est une phrase francaise suffisamment longue pour que le detecteur identifie correctement la langue.",
    );

    const noJobs = await captureCli([
      "--path",
      root,
      "--per-file",
      "--format",
      "json",
      "--debug",
      "--detector",
      "wasm",
    ]);
    const jobsFour = await captureCli([
      "--path",
      root,
      "--per-file",
      "--format",
      "json",
      "--debug",
      "--detector",
      "wasm",
      "--jobs",
      "4",
    ]);

    const noJobsParsed = JSON.parse(noJobs.stdout[0] ?? "{}");
    const jobsFourParsed = JSON.parse(jobsFour.stdout[0] ?? "{}");

    expect(noJobsParsed.debug?.detector?.mode).toBe("wasm");
    expect(jobsFourParsed.debug?.detector?.mode).toBe("wasm");
    expect(noJobsParsed.files.every((file: { debug?: { detector?: { windowsTotal?: number } } }) =>
      (file.debug?.detector?.windowsTotal ?? 0) >= 1)).toBeTrue();
    expect(jobsFourParsed.files.every((file: { debug?: { detector?: { windowsTotal?: number } } }) =>
      (file.debug?.detector?.windowsTotal ?? 0) >= 1)).toBeTrue();
    expect(noJobsParsed.debug.detector.windowsTotal).toBe(jobsFourParsed.debug.detector.windowsTotal);
  });

  test("forwards detector debug events from worker batch runs", async () => {
    if (!hasWasmDetectorRuntime()) {
      return;
    }

    const root = await makeTempFixture("cli-worker-detector-debug-events");
    await writeFile(
      join(root, "a.txt"),
      "This sentence should clearly be detected as English for the wasm detector path.",
    );
    await writeFile(
      join(root, "b.txt"),
      "Ceci est une phrase francaise suffisamment longue pour que le detecteur identifie correctement la langue.",
    );

    const output = await captureCli([
      "--path",
      root,
      "--format",
      "raw",
      "--debug",
      "--verbose",
      "--detector",
      "wasm",
      "--jobs",
      "4",
    ]);

    const eventNames = listDebugEventNames(output.stderr);
    expect(eventNames.includes("detector.window.start")).toBeTrue();
    expect(eventNames.includes("detector.window.accepted")).toBeTrue();
    expect(eventNames.includes("detector.summary")).toBeTrue();
  });

  test("marks batch detector debug events as file-scoped across executors", async () => {
    if (!hasWasmDetectorRuntime()) {
      return;
    }

    const root = await makeTempFixture("cli-batch-detector-event-scope");
    await writeFile(
      join(root, "a.txt"),
      "This sentence should clearly be detected as English for the wasm detector path.",
    );
    await writeFile(
      join(root, "b.txt"),
      "Ceci est une phrase francaise suffisamment longue pour que le detecteur identifie correctement la langue.",
    );

    const asyncOutput = await captureCli([
      "--path",
      root,
      "--format",
      "raw",
      "--debug",
      "--verbose",
      "--detector",
      "wasm",
    ]);
    const workerOutput = await captureCli([
      "--path",
      root,
      "--format",
      "raw",
      "--debug",
      "--verbose",
      "--detector",
      "wasm",
      "--jobs",
      "4",
    ]);

    for (const output of [asyncOutput, workerOutput]) {
      const detectorEvents = parseDebugEvents(output.stderr).filter((item) => item.topic === "detector");
      expect(detectorEvents.length > 0).toBeTrue();
      expect(
        detectorEvents.every((item) => item.scope === "file" && typeof item.path === "string"),
      ).toBeTrue();
    }
  });

  test("emits file-scoped compact detector evidence events in async batch runs", async () => {
    if (!hasWasmDetectorRuntime()) {
      return;
    }

    const root = await makeTempFixture("cli-batch-detector-evidence-async");
    await writeFile(
      join(root, "a.txt"),
      "This sentence should clearly be detected as English for the wasm detector path. This second sentence keeps the detector window long enough for evidence output.",
    );
    await writeFile(
      join(root, "b.txt"),
      "Ceci est une phrase francaise suffisamment longue pour que le detecteur identifie correctement la langue et emette une preuve utile.",
    );

    const output = await captureCli([
      "--path",
      root,
      "--format",
      "raw",
      "--debug",
      "--detector",
      "wasm",
      "--detector-evidence",
    ]);

    const evidenceEvents = findDebugEvents(output.stderr, "detector.window.evidence");
    expect(evidenceEvents.length).toBeGreaterThanOrEqual(2);
    expect(
      evidenceEvents.every(
        (item) =>
          item.scope === "file" &&
          item.verbosity === "compact" &&
          typeof item.path === "string" &&
          typeof item.textPreview === "string",
      ),
    ).toBeTrue();
  });

  test("forwards file-scoped detector evidence events from worker batch runs", async () => {
    if (!hasWasmDetectorRuntime()) {
      return;
    }

    const root = await makeTempFixture("cli-batch-detector-evidence-worker");
    await writeFile(
      join(root, "a.txt"),
      "This sentence should clearly be detected as English for the wasm detector path. This second sentence keeps the detector window long enough for evidence output.",
    );
    await writeFile(
      join(root, "b.txt"),
      "Ceci est une phrase francaise suffisamment longue pour que le detecteur identifie correctement la langue et emette une preuve utile.",
    );

    const output = await captureCli([
      "--path",
      root,
      "--format",
      "raw",
      "--debug",
      "--detector",
      "wasm",
      "--detector-evidence",
      "--jobs",
      "4",
    ]);

    const evidenceEvents = findDebugEvents(output.stderr, "detector.window.evidence");
    expect(evidenceEvents.length).toBeGreaterThanOrEqual(2);
    expect(
      evidenceEvents.every(
        (item) =>
          item.scope === "file" &&
          item.verbosity === "compact" &&
          typeof item.path === "string" &&
          typeof item.textPreview === "string",
      ),
    ).toBeTrue();
  });

  test("does not double count overlapping path inputs", async () => {
    const root = await makeTempFixture("cli-overlap");
    const explicitPath = join(root, "a.txt");
    await writeFile(explicitPath, "alpha beta");
    await writeFile(join(root, "b.txt"), "gamma");

    const output = await captureCli(["--path", root, "--path", explicitPath, "--format", "raw"]);

    expect(output.stdout).toEqual(["3"]);
  });

  test("treats default batch path as equivalent to --jobs=1", async () => {
    const root = await makeTempFixture("cli-jobs-default-equals-jobs-1");
    await writeFile(join(root, "a.txt"), "alpha beta");
    await writeFile(join(root, "b.txt"), "gamma delta");

    const defaultOutput = await captureCli([
      "--path",
      root,
      "--format",
      "raw",
      "--debug",
      "--quiet-skips",
    ]);
    const jobsOneOutput = await captureCli([
      "--path",
      root,
      "--jobs",
      "1",
      "--format",
      "raw",
      "--debug",
      "--quiet-skips",
    ]);

    const defaultEvents = parseDebugEvents(defaultOutput.stderr);
    const jobsOneEvents = parseDebugEvents(jobsOneOutput.stderr);
    const defaultStrategy = defaultEvents.find((item) => item.event === "batch.jobs.strategy");
    const jobsOneStrategy = jobsOneEvents.find((item) => item.event === "batch.jobs.strategy");
    const defaultExecutor = defaultEvents.find((item) => item.event === "batch.jobs.executor");
    const jobsOneExecutor = jobsOneEvents.find((item) => item.event === "batch.jobs.executor");

    expect(defaultOutput.stdout).toEqual(jobsOneOutput.stdout);
    expect(defaultStrategy?.strategy).toBe("load-count");
    expect(jobsOneStrategy?.strategy).toBe("load-count");
    expect(defaultExecutor?.executor).toBe("async-main");
    expect(jobsOneExecutor?.executor).toBe("async-main");
  });

  test("keeps totals consistent between --jobs=1 and --jobs>1 routes", async () => {
    const root = await makeTempFixture("cli-jobs-route-policy-parity");
    await writeFile(join(root, "z.txt"), "zeta");
    await writeFile(join(root, "a.txt"), "alpha beta");
    await writeFile(join(root, "binary.dat"), Buffer.from([0, 1, 2, 3]));

    const baseline = await captureCli([
      "--path",
      root,
      "--jobs",
      "1",
      "--format",
      "raw",
      "--quiet-skips",
    ]);
    const concurrent = await captureCli([
      "--path",
      root,
      "--jobs",
      "4",
      "--format",
      "raw",
      "--quiet-skips",
    ]);

    expect(concurrent.stdout).toEqual(baseline.stdout);
  });

  test("keeps empty files as zero-count inputs when --jobs>1", async () => {
    const root = await makeTempFixture("cli-jobs-empty-file-zero-count");
    await writeFile(join(root, "empty.txt"), "");
    await writeFile(join(root, "words.txt"), "alpha beta");

    const baseline = await captureCli([
      "--path",
      root,
      "--jobs",
      "1",
      "--format",
      "raw",
      "--quiet-skips",
    ]);
    const concurrent = await captureCli([
      "--path",
      root,
      "--jobs",
      "4",
      "--format",
      "raw",
      "--quiet-skips",
    ]);

    expect(concurrent.stdout).toEqual(baseline.stdout);
    expect(concurrent.stdout).toEqual(["2"]);
  });

  test("keeps per-file ordering deterministic when --jobs>1", async () => {
    const root = await makeTempFixture("cli-jobs-worker-order");
    await writeFile(join(root, "z.txt"), "zeta");
    await writeFile(join(root, "a.txt"), "alpha");
    await writeFile(join(root, "m.txt"), "mu");

    const output = await captureCli([
      "--path",
      root,
      "--jobs",
      "3",
      "--per-file",
      "--format",
      "json",
      "--quiet-skips",
    ]);
    const parsed = JSON.parse(output.stdout[0] ?? "{}");
    const files = Array.isArray(parsed.files) ? parsed.files : [];

    expect(files.map((item: { path: string }) => basename(item.path))).toEqual([
      "a.txt",
      "m.txt",
      "z.txt",
    ]);
  });

  test("keeps sectioned json output parity between --jobs=1 and --jobs>1", async () => {
    const root = await makeTempFixture("cli-jobs-route-policy-parity-sectioned");
    await writeFile(join(root, "a.md"), ["---", "title: One", "---", "Alpha beta"].join("\n"));
    await writeFile(join(root, "b.txt"), "Gamma delta");

    const baseline = await captureCli([
      "--path",
      root,
      "--section",
      "split",
      "--jobs",
      "1",
      "--format",
      "json",
      "--quiet-skips",
    ]);
    const concurrent = await captureCli([
      "--path",
      root,
      "--section",
      "split",
      "--jobs",
      "4",
      "--format",
      "json",
      "--quiet-skips",
    ]);

    const baselineParsed = JSON.parse(baseline.stdout[0] ?? "{}");
    const concurrentParsed = JSON.parse(concurrent.stdout[0] ?? "{}");
    expect(concurrentParsed).toEqual(baselineParsed);
  });

  test("keeps json --misc output parity across no --jobs, --jobs=1, and --jobs>1", async () => {
    const root = await makeTempFixture("cli-jobs-json-misc-parity");
    await writeFile(join(root, "a.txt"), "alpha  beta\n\ngamma");
    await writeFile(join(root, "b.md"), ["---", "title: T", "---", "delta\nepsilon"].join("\n"));

    const merged = await captureBatchJsonAcrossJobs([
      "--path",
      root,
      "--format",
      "json",
      "--misc",
      "--quiet-skips",
    ]);
    expect(merged.jobsOne).toEqual(merged.noJobs);
    expect(merged.jobsFour).toEqual(merged.noJobs);

    const perFile = await captureBatchJsonAcrossJobs([
      "--path",
      root,
      "--per-file",
      "--format",
      "json",
      "--misc",
      "--quiet-skips",
    ]);
    expect(perFile.jobsOne).toEqual(perFile.noJobs);
    expect(perFile.jobsFour).toEqual(perFile.noJobs);

    const sectioned = await captureBatchJsonAcrossJobs([
      "--path",
      root,
      "--section",
      "split",
      "--format",
      "json",
      "--misc",
      "--quiet-skips",
    ]);
    expect(sectioned.jobsOne).toEqual(sectioned.noJobs);
    expect(sectioned.jobsFour).toEqual(sectioned.noJobs);
  });

  test("keeps json --total-of whitespace,words parity across job routes", async () => {
    const root = await makeTempFixture("cli-jobs-json-total-of-whitespace-words-parity");
    await writeFile(join(root, "a.txt"), "alpha  beta\n\ngamma");
    await writeFile(join(root, "b.md"), ["---", "title: T", "---", "delta\nepsilon"].join("\n"));

    const merged = await captureBatchJsonAcrossJobs([
      "--path",
      root,
      "--format",
      "json",
      "--total-of",
      "whitespace,words",
      "--quiet-skips",
    ]);
    expect(merged.jobsOne).toEqual(merged.noJobs);
    expect(merged.jobsFour).toEqual(merged.noJobs);

    const perFile = await captureBatchJsonAcrossJobs([
      "--path",
      root,
      "--per-file",
      "--format",
      "json",
      "--total-of",
      "whitespace,words",
      "--quiet-skips",
    ]);
    expect(perFile.jobsOne).toEqual(perFile.noJobs);
    expect(perFile.jobsFour).toEqual(perFile.noJobs);

    const sectioned = await captureBatchJsonAcrossJobs([
      "--path",
      root,
      "--section",
      "split",
      "--format",
      "json",
      "--total-of",
      "whitespace,words",
      "--quiet-skips",
    ]);
    expect(sectioned.jobsOne).toEqual(sectioned.noJobs);
    expect(sectioned.jobsFour).toEqual(sectioned.noJobs);
  });

  test("emits executor diagnostics for --jobs>1 route", async () => {
    const root = await makeTempFixture("cli-jobs-worker-executor");
    await writeFile(join(root, "a.txt"), "alpha beta");
    await writeFile(join(root, "b.txt"), "gamma delta");

    const output = await captureCli([
      "--path",
      root,
      "--jobs",
      "4",
      "--format",
      "raw",
      "--debug",
      "--quiet-skips",
    ]);
    const events = parseDebugEvents(output.stderr);
    const strategy = events.find((item) => item.event === "batch.jobs.strategy");
    const executor = events.find((item) => item.event === "batch.jobs.executor");

    expect(strategy?.strategy).toBe("load-count");
    expect(executor).toBeDefined();
    expect(executor?.executor === "worker-pool" || executor?.executor === "async-fallback").toBeTrue();
    if (executor?.executor === "async-fallback") {
      expect(typeof executor.reason).toBe("string");
    }
    expect(output.stdout).toEqual(["4"]);
  });

  test("falls back to async executor when worker route is disabled", async () => {
    const root = await makeTempFixture("cli-jobs-worker-fallback");
    await writeFile(join(root, "a.txt"), "alpha beta");
    await writeFile(join(root, "b.txt"), "gamma delta");

    const previousDisableWorkerJobs = process.env.WORD_COUNTER_DISABLE_WORKER_JOBS;
    process.env.WORD_COUNTER_DISABLE_WORKER_JOBS = "1";
    try {
      const output = await captureCli([
        "--path",
        root,
        "--jobs",
        "4",
        "--format",
        "raw",
        "--debug",
        "--quiet-skips",
      ]);
      const events = parseDebugEvents(output.stderr);
      const executor = events.find((item) => item.event === "batch.jobs.executor");

      expect(executor?.executor).toBe("async-fallback");
      expect(
        output.stderr.some((line) => line.includes("Worker executor unavailable; falling back to async load+count")),
      ).toBeTrue();
      expect(output.stdout).toEqual(["4"]);
    } finally {
      if (previousDisableWorkerJobs === undefined) {
        delete process.env.WORD_COUNTER_DISABLE_WORKER_JOBS;
      } else {
        process.env.WORD_COUNTER_DISABLE_WORKER_JOBS = previousDisableWorkerJobs;
      }
    }
  });

  test("treats invalid counting options as fatal in worker route", async () => {
    const root = await makeTempFixture("cli-jobs-worker-count-error");
    const filePath = join(root, "a.txt");
    await writeFile(filePath, "alpha beta");

    const outcome = await countBatchInputsWithWorkerJobs([filePath], {
      jobs: 4,
      section: "all",
      wcOptions: {
        mode: "chunk",
        latinTagHint: "invalid_tag",
      },
      preserveCollectorSegments: false,
    })
      .then((result) => ({ result }))
      .catch((error: unknown) => ({ error }));

    if ("error" in outcome) {
      if (outcome.error instanceof WorkerRouteUnavailableError) {
        return;
      }

      const message = outcome.error instanceof Error ? outcome.error.message : String(outcome.error);
      expect(/invalid language tag: invalid_tag/i.test(message)).toBeTrue();
      return;
    }

    expect(outcome.result.files.length).toBe(0);
    expect(outcome.result.skipped.length).toBe(0);
    throw new Error("Expected worker route to fail for invalid language tag.");
  });

  test("does not attach detector debug summaries in worker route without debug callback", async () => {
    if (!hasWasmDetectorRuntime()) {
      return;
    }

    const root = await makeTempFixture("cli-jobs-worker-no-detector-debug");
    const filePath = join(root, "a.txt");
    await writeFile(
      filePath,
      "This sentence should clearly be detected as English for the wasm detector path.",
    );

    const outcome = await countBatchInputsWithWorkerJobs([filePath], {
      jobs: 4,
      section: "all",
      detectorMode: "wasm",
      wcOptions: {
        mode: "chunk",
      },
      preserveCollectorSegments: false,
    })
      .then((result) => ({ result }))
      .catch((error: unknown) => ({ error }));

    if ("error" in outcome) {
      if (outcome.error instanceof WorkerRouteUnavailableError) {
        return;
      }

      throw outcome.error;
    }

    expect(outcome.result.files[0]?.debug).toBeUndefined();
  });

  test("emits advisory warning when requested --jobs exceeds suggested limit", async () => {
    const root = await makeTempFixture("cli-jobs-advisory-warning");
    await writeFile(join(root, "a.txt"), "alpha beta");
    await writeFile(join(root, "b.txt"), "gamma delta");
    const expectedCappedJobs = resolveBatchJobsLimit().suggestedMaxJobs;

    const output = await captureCli([
      "--path",
      root,
      "--jobs",
      "99999",
      "--format",
      "raw",
      "--debug",
      "--quiet-skips",
    ]);
    const events = parseDebugEvents(output.stderr);
    const strategy = events.find((item) => item.event === "batch.jobs.strategy");

    expect(output.stderr.some((line) => line.includes("Warning: requested --jobs=99999"))).toBeTrue();
    expect(output.stderr.some((line) => line.includes(`Running with --jobs=${expectedCappedJobs}`))).toBeTrue();
    expect(strategy?.jobs).toBe(expectedCappedJobs);
    expect(output.stdout).toEqual(["4"]);
  });

  test("suppresses advisory warning when --quiet-warnings is enabled", async () => {
    const root = await makeTempFixture("cli-jobs-advisory-warning-quiet");
    await writeFile(join(root, "a.txt"), "alpha beta");
    await writeFile(join(root, "b.txt"), "gamma delta");

    const output = await captureCli([
      "--path",
      root,
      "--jobs",
      "99999",
      "--format",
      "raw",
      "--quiet-warnings",
    ]);

    expect(output.stderr.some((line) => line.includes("Warning: requested --jobs=99999"))).toBeFalse();
    expect(output.stdout).toEqual(["4"]);
  });

  test("suppresses worker fallback warning when --quiet-warnings is enabled", async () => {
    const root = await makeTempFixture("cli-jobs-worker-fallback-quiet");
    await writeFile(join(root, "a.txt"), "alpha beta");
    await writeFile(join(root, "b.txt"), "gamma delta");

    const previousDisableWorkerJobs = process.env.WORD_COUNTER_DISABLE_WORKER_JOBS;
    process.env.WORD_COUNTER_DISABLE_WORKER_JOBS = "1";
    try {
      const output = await captureCli([
        "--path",
        root,
        "--jobs",
        "4",
        "--format",
        "raw",
        "--quiet-warnings",
      ]);
      expect(
        output.stderr.some((line) => line.includes("Worker executor unavailable; falling back to async load+count")),
      ).toBeFalse();
      expect(output.stdout).toEqual(["4"]);
    } finally {
      if (previousDisableWorkerJobs === undefined) {
        delete process.env.WORD_COUNTER_DISABLE_WORKER_JOBS;
      } else {
        process.env.WORD_COUNTER_DISABLE_WORKER_JOBS = previousDisableWorkerJobs;
      }
    }
  });
});

describe("CLI jobs diagnostics", () => {
  test("prints jobs limit summary as JSON", async () => {
    const output = await captureCli(["--print-jobs-limit"]);
    const parsed = JSON.parse(output.stdout[0] ?? "{}");

    expect(typeof parsed.suggestedMaxJobs).toBe("number");
    expect(typeof parsed.cpuLimit).toBe("number");
    expect(typeof parsed.uvThreadpool).toBe("number");
    expect(typeof parsed.ioLimit).toBe("number");
    expect(parsed.suggestedMaxJobs >= 1).toBeTrue();
  });

  test("enforces standalone usage for --print-jobs-limit", () => {
    expect(() =>
      validateStandalonePrintJobsLimitUsage([
        "node",
        "word-counter",
        "--print-jobs-limit",
        "--format",
        "json",
      ]),
    ).toThrow("`--print-jobs-limit` must be used alone.");
  });
});

describe("CLI doctor diagnostics", () => {
  test("prints human-readable doctor output by default", async () => {
    const output = await captureCli(["doctor"]);

    expect(output.exitCode).toBe(0);
    expect(output.stdout[0]?.includes("Doctor:")).toBeTrue();
    expect(output.stdout.some((line) => line.includes("Runtime"))).toBeTrue();
    expect(output.stdout.some((line) => line.includes("Segmenter"))).toBeTrue();
    expect(output.stdout.some((line) => line.includes("Batch jobs"))).toBeTrue();
    expect(output.stdout.some((line) => line.includes("Worker route"))).toBeTrue();
  });

  test("prints compact doctor JSON with the documented payload shape", async () => {
    const output = await captureCli(["doctor", "--format", "json"]);
    const parsed = JSON.parse(output.stdout[0] ?? "{}");

    expect(output.exitCode).toBe(0);
    expect(Object.keys(parsed)).toEqual([
      "status",
      "runtime",
      "segmenter",
      "jobs",
      "workerRoute",
      "warnings",
    ]);
    expect(Object.keys(parsed.runtime ?? {})).toEqual([
      "packageVersion",
      "buildChannel",
      "requiredNodeRange",
      "nodeVersion",
      "meetsProjectRequirement",
      "platform",
      "arch",
    ]);
    expect(Object.keys(parsed.segmenter ?? {})).toEqual([
      "available",
      "wordGranularity",
      "graphemeGranularity",
      "sampleWordSegmentation",
    ]);
    expect(Object.keys(parsed.jobs ?? {})).toEqual([
      "suggestedMaxJobs",
      "cpuLimit",
      "uvThreadpool",
      "ioLimit",
    ]);
    expect(Object.keys(parsed.workerRoute ?? {})).toEqual([
      "workerThreadsAvailable",
      "workerRouteDisabledByEnv",
      "disableWorkerJobsEnv",
      "workerPoolModuleLoadable",
      "workerEntryFound",
    ]);
    expect(Array.isArray(parsed.warnings)).toBeTrue();
    expect(output.stdout[0]?.includes("\n")).toBeFalse();
  });

  test("prints pretty doctor JSON only when --pretty is used", async () => {
    const output = await captureCli(["doctor", "--format", "json", "--pretty"]);

    expect(output.exitCode).toBe(0);
    expect(output.stdout[0]?.includes('\n  "status": ')).toBeTrue();
  });

  test("prints doctor help for explicit doctor help requests", async () => {
    const output = await captureCli(["doctor", "--help"]);

    expect(output.exitCode).toBe(0);
    expect(output.stderr).toEqual([]);
    expect(output.stdout[0]).toContain("Usage: word-counter doctor [options]");
  });

  test("returns fail with exit code 2 when Intl.Segmenter is unavailable", async () => {
    const output = await captureCli(["doctor", "--format", "json"], {
      doctorRuntime: {
        intl: {},
      },
    });
    const parsed = JSON.parse(output.stdout[0] ?? "{}");

    expect(output.exitCode).toBe(2);
    expect(parsed.status).toBe("fail");
    expect(parsed.segmenter.available).toBeFalse();
    expect(parsed.warnings).toContain("Intl.Segmenter is unavailable.");
  });

  test("returns fail with exit code 2 when Intl.Segmenter constructors are unusable", async () => {
    const output = await captureCli(["doctor", "--format", "json"], {
      doctorRuntime: {
        intl: {
          Segmenter: class {
            constructor() {
              throw new Error("boom");
            }
          } as never,
        },
      },
    });
    const parsed = JSON.parse(output.stdout[0] ?? "{}");

    expect(output.exitCode).toBe(2);
    expect(parsed.status).toBe("fail");
    expect(parsed.segmenter.available).toBeTrue();
    expect(parsed.segmenter.wordGranularity).toBeFalse();
    expect(parsed.segmenter.graphemeGranularity).toBeFalse();
  });

  test("returns fail when sample segmentation yields no segments", async () => {
    const output = await captureCli(["doctor", "--format", "json"], {
      doctorRuntime: {
        intl: {
          Segmenter: class {
            constructor(_locale: string, _options: { granularity: "word" | "grapheme" }) {}

            segment(): Iterable<unknown> {
              return [];
            }
          } as never,
        },
      },
    });
    const parsed = JSON.parse(output.stdout[0] ?? "{}");

    expect(output.exitCode).toBe(2);
    expect(parsed.status).toBe("fail");
    expect(parsed.segmenter.available).toBeTrue();
    expect(parsed.segmenter.wordGranularity).toBeTrue();
    expect(parsed.segmenter.graphemeGranularity).toBeTrue();
    expect(parsed.segmenter.sampleWordSegmentation).toBeFalse();
    expect(parsed.warnings).toContain("Intl.Segmenter sample segmentation failed.");
  });

  test("returns warn with exit code 0 when runtime policy fails but capability checks pass", async () => {
    const output = await captureCli(["doctor", "--format", "json"], {
      doctorRuntime: {
        nodeVersion: "v18.19.0",
      },
    });
    const parsed = JSON.parse(output.stdout[0] ?? "{}");

    expect(output.exitCode).toBe(0);
    expect(parsed.status).toBe("warn");
    expect(parsed.runtime.meetsProjectRequirement).toBeFalse();
    expect(
      parsed.warnings.includes("Node.js v18.19.0 is outside the supported range >=20."),
    ).toBeTrue();
  });

  test("reports rc builds as rc instead of stable", async () => {
    const output = await captureCli(["doctor", "--format", "json"], {
      doctorRuntime: {
        packageVersion: "0.1.5-rc.1",
      },
    });
    const parsed = JSON.parse(output.stdout[0] ?? "{}");

    expect(output.exitCode).toBe(0);
    expect(parsed.runtime.buildChannel).toBe("rc");
  });

  test("reports worker env toggles and jobs diagnostics from the current helpers", async () => {
    const output = await captureCli(["doctor", "--format", "json"], {
      doctorRuntime: {
        env: {
          UV_THREADPOOL_SIZE: "7",
          WORD_COUNTER_DISABLE_WORKER_JOBS: "1",
        },
      },
    });
    const parsed = JSON.parse(output.stdout[0] ?? "{}");

    expect(parsed.jobs.uvThreadpool).toBe(7);
    expect(parsed.jobs.ioLimit).toBe(14);
    expect(parsed.workerRoute.workerRouteDisabledByEnv).toBeTrue();
    expect(parsed.workerRoute.disableWorkerJobsEnv).toBe("1");
  });

  test("rejects --pretty without --format json", async () => {
    const output = await captureCli(["doctor", "--pretty"]);

    expect(output.exitCode).toBe(1);
    expect(output.stdout).toEqual([]);
    expect(output.stderr.some((line) => line.includes("`--pretty` requires `--format json`."))).toBeTrue();
  });

  test("rejects unsupported output modes", async () => {
    const output = await captureCli(["doctor", "--format", "raw"]);

    expect(output.exitCode).toBe(1);
    expect(output.stdout).toEqual([]);
    expect(
      output.stderr.some((line) =>
        line.includes("`doctor` only supports default text output or `--format json`."),
      ),
    ).toBeTrue();
  });

  test("rejects inherited batch flags for explicit doctor invocations", async () => {
    const withPath = await captureCli(["doctor", "--path", "/tmp/example"]);

    expect(withPath.exitCode).toBe(1);
    expect(
      withPath.stderr.some((line) => line.includes("`--path` is not supported by `doctor`.")),
    ).toBeTrue();
  });

  test("keeps root counting flows intact after adding the doctor subcommand", async () => {
    const output = await captureCli(["Hello", "world"]);

    expect(output.stdout[0]).toBe("Total words: 2");
  });

  test("keeps leading `doctor` text on the root counting path", async () => {
    const output = await captureCli(["doctor", "appointment"]);

    expect(output.exitCode).toBe(0);
    expect(output.stderr).toEqual([]);
    expect(output.stdout[0]).toBe("Total words: 2");
  });

  test("keeps root --print-jobs-limit behavior intact after adding the doctor subcommand", async () => {
    const output = await captureCli(["--print-jobs-limit"]);
    const parsed = JSON.parse(output.stdout[0] ?? "{}");

    expect(typeof parsed.suggestedMaxJobs).toBe("number");
    expect(output.stderr).toEqual([]);
  });

  test("keeps root --print-jobs-limit standalone validation unchanged", () => {
    expect(() =>
      validateStandalonePrintJobsLimitUsage([
        "node",
        "word-counter",
        "--print-jobs-limit",
        "--format",
        "json",
      ]),
    ).toThrow("`--print-jobs-limit` must be used alone.");
  });
});

describe("CLI progress output", () => {
  test("auto-enables transient progress in standard batch mode", async () => {
    const root = await makeTempFixture("cli-progress-standard");
    await writeFile(join(root, "a.txt"), "alpha beta");
    await writeFile(join(root, "b.txt"), "gamma delta");
    const progress = createCapturedStream(true);

    const output = await captureCli(["--path", root], { stderr: progress.stream });

    const hasPattern = progress.writes.some((chunk) =>
      /Counting files \[[█░]{20}\]\s+\d{1,3}%\s+\d+\/\d+\s+elapsed \d{2}:\d{2}\.\d/.test(chunk),
    );
    expect(hasPattern).toBeTrue();
    expect(
      progress.writes.some((chunk) =>
        /Finalizing aggregate\.\.\. elapsed \d{2}:\d{2}\.\d/.test(chunk),
      ),
    ).toBeTrue();
    expect(progress.writes.some((chunk) => /\r +\r/.test(chunk))).toBeTrue();
    expect(output.stdout[0]).toBe("Total words: 4");
  });

  test("supports --no-progress opt-out", async () => {
    const root = await makeTempFixture("cli-progress-off");
    await writeFile(join(root, "a.txt"), "alpha beta");
    await writeFile(join(root, "b.txt"), "gamma delta");
    const progress = createCapturedStream(true);

    await captureCli(["--path", root, "--no-progress"], { stderr: progress.stream });

    expect(progress.writes).toEqual([]);
  });

  test("keeps final progress line visible with --keep-progress", async () => {
    const root = await makeTempFixture("cli-progress-keep-visible");
    await writeFile(join(root, "a.txt"), "alpha beta");
    await writeFile(join(root, "b.txt"), "gamma delta");
    const progress = createCapturedStream(true);

    await captureCli(["--path", root, "--keep-progress"], { stderr: progress.stream });

    expect(
      progress.writes.some((chunk) =>
        /\rCounting files \[[█░]{20}\]\s+100%\s+\d+\/\d+\s+elapsed \d{2}:\d{2}\.\d/.test(chunk),
      ),
    ).toBeTrue();
    expect(
      progress.writes.some((chunk) =>
        /\nFinalizing aggregate\.\.\. elapsed \d{2}:\d{2}\.\d/.test(chunk),
      ),
    ).toBeTrue();
    expect(progress.writes.some((chunk) => chunk.includes("Counting files ["))).toBeTrue();
    expect(progress.writes.some((chunk) => /\r +\r/.test(chunk))).toBeFalse();
    expect(progress.writes.some((chunk) => chunk === "\n")).toBeTrue();
  });

  test("keeps --no-progress precedence over --keep-progress", async () => {
    const root = await makeTempFixture("cli-progress-no-progress-precedence");
    await writeFile(join(root, "a.txt"), "alpha beta");
    await writeFile(join(root, "b.txt"), "gamma delta");
    const progress = createCapturedStream(true);

    await captureCli(["--path", root, "--no-progress", "--keep-progress"], {
      stderr: progress.stream,
    });

    expect(progress.writes).toEqual([]);
  });

  test("does not show progress for single-input runs by default", async () => {
    const root = await makeTempFixture("cli-progress-single");
    const singlePath = join(root, "single.txt");
    await writeFile(singlePath, "alpha beta");
    const progress = createCapturedStream(true);

    await captureCli(["--path", singlePath], { stderr: progress.stream });

    expect(progress.writes).toEqual([]);
  });

  test("suppresses progress in raw/json output modes", async () => {
    const root = await makeTempFixture("cli-progress-machine");
    await writeFile(join(root, "a.txt"), "alpha beta");
    await writeFile(join(root, "b.txt"), "gamma delta");
    const rawProgress = createCapturedStream(true);
    const jsonProgress = createCapturedStream(true);

    const raw = await captureCli(["--path", root, "--format", "raw"], {
      stderr: rawProgress.stream,
    });
    const json = await captureCli(["--path", root, "--format", "json"], {
      stderr: jsonProgress.stream,
    });

    expect(rawProgress.writes).toEqual([]);
    expect(jsonProgress.writes).toEqual([]);
    expect(raw.stdout).toEqual(["4"]);
    const parsed = JSON.parse(json.stdout[0] ?? "{}");
    expect(parsed.total).toBe(4);
  });

  test("falls back to line progress logs in non-tty streams", async () => {
    const root = await makeTempFixture("cli-progress-non-tty");
    await writeFile(join(root, "a.txt"), "alpha beta");
    await writeFile(join(root, "b.txt"), "gamma delta");
    const progress = createCapturedStream(false);

    await captureCli(["--path", root], { stderr: progress.stream });

    expect(progress.writes.some((chunk) => chunk.includes("Counting files ["))).toBeTrue();
    expect(progress.writes.some((chunk) => chunk.endsWith("\n"))).toBeTrue();
    expect(progress.writes.some((chunk) => /\r +\r/.test(chunk))).toBeFalse();
  });

  test("keeps final progress line visible in --debug mode", async () => {
    const root = await makeTempFixture("cli-progress-debug-visible");
    await writeFile(join(root, "a.txt"), "alpha beta");
    await writeFile(join(root, "b.txt"), "gamma delta");
    const progress = createCapturedStream(true);

    await captureCli(["--path", root, "--debug"], { stderr: progress.stream });

    expect(
      progress.writes.some((chunk) =>
        /\rCounting files \[[█░]{20}\]\s+100%\s+\d+\/\d+\s+elapsed \d{2}:\d{2}\.\d/.test(chunk),
      ),
    ).toBeTrue();
    expect(
      progress.writes.some((chunk) =>
        /\nFinalizing aggregate\.\.\. elapsed \d{2}:\d{2}\.\d/.test(chunk),
      ),
    ).toBeTrue();
    expect(progress.writes.some((chunk) => chunk.includes("Counting files ["))).toBeTrue();
    expect(progress.writes.some((chunk) => /\r +\r/.test(chunk))).toBeFalse();
    expect(progress.writes.some((chunk) => chunk === "\n")).toBeTrue();
  });
});

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
      events.every((item) => typeof item.timestamp === "string" && !Number.isNaN(Date.parse(String(item.timestamp)))),
    ).toBeTrue();
    expect(
      events.every((item) => typeof item.runId === "string" && String(item.runId).startsWith("wc-debug-")),
    ).toBeTrue();
    expect(
      events.every((item) => item.topic === "batch" || item.topic === "path"),
    ).toBeTrue();
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
      .map((line) => JSON.parse(line) as { runId?: string; timestamp?: string; schemaVersion?: number });

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

describe("extension filters", () => {
  test("keeps DEFAULT_INCLUDE_EXTENSIONS immutable", () => {
    expect(() => {
      (DEFAULT_INCLUDE_EXTENSIONS as unknown as string[]).push(".js");
    }).toThrow();
  });

  test("supports include-ext override for directory scanning", async () => {
    const root = await makeTempFixture("ext-include");
    await writeFile(join(root, "keep.js"), "js words only");
    await writeFile(join(root, "skip.md"), "md words");

    const output = await captureCli([
      "--path",
      root,
      "--include-ext",
      ".js",
      "--format",
      "raw",
      "--quiet-skips",
    ]);

    expect(output.stdout).toEqual(["3"]);
  });

  test("supports exclude-ext on top of default includes", async () => {
    const root = await makeTempFixture("ext-exclude");
    await writeFile(join(root, "a.md"), "alpha beta");
    await writeFile(join(root, "b.txt"), "gamma delta");

    const output = await captureCli([
      "--path",
      root,
      "--exclude-ext",
      ".txt",
      "--format",
      "raw",
      "--quiet-skips",
    ]);

    expect(output.stdout).toEqual(["2"]);
  });

  test("applies exclude precedence when include and exclude overlap", async () => {
    const root = await makeTempFixture("ext-conflict");
    await writeFile(join(root, "a.md"), "alpha beta");
    await writeFile(join(root, "b.txt"), "gamma delta");

    const output = await captureCli([
      "--path",
      root,
      "--include-ext",
      ".md,.txt",
      "--exclude-ext",
      ".txt",
      "--format",
      "raw",
      "--quiet-skips",
    ]);

    expect(output.stdout).toEqual(["2"]);
  });

  test("normalizes extension tokens (case, dot, spaces, duplicates)", async () => {
    const root = await makeTempFixture("ext-normalize");
    await writeFile(join(root, "a.MD"), "alpha beta");
    await writeFile(join(root, "b.TxT"), "gamma delta");

    const output = await captureCli([
      "--path",
      root,
      "--include-ext",
      " md, .TXT, .md ",
      "--exclude-ext",
      " txt ",
      "--format",
      "raw",
      "--quiet-skips",
    ]);

    expect(output.stdout).toEqual(["2"]);
  });

  test("does not apply extension filters to direct file paths", async () => {
    const root = await makeTempFixture("ext-direct-file");
    const explicitFile = join(root, "sample.log");
    await writeFile(explicitFile, "direct file");

    const output = await captureCli([
      "--path",
      explicitFile,
      "--include-ext",
      ".md",
      "--exclude-ext",
      ".md",
      "--format",
      "raw",
      "--quiet-skips",
    ]);

    expect(output.stdout).toEqual(["2"]);
  });

  test("applies filters only to directory scans in mixed-input runs", async () => {
    const root = await makeTempFixture("ext-mixed-input-scan-vs-direct");
    const explicitFile = join(root, "keep.log");
    await writeFile(explicitFile, "direct path kept");
    await writeFile(join(root, "scan.md"), "scan candidate");

    const output = await captureCli([
      "--path",
      root,
      "--path",
      explicitFile,
      "--include-ext",
      ".md",
      "--exclude-ext",
      ".md",
      "--format",
      "raw",
      "--quiet-skips",
    ]);

    expect(output.stdout).toEqual(["3"]);
  });

  test("supports empty effective include set for directory scanning", async () => {
    const root = await makeTempFixture("ext-empty");
    await writeFile(join(root, "a.md"), "alpha beta");

    const resolved = await resolveBatchFilePaths([root], {
      pathMode: "auto",
      recursive: true,
      extensionFilter: buildDirectoryExtensionFilter([".md"], [".md"]),
    });

    expect(resolved.files).toEqual([]);
    expect(resolved.skipped.some((entry) => entry.path.endsWith("a.md"))).toBeTrue();
  });
});

describe("regex filters", () => {
  test("filters directory-expanded files by root-relative regex", async () => {
    const root = await makeTempFixture("regex-dir-scan");
    await mkdir(join(root, "docs"), { recursive: true });
    await writeFile(join(root, "docs", "keep.md"), "alpha beta");
    await writeFile(join(root, "docs", "skip.txt"), "gamma delta");
    await writeFile(join(root, "misc.md"), "epsilon zeta");

    const output = await captureCli([
      "--path",
      root,
      "--regex",
      "^docs/.*\\.md$",
      "--format",
      "raw",
      "--quiet-skips",
    ]);

    expect(output.stdout).toEqual(["2"]);
  });

  test("applies one regex across multiple roots and dedupes merged matches", async () => {
    const root = await makeTempFixture("regex-multi-roots");
    const nestedRoot = join(root, "docs");
    await mkdir(nestedRoot, { recursive: true });
    await writeFile(join(nestedRoot, "child.md"), "alpha beta");

    const output = await captureCli([
      "--path",
      root,
      "--path",
      nestedRoot,
      "--regex",
      "^docs/child\\.md$|^child\\.md$",
      "--format",
      "raw",
      "--quiet-skips",
    ]);

    expect(output.stdout).toEqual(["2"]);
  });

  test("does not mark regex excluded when file already matched from another root", async () => {
    const root = await makeTempFixture("regex-overlap-order");
    const nestedRoot = join(root, "docs");
    const child = join(nestedRoot, "child.md");
    await mkdir(nestedRoot, { recursive: true });
    await writeFile(child, "alpha beta");

    const resolved = await resolveBatchFilePaths([nestedRoot, root], {
      pathMode: "auto",
      recursive: true,
      directoryRegexPattern: "^child\\.md$",
    });

    expect(resolved.files).toEqual([child]);
    expect(resolved.skipped.some((entry) => entry.path === child && entry.reason === "regex excluded")).toBeFalse();
  });

  test("does not apply regex filtering to direct file paths", async () => {
    const root = await makeTempFixture("regex-direct-file");
    const explicitFile = join(root, "sample.txt");
    await writeFile(explicitFile, "direct file");

    const output = await captureCli([
      "--path",
      explicitFile,
      "--regex",
      "^does-not-match$",
      "--format",
      "raw",
      "--quiet-skips",
    ]);

    expect(output.stdout).toEqual(["2"]);
  });

  test("treats empty regex as no restriction for directory scanning", async () => {
    const root = await makeTempFixture("regex-empty");
    await writeFile(join(root, "a.md"), "alpha beta");
    await writeFile(join(root, "b.txt"), "gamma delta");

    const output = await captureCli([
      "--path",
      root,
      "--regex",
      "",
      "--format",
      "raw",
      "--quiet-skips",
    ]);

    expect(output.stdout).toEqual(["4"]);
  });

  test("fails fast for invalid regex when directory scan is used", async () => {
    const root = await makeTempFixture("regex-invalid");
    await writeFile(join(root, "a.md"), "alpha beta");

    await expect(
      resolveBatchFilePaths([root], {
        pathMode: "auto",
        recursive: true,
        directoryRegexPattern: "[",
      }),
    ).rejects.toThrow("Invalid --regex pattern:");
  });

  test("fails fast when --regex is provided more than once", async () => {
    expect(() =>
      validateSingleRegexOptionUsage([
        "node",
        "word-counter",
        "--path",
        "/tmp/a",
        "--regex",
        "^a\\.md$",
        "--regex",
        "^b\\.md$",
      ]),
    ).toThrow("`--regex` can only be provided once.");
  });

  test("accepts regex values that start with --regex=", () => {
    expect(() =>
      validateSingleRegexOptionUsage([
        "node",
        "word-counter",
        "--path",
        "/tmp/a",
        "--regex",
        "--regex=^a\\.md$",
      ]),
    ).not.toThrow();
  });

  test("fails fast on malformed --latin-hint value format", () => {
    expect(() => parseInlineLatinHintRule("invalid")).toThrow(
      "`--latin-hint` must use `<tag>=<pattern>` format.",
    );
  });
});

describe("CLI total-of", () => {
  test("keeps TOTAL_OF_PARTS immutable", () => {
    expect(() => {
      (TOTAL_OF_PARTS as unknown as string[]).push("custom");
    }).toThrow();
  });

  test("shows override in standard output only when it differs", async () => {
    const withOverride = await captureCli(["--non-words", "--total-of", "words", "Hi 👋, world!"]);
    expect(withOverride.stdout[0]).toBe("Total count: 5");
    expect(
      withOverride.stdout.some((line) => line.includes("Total-of (override: words): 2")),
    ).toBeTrue();

    const withoutOverride = await captureCli(["--total-of", "words", "Hello world"]);
    expect(withoutOverride.stdout[0]).toBe("Total words: 2");
    expect(withoutOverride.stdout.some((line) => line.includes("Total-of (override:"))).toBeFalse();
  });

  test("uses override total in raw output when --total-of is provided", async () => {
    const output = await captureCli([
      "--format",
      "raw",
      "--non-words",
      "--total-of",
      "emoji,punction",
      "Hi 👋, world!",
    ]);
    expect(output.stdout).toEqual(["3"]);
  });

  test("auto-enables non-word collection when --total-of requires it", async () => {
    const output = await captureCli([
      "--format",
      "json",
      "--total-of",
      "punctuation",
      "Hi, world!",
    ]);
    const parsed = JSON.parse(output.stdout[0] ?? "{}");
    expect(parsed.total).toBe(2);
    expect(parsed.meta?.totalOf).toEqual(["punctuation"]);
    expect(parsed.meta?.totalOfOverride).toBe(2);
    expect(parsed.breakdown.items[0]?.nonWords).toBeUndefined();
  });

  test("keeps base standard output model unchanged without --non-words", async () => {
    const output = await captureCli(["--total-of", "words,emoji", "Hi 👋, world!"]);

    expect(output.stdout[0]).toBe("Total words: 2");
    expect(
      output.stdout.some((line) => line.includes("Total-of (override: words, emoji): 3")),
    ).toBeTrue();
    expect(output.stdout.some((line) => line.startsWith("Non-words:"))).toBeFalse();
  });

  test("keeps char breakdown consistent when --total-of auto-enables non-words", async () => {
    const output = await captureCli(["--mode", "char", "--total-of", "punctuation", "Hi, world!"]);

    expect(output.stdout[0]).toBe("Total characters: 7");
    expect(
      output.stdout.some((line) => line.includes("Total-of (override: punctuation): 2")),
    ).toBeTrue();
    expect(output.stdout.some((line) => line === "Locale und-Latn: 7 characters")).toBeTrue();
  });

  test("keeps char json breakdown normalized when --total-of auto-enables non-words", async () => {
    const output = await captureCli([
      "--mode",
      "char",
      "--format",
      "json",
      "--total-of",
      "punctuation",
      "Hi, world!",
    ]);
    const parsed = JSON.parse(output.stdout[0] ?? "{}");

    expect(parsed.total).toBe(7);
    expect(parsed.breakdown.items[0]?.chars).toBe(7);
    expect(parsed.breakdown.items[0]?.nonWords).toBeUndefined();
    expect(parsed.meta?.totalOf).toEqual(["punctuation"]);
    expect(parsed.meta?.totalOfOverride).toBe(2);
  });

  test("keeps char-collector breakdown consistent when --total-of auto-enables non-words", async () => {
    const output = await captureCli([
      "--mode",
      "char-collector",
      "--total-of",
      "punctuation",
      "Hi, world!",
    ]);

    expect(output.stdout[0]).toBe("Total characters: 7");
    expect(
      output.stdout.some((line) => line.includes("Total-of (override: punctuation): 2")),
    ).toBeTrue();
    expect(output.stdout.some((line) => line === "Locale und-Latn: 7 characters")).toBeTrue();
  });

  test("keeps char-collector json breakdown normalized when --total-of auto-enables non-words", async () => {
    const output = await captureCli([
      "--mode",
      "char-collector",
      "--format",
      "json",
      "--total-of",
      "punctuation",
      "Hi, world!",
    ]);
    const parsed = JSON.parse(output.stdout[0] ?? "{}");

    expect(parsed.total).toBe(7);
    expect(parsed.breakdown.mode).toBe("char-collector");
    expect(parsed.breakdown.items[0]?.chars).toBe(7);
    expect(parsed.breakdown.items[0]?.nonWords).toBeUndefined();
    expect(parsed.meta?.totalOf).toEqual(["punctuation"]);
    expect(parsed.meta?.totalOfOverride).toBe(2);
  });

  test("supports --total-of in batch raw mode", async () => {
    const root = await makeTempFixture("cli-total-of-batch-raw");
    await writeFile(join(root, "a.txt"), "alpha!");
    await writeFile(join(root, "b.txt"), "beta?");

    const output = await captureCli([
      "--path",
      root,
      "--format",
      "raw",
      "--total-of",
      "punctuation",
      "--quiet-skips",
    ]);

    expect(output.stdout).toEqual(["2"]);
  });

  test("adds per-file override metadata in per-file json output", async () => {
    const root = await makeTempFixture("cli-total-of-per-file-json");
    await writeFile(join(root, "a.txt"), "alpha!");
    await writeFile(join(root, "b.txt"), "beta gamma?");

    const output = await captureCli([
      "--path",
      root,
      "--per-file",
      "--format",
      "json",
      "--total-of",
      "words,punctuation",
      "--quiet-skips",
    ]);
    const parsed = JSON.parse(output.stdout[0] ?? "{}");
    expect(parsed.scope).toBe("per-file");
    expect(parsed.meta?.totalOf).toEqual(["words", "punctuation"]);
    expect(parsed.meta?.aggregateTotalOfOverride).toBe(5);

    const files = (parsed.files ?? []) as Array<{
      path: string;
      meta?: { totalOf?: string[]; totalOfOverride?: number };
    }>;
    const byName = new Map(files.map((file) => [basename(file.path), file]));

    expect(byName.get("a.txt")?.meta?.totalOf).toEqual(["words", "punctuation"]);
    expect(byName.get("a.txt")?.meta?.totalOfOverride).toBe(2);
    expect(byName.get("b.txt")?.meta?.totalOf).toEqual(["words", "punctuation"]);
    expect(byName.get("b.txt")?.meta?.totalOfOverride).toBe(3);
  });

  test("adds per-file override metadata for sectioned per-file json output", async () => {
    const root = await makeTempFixture("cli-total-of-per-file-json-sectioned");
    await writeFile(join(root, "a.md"), "---\ntitle: alpha beta\n---\ngamma delta");
    await writeFile(join(root, "b.md"), "---\ntitle: theta iota\n---\nkappa lambda");

    const output = await captureCli([
      "--path",
      root,
      "--per-file",
      "--format",
      "json",
      "--section",
      "split",
      "--total-of",
      "words",
      "--quiet-skips",
    ]);
    const parsed = JSON.parse(output.stdout[0] ?? "{}");

    expect(parsed.scope).toBe("per-file");
    expect(parsed.aggregate.section).toBe("split");
    expect(parsed.meta?.totalOf).toEqual(["words"]);
    expect(parsed.meta?.aggregateTotalOfOverride).toBe(parsed.aggregate.total);

    const files = (parsed.files ?? []) as Array<{
      result: { section?: string; total: number };
      meta?: { totalOf?: string[]; totalOfOverride?: number };
    }>;
    for (const file of files) {
      expect(file.result.section).toBe("split");
      expect(file.meta?.totalOf).toEqual(["words"]);
      expect(file.meta?.totalOfOverride).toBe(file.result.total);
    }
  });

  test("keeps per-file override metadata across all section modes", async () => {
    const root = await makeTempFixture("cli-total-of-per-file-json-all-sections");
    await writeFile(
      join(root, "a.md"),
      "---\ntitle: alpha beta\ndescription: gamma delta\n---\nepsilon zeta",
    );

    const sectionModes = ["split", "frontmatter", "content", "per-key", "split-per-key"] as const;
    for (const section of sectionModes) {
      const output = await captureCli([
        "--path",
        root,
        "--per-file",
        "--format",
        "json",
        "--section",
        section,
        "--total-of",
        "words",
        "--quiet-skips",
      ]);
      const parsed = JSON.parse(output.stdout[0] ?? "{}");
      expect(parsed.scope).toBe("per-file");
      expect(parsed.meta?.totalOf).toEqual(["words"]);
      expect(parsed.aggregate.section).toBe(section);
      expect(parsed.meta?.aggregateTotalOfOverride).toBe(parsed.aggregate.total);

      const file = (parsed.files?.[0] ?? {}) as {
        result?: { section?: string; total?: number };
        meta?: { totalOf?: string[]; totalOfOverride?: number };
      };
      expect(file.result?.section).toBe(section);
      expect(file.meta?.totalOf).toEqual(["words"]);
      expect(file.meta?.totalOfOverride).toBe(file.result?.total);
    }
  });
});

describe("CLI compatibility gates", () => {
  test("keeps single-input standard output behavior", async () => {
    const output = await captureCli(["Hello", "world"]);
    expect(output.stdout[0]).toBe("Total words: 2");
  });

  test("keeps single-input raw output contract", async () => {
    const output = await captureCli(["--format", "raw", "Hello", "world"]);
    expect(output.stdout).toEqual(["2"]);
  });

  test("keeps single-input json output contract", async () => {
    const output = await captureCli(["--format", "json", "Hello", "world"]);
    expect(output.stdout.length).toBe(1);
    const parsed = JSON.parse(output.stdout[0] ?? "{}");
    expect(parsed.total).toBe(2);
    expect(parsed.breakdown.mode).toBe("chunk");
    expect(parsed.scope).toBeUndefined();
  });

  test("keeps single --path behavior unchanged", async () => {
    const root = await makeTempFixture("cli-single-path");
    const singlePath = join(root, "single.txt");
    await writeFile(singlePath, "hello world");

    const standard = await captureCli(["--path", singlePath]);
    expect(standard.stdout[0]).toBe("Total words: 2");
    expect(standard.stdout.some((line) => line.includes("[Merged]"))).toBeFalse();

    const raw = await captureCli(["--path", singlePath, "--format", "raw"]);
    expect(raw.stdout).toEqual(["2"]);

    const json = await captureCli(["--path", singlePath, "--format", "json"]);
    const parsed = JSON.parse(json.stdout[0] ?? "{}");
    expect(parsed.total).toBe(2);
    expect(parsed.scope).toBeUndefined();
  });

  test("treats empty single --path file as valid zero-count input", async () => {
    const root = await makeTempFixture("cli-single-path-empty");
    const singlePath = join(root, "empty.txt");
    await writeFile(singlePath, "");

    const standard = await captureCli(["--path", singlePath]);
    expect(standard.stdout[0]).toBe("Total words: 0");
    expect(standard.stderr).toEqual([]);

    const raw = await captureCli(["--path", singlePath, "--format", "raw"]);
    expect(raw.stdout).toEqual(["0"]);
    expect(raw.stderr).toEqual([]);

    const json = await captureCli(["--path", singlePath, "--format", "json"]);
    const parsed = JSON.parse(json.stdout[0] ?? "{}");
    expect(parsed.total).toBe(0);
    expect(parsed.scope).toBeUndefined();
    expect(json.stderr).toEqual([]);
  });

  test("treats whitespace-only single --path file as valid zero-count input", async () => {
    const root = await makeTempFixture("cli-single-path-whitespace");
    const singlePath = join(root, "whitespace.txt");
    await writeFile(singlePath, " \n\t ");

    const standard = await captureCli(["--path", singlePath]);
    expect(standard.stdout[0]).toBe("Total words: 0");
    expect(standard.stderr).toEqual([]);

    const raw = await captureCli(["--path", singlePath, "--format", "raw"]);
    expect(raw.stdout).toEqual(["0"]);
    expect(raw.stderr).toEqual([]);
  });

  test("accepts --latin-language hint for ambiguous Latin text", async () => {
    const output = await captureCli([
      "--format",
      "json",
      "--latin-language",
      "en",
      "Hello",
      "world",
    ]);
    const parsed = JSON.parse(output.stdout[0] ?? "{}");
    expect(parsed.breakdown.items[0]?.locale).toBe("en");
  });

  test("prefers --latin-tag over --latin-language and --latin-locale", async () => {
    const output = await captureCli([
      "--format",
      "json",
      "--latin-locale",
      "en",
      "--latin-language",
      "fr",
      "--latin-tag",
      "de",
      "Hello",
      "world",
    ]);
    const parsed = JSON.parse(output.stdout[0] ?? "{}");
    expect(parsed.breakdown.items[0]?.locale).toBe("de");
  });

  test("treats empty --latin-tag as missing and falls back to --latin-language", async () => {
    const output = await captureCli([
      "--format",
      "json",
      "--latin-locale",
      "en",
      "--latin-language",
      "fr",
      "--latin-tag",
      "",
      "Hello",
      "world",
    ]);
    const parsed = JSON.parse(output.stdout[0] ?? "{}");
    expect(parsed.breakdown.items[0]?.locale).toBe("fr");
  });

  test("accepts repeated --latin-hint for custom Latin locale detection", async () => {
    const output = await captureCli([
      "--format",
      "json",
      "--latin-hint",
      "pl=[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]",
      "Zażółć",
      "gęślą",
      "jaźń",
    ]);
    const parsed = JSON.parse(output.stdout[0] ?? "{}");
    expect(parsed.breakdown.items[0]?.locale).toBe("pl");
  });

  test("merges --latin-hints-file with CLI custom hints deterministically", async () => {
    const root = await makeTempFixture("cli-latin-hints-merge");
    const rulesPath = join(root, "latin-hints.json");
    await writeFile(
      rulesPath,
      JSON.stringify([{ tag: "ro", pattern: "[șȘ]" }]),
      "utf8",
    );

    const output = await captureCli([
      "--format",
      "json",
      "--latin-hints-file",
      rulesPath,
      "--latin-hint",
      "es=[șȘ]",
      "ș",
    ]);
    const parsed = JSON.parse(output.stdout[0] ?? "{}");
    expect(parsed.breakdown.items[0]?.locale).toBe("es");
  });

  test("supports --no-default-latin-hints", async () => {
    const withDefaults = await captureCli(["--format", "json", "Über"]);
    const withDefaultsParsed = JSON.parse(withDefaults.stdout[0] ?? "{}");
    expect(withDefaultsParsed.breakdown.items[0]?.locale).toBe("de");

    const withoutDefaults = await captureCli([
      "--format",
      "json",
      "--no-default-latin-hints",
      "Über",
    ]);
    const withoutDefaultsParsed = JSON.parse(withoutDefaults.stdout[0] ?? "{}");
    expect(withoutDefaultsParsed.breakdown.items[0]?.locale).toBe("und-Latn");
  });

  test("accepts --han-tag for Han text fallback", async () => {
    const output = await captureCli(["--format", "json", "--han-tag", "zh-Hant", "漢字測試"]);
    const parsed = JSON.parse(output.stdout[0] ?? "{}");
    expect(parsed.breakdown.items[0]?.locale).toBe("zh-Hant");
  });

  test("accepts --han-tag for Simplified Chinese Han text fallback", async () => {
    const output = await captureCli(["--format", "json", "--han-tag", "zh-Hans", "汉字测试"]);
    const parsed = JSON.parse(output.stdout[0] ?? "{}");
    expect(parsed.breakdown.items[0]?.locale).toBe("zh-Hans");
  });

  test("accepts char-collector alias matrix forms", async () => {
    const aliases = [
      "charcollector",
      "char-collect",
      "collector-char",
      "characters-collector",
      "colchar",
      "charcol",
      "char-col",
      "char-colle",
    ];

    for (const alias of aliases) {
      const output = await captureCli(["--mode", alias, "--format", "json", "Hi"]);
      const parsed = JSON.parse(output.stdout[0] ?? "{}");
      expect(parsed.breakdown.mode).toBe("char-collector");
    }
  });

  test("accepts --han-language alias for Han text fallback", async () => {
    const output = await captureCli(["--format", "json", "--han-language", "zh-Hant", "漢字測試"]);
    const parsed = JSON.parse(output.stdout[0] ?? "{}");
    expect(parsed.breakdown.items[0]?.locale).toBe("zh-Hant");
  });

  test("treats empty --han-tag as missing and uses --han-language fallback", async () => {
    const output = await captureCli([
      "--format",
      "json",
      "--han-tag",
      "",
      "--han-language",
      "zh-Hant",
      "漢字測試",
    ]);
    const parsed = JSON.parse(output.stdout[0] ?? "{}");
    expect(parsed.breakdown.items[0]?.locale).toBe("zh-Hant");
  });
});
