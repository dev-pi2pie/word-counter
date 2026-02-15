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

async function captureCli(args: string[]): Promise<{ stdout: string[]; stderr: string[] }> {
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
    await runCli(["node", "word-counter", ...args]);
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }

  return { stdout, stderr };
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
});

describe("CLI batch output", () => {
  test("supports per-file output plus merged summary", async () => {
    const root = await makeTempFixture("cli-per-file");
    await writeFile(join(root, "a.txt"), "alpha words");
    await writeFile(join(root, "b.txt"), "beta words");

    const output = await captureCli(["--path", root, "--per-file", "--quiet-skips"]);

    expect(output.stdout.some((line) => line.includes("[File]"))).toBeTrue();
    expect(output.stdout.some((line) => line.includes("[Merged] 2 file(s)"))).toBeTrue();
  });

  test("supports quiet skip reporting toggle", async () => {
    const root = await makeTempFixture("cli-skips");
    const binary = join(root, "binary.dat");
    await writeFile(join(root, "note.txt"), "plain text");
    await writeFile(binary, Buffer.from([0, 1, 2, 3]));

    const withSkips = await captureCli(["--path", root, "--path", binary, "--format", "raw"]);
    expect(withSkips.stderr.some((line) => line.includes("Skipped"))).toBeTrue();

    const quiet = await captureCli([
      "--path",
      root,
      "--path",
      binary,
      "--format",
      "raw",
      "--quiet-skips",
    ]);
    expect(quiet.stderr.some((line) => line.includes("Skipped"))).toBeFalse();
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
});
