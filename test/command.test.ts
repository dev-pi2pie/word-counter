import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import {
  buildBatchSummary,
  loadBatchInputs,
  resolveBatchFilePaths,
  runCli,
} from "../src/command";
import { buildDirectoryExtensionFilter } from "../src/cli/path/filter";
import type { ProgressOutputStream } from "../src/cli/progress/reporter";

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
};

async function captureCli(
  args: string[],
  options: CaptureCliOptions = {},
): Promise<{ stdout: string[]; stderr: string[] }> {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const originalLog = console.log;
  const originalError = console.error;

  console.log = (...chunks: unknown[]) => {
    stdout.push(chunks.map((chunk) => String(chunk)).join(" "));
  };
  console.error = (...chunks: unknown[]) => {
    stderr.push(chunks.map((chunk) => String(chunk)).join(" "));
  };

  try {
    await runCli(["node", "word-counter", ...args], options);
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }

  return { stdout, stderr };
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
      expect(summary.aggregate.breakdown.items.every((item) => item.segments.length === 0)).toBeTrue();
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
    expect(parsed.breakdown.items.some((item: { segments?: string[] }) => (item.segments?.length ?? 0) > 0)).toBeTrue();
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

    const output = await captureCli([
      "--path",
      root,
      "--per-file",
      "--format",
      "json",
    ]);
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
  });

  test("does not double count overlapping path inputs", async () => {
    const root = await makeTempFixture("cli-overlap");
    const explicitPath = join(root, "a.txt");
    await writeFile(explicitPath, "alpha beta");
    await writeFile(join(root, "b.txt"), "gamma");

    const output = await captureCli([
      "--path",
      root,
      "--path",
      explicitPath,
      "--format",
      "raw",
    ]);

    expect(output.stdout).toEqual(["3"]);
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
      progress.writes.some((chunk) => /Finalizing aggregate\.\.\. elapsed \d{2}:\d{2}\.\d/.test(chunk)),
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

    const raw = await captureCli(["--path", root, "--format", "raw"], { stderr: rawProgress.stream });
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
    const events = output.stderr
      .filter((line) => line.startsWith("[debug] "))
      .map((line) => JSON.parse(line.slice(8)) as { event?: string; stage?: string });
    const eventNames = events
      .map((item) => item.event)
      .filter((event): event is string => typeof event === "string");
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
    expect(output.stdout).toEqual(["2"]);
  });
});

describe("extension filters", () => {
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

describe("CLI total-of", () => {
  test("shows override in standard output only when it differs", async () => {
    const withOverride = await captureCli([
      "--non-words",
      "--total-of",
      "words",
      "Hi 👋, world!",
    ]);
    expect(withOverride.stdout[0]).toBe("Total count: 5");
    expect(withOverride.stdout.some((line) => line.includes("Total-of (override: words): 2"))).toBeTrue();

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
    const output = await captureCli([
      "--total-of",
      "words,emoji",
      "Hi 👋, world!",
    ]);

    expect(output.stdout[0]).toBe("Total words: 2");
    expect(output.stdout.some((line) => line.includes("Total-of (override: words, emoji): 3"))).toBeTrue();
    expect(output.stdout.some((line) => line.startsWith("Non-words:"))).toBeFalse();
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
