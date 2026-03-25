import { describe, expect, test } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { resolveBatchFilePaths } from "../src/command";
import { createCliHarness } from "./support/cli-harness";

const { makeTempFixture } = createCliHarness();

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
