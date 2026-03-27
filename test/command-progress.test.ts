import { describe, expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createCliHarness } from "./support/cli-harness";

const { captureCli, createCapturedStream, makeTempFixture } = createCliHarness();

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

  test("lets --progress override config-driven progress.mode = off", async () => {
    const root = await makeTempFixture("cli-progress-config-override");
    await writeFile(
      join(root, "wc-intl-seg.config.toml"),
      ["[progress]", 'mode = "off"'].join("\n"),
    );
    await writeFile(join(root, "a.txt"), "alpha beta");
    await writeFile(join(root, "b.txt"), "gamma delta");
    const progress = createCapturedStream(true);

    const output = await captureCli(["--path", root, "--progress"], {
      cwd: root,
      stderr: progress.stream,
    });

    expect(progress.writes.some((chunk) => chunk.includes("Counting files ["))).toBeTrue();
    expect(output.stdout[0]).toBe("Total words: 4");
  });

  test("lets --progress override WORD_COUNTER_PROGRESS=off in non-tty streams", async () => {
    const root = await makeTempFixture("cli-progress-env-override");
    await writeFile(join(root, "a.txt"), "alpha beta");
    await writeFile(join(root, "b.txt"), "gamma delta");
    const progress = createCapturedStream(false);

    const output = await captureCli(["--path", root, "--progress"], {
      cwd: root,
      env: {
        WORD_COUNTER_PROGRESS: "off",
      },
      stderr: progress.stream,
    });

    expect(progress.writes.some((chunk) => chunk.includes("Counting files ["))).toBeTrue();
    expect(progress.writes.some((chunk) => chunk.endsWith("\n"))).toBeTrue();
    expect(output.stdout[0]).toBe("Total words: 4");
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
