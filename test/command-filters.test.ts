import { describe, expect, test } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { DEFAULT_INCLUDE_EXTENSIONS, buildDirectoryExtensionFilter } from "../src/cli/path/filter";
import {
  parseInlineLatinHintRule,
  validateSingleRegexOptionUsage,
} from "../src/cli/runtime/options";
import { resolveBatchFilePaths } from "../src/command";
import { createCliHarness } from "./support/cli-harness";

const { captureCli, makeTempFixture } = createCliHarness();

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
