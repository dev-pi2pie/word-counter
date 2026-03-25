import { describe, expect, test } from "bun:test";
import { basename, join } from "node:path";
import { writeFile } from "node:fs/promises";
import {
  WorkerRouteUnavailableError,
  countBatchInputsWithWorkerJobs,
} from "../src/cli/batch/jobs/load-count-worker";
import { resolveBatchJobsLimit } from "../src/cli/batch/jobs/limits";
import { buildBatchSummary, loadBatchInputs, resolveBatchFilePaths } from "../src/command";
import { createCliHarness } from "./support/cli-harness";
import { hasWasmDetectorRuntime } from "./support/wasm-detector-runtime";

const {
  captureBatchJsonAcrossJobs,
  captureCli,
  findDebugEvents,
  listDebugEventNames,
  makeTempFixture,
  parseDebugEvents,
} = createCliHarness();

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
    expect(
      noJobsParsed.files.every(
        (file: { debug?: { detector?: { windowsTotal?: number } } }) =>
          (file.debug?.detector?.windowsTotal ?? 0) >= 1,
      ),
    ).toBeTrue();
    expect(
      jobsFourParsed.files.every(
        (file: { debug?: { detector?: { windowsTotal?: number } } }) =>
          (file.debug?.detector?.windowsTotal ?? 0) >= 1,
      ),
    ).toBeTrue();
    expect(noJobsParsed.debug.detector.windowsTotal).toBe(
      jobsFourParsed.debug.detector.windowsTotal,
    );
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
      const detectorEvents = parseDebugEvents(output.stderr).filter(
        (item) => item.topic === "detector",
      );
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
    expect(
      executor?.executor === "worker-pool" || executor?.executor === "async-fallback",
    ).toBeTrue();
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
        output.stderr.some((line) =>
          line.includes("Worker executor unavailable; falling back to async load+count"),
        ),
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

      const message =
        outcome.error instanceof Error ? outcome.error.message : String(outcome.error);
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

    expect(
      output.stderr.some((line) => line.includes("Warning: requested --jobs=99999")),
    ).toBeTrue();
    expect(
      output.stderr.some((line) => line.includes(`Running with --jobs=${expectedCappedJobs}`)),
    ).toBeTrue();
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

    expect(
      output.stderr.some((line) => line.includes("Warning: requested --jobs=99999")),
    ).toBeFalse();
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
        output.stderr.some((line) =>
          line.includes("Worker executor unavailable; falling back to async load+count"),
        ),
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
