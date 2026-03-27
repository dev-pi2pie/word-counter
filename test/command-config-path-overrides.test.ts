import { describe, expect, test } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createCliHarness } from "./support/cli-harness";
import { writeTomlConfig } from "./support/config-fixtures";

const { captureCli, makeTempFixture } = createCliHarness();

describe("CLI config path overrides", () => {
  test("respects path.detectBinary = false for inspect path inputs", async () => {
    const cwd = await makeTempFixture("inspect-detect-binary-config");
    await writeTomlConfig(cwd, ["[path]", "detectBinary = false"]);
    const filePath = join(cwd, "sample.bin");
    await writeFile(filePath, Buffer.from([0x00, 0x41, 0x20, 0x42]));

    const output = await captureCli(["inspect", "-p", filePath, "--format", "json"], { cwd });

    expect(output.exitCode).toBe(0);
    const parsed = JSON.parse(output.stdout[0] ?? "{}");
    expect(parsed.input.path).toBe(filePath);
  });

  test("respects path.detectBinary = false for counting path inputs across jobs modes", async () => {
    const cwd = await makeTempFixture("count-detect-binary-config");
    await writeTomlConfig(cwd, ["[path]", "detectBinary = false"]);
    const filePath = join(cwd, "sample.bin");
    await writeFile(filePath, Buffer.from([0x00, 0x41, 0x20, 0x42]));

    const asyncOutput = await captureCli(["--path", filePath, "--format", "json"], { cwd });
    const jobsOutput = await captureCli(["--path", filePath, "--format", "json", "--jobs", "2"], {
      cwd,
    });

    expect(asyncOutput.exitCode).toBe(0);
    expect(jobsOutput.exitCode).toBe(0);
    expect(JSON.parse(asyncOutput.stdout[0] ?? "{}").total).toBe(2);
    expect(JSON.parse(jobsOutput.stdout[0] ?? "{}").total).toBe(2);
  });

  test("lets --recursive override config path.recursive = false for counting", async () => {
    const cwd = await makeTempFixture("count-recursive-config-override");
    const nested = join(cwd, "nested");
    await writeTomlConfig(cwd, ["[path]", "recursive = false"]);
    await mkdir(nested, { recursive: true });
    await writeFile(join(cwd, "root.txt"), "alpha beta");
    await writeFile(join(nested, "child.txt"), "gamma delta");

    const fromConfig = await captureCli(["--path", cwd, "--format", "raw"], { cwd });
    const fromCli = await captureCli(["--path", cwd, "--format", "raw", "--recursive"], { cwd });

    expect(fromConfig.exitCode).toBe(0);
    expect(fromCli.exitCode).toBe(0);
    expect(fromConfig.stdout).toEqual(["2"]);
    expect(fromCli.stdout).toEqual(["4"]);
  });

  test("lets inspect --recursive override config path.recursive = false", async () => {
    const cwd = await makeTempFixture("inspect-recursive-config-override");
    const nested = join(cwd, "nested");
    await writeTomlConfig(cwd, ["[path]", "recursive = false"]);
    await mkdir(nested, { recursive: true });
    await writeFile(join(cwd, "root.txt"), "alpha beta");
    await writeFile(join(nested, "child.txt"), "gamma delta");

    const fromConfig = await captureCli(["inspect", "--path", cwd, "--format", "json"], { cwd });
    const fromCli = await captureCli(
      ["inspect", "--path", cwd, "--format", "json", "--recursive"],
      { cwd },
    );

    expect(fromConfig.exitCode).toBe(0);
    expect(fromCli.exitCode).toBe(0);
    expect(JSON.parse(fromConfig.stdout[0] ?? "{}").summary.succeeded).toBe(1);
    expect(JSON.parse(fromCli.stdout[0] ?? "{}").summary.succeeded).toBe(2);
  });

  test("lets --recursive override WORD_COUNTER_RECURSIVE=0 for counting", async () => {
    const cwd = await makeTempFixture("count-recursive-env-override");
    const nested = join(cwd, "nested");
    await mkdir(nested, { recursive: true });
    await writeFile(join(cwd, "root.txt"), "alpha beta");
    await writeFile(join(nested, "child.txt"), "gamma delta");

    const fromEnv = await captureCli(["--path", cwd, "--format", "raw"], {
      cwd,
      env: {
        WORD_COUNTER_RECURSIVE: "0",
      },
    });
    const fromCli = await captureCli(["--path", cwd, "--format", "raw", "--recursive"], {
      cwd,
      env: {
        WORD_COUNTER_RECURSIVE: "0",
      },
    });

    expect(fromEnv.exitCode).toBe(0);
    expect(fromCli.exitCode).toBe(0);
    expect(fromEnv.stdout).toEqual(["2"]);
    expect(fromCli.stdout).toEqual(["4"]);
  });

  test("lets inspect --recursive override WORD_COUNTER_RECURSIVE=0", async () => {
    const cwd = await makeTempFixture("inspect-recursive-env-override");
    const nested = join(cwd, "nested");
    await mkdir(nested, { recursive: true });
    await writeFile(join(cwd, "root.txt"), "alpha beta");
    await writeFile(join(nested, "child.txt"), "gamma delta");

    const fromEnv = await captureCli(["inspect", "--path", cwd, "--format", "json"], {
      cwd,
      env: {
        WORD_COUNTER_RECURSIVE: "0",
      },
    });
    const fromCli = await captureCli(
      ["inspect", "--path", cwd, "--format", "json", "--recursive"],
      {
        cwd,
        env: {
          WORD_COUNTER_RECURSIVE: "0",
        },
      },
    );

    expect(fromEnv.exitCode).toBe(0);
    expect(fromCli.exitCode).toBe(0);
    expect(JSON.parse(fromEnv.stdout[0] ?? "{}").summary.succeeded).toBe(1);
    expect(JSON.parse(fromCli.stdout[0] ?? "{}").summary.succeeded).toBe(2);
  });
});
