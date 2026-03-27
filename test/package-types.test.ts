import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const tempRoots: string[] = [];
const require = createRequire(import.meta.url);
const tscEntrypoint = require.resolve("typescript/bin/tsc");

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

async function makeTypecheckFixture(): Promise<string> {
  const generatedRoot = join(process.cwd(), "generated");
  await mkdir(generatedRoot, { recursive: true });
  const root = await mkdtemp(join(generatedRoot, "typecheck-"));
  tempRoots.push(root);
  return root;
}

describe("published package types", () => {
  test("root package supports default and named imports", async () => {
    const fixtureRoot = await makeTypecheckFixture();
    const entryPath = join(fixtureRoot, "root-imports.mts");

    await writeFile(
      entryPath,
      [
        "import wc, { wordCounter, countSections } from '@dev-pi2pie/word-counter';",
        "wc('Hello world');",
        "wordCounter('Hello world');",
        "countSections('Hello world', 'all');",
      ].join("\n"),
    );

    const result = spawnSync(
      process.execPath,
      [
        tscEntrypoint,
        "--noEmit",
        "--pretty",
        "false",
        "--module",
        "NodeNext",
        "--moduleResolution",
        "NodeNext",
        "--target",
        "ES2022",
        "--ignoreConfig",
        "--skipLibCheck",
        entryPath,
      ],
      {
        cwd: process.cwd(),
        encoding: "utf8",
      },
    );

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
  });

  test("detector subpath exports inspect API and types", async () => {
    const fixtureRoot = await makeTypecheckFixture();
    const entryPath = join(fixtureRoot, "detector-imports.mts");

    await writeFile(
      entryPath,
      [
        "import {",
        "  countSectionsWithDetector,",
        "  inspectTextWithDetector,",
        "  segmentTextByLocaleWithDetector,",
        "  wordCounterWithDetector,",
        "  type DetectorInspectOptions,",
        "  type DetectorInspectResult,",
        "} from '@dev-pi2pie/word-counter/detector';",
        "const options: DetectorInspectOptions = {",
        "  detector: 'regex',",
        "  view: 'pipeline',",
        "  contentGate: { mode: 'strict' },",
        "};",
        "const resultPromise: Promise<DetectorInspectResult> = inspectTextWithDetector('Hello world', options);",
        "segmentTextByLocaleWithDetector('Hello world', { detector: 'regex', contentGate: { mode: 'loose' } });",
        "wordCounterWithDetector('Hello world', { detector: 'wasm', contentGate: { mode: 'off' } });",
        "countSectionsWithDetector('Hello world', 'all', { detector: 'regex', contentGate: { mode: 'default' } });",
        "void resultPromise;",
      ].join("\n"),
    );

    const result = spawnSync(
      process.execPath,
      [
        tscEntrypoint,
        "--noEmit",
        "--pretty",
        "false",
        "--module",
        "NodeNext",
        "--moduleResolution",
        "NodeNext",
        "--target",
        "ES2022",
        "--ignoreConfig",
        "--skipLibCheck",
        entryPath,
      ],
      {
        cwd: process.cwd(),
        encoding: "utf8",
      },
    );

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
  });
});
