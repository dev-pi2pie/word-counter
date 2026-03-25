import { describe, expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { TOTAL_OF_PARTS } from "../src/cli/total-of";
import { createCliHarness } from "./support/cli-harness";

const { captureCli, makeTempFixture } = createCliHarness();

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
