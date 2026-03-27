import { describe, expect, test } from "bun:test";
import { createCliHarness } from "./support/cli-harness";
import { writeJsonConfig, writeTomlConfig } from "./support/config-fixtures";

const { captureCli, makeTempFixture } = createCliHarness();

describe("CLI config discovery warnings", () => {
  test("surfaces a warning when lower-priority sibling config files are ignored", async () => {
    const cwd = await makeTempFixture("config-sibling-warning");
    await writeTomlConfig(cwd, ["[output]", 'totalOf = ["emoji"]']);
    await writeJsonConfig(cwd, {
      output: {
        totalOf: ["words"],
      },
    });

    const output = await captureCli(["--format", "raw", "Hello there 👋!"], { cwd });

    expect(output.exitCode).toBe(0);
    expect(output.stdout).toEqual(["1"]);
    expect(
      output.stderr.some((line) => line.includes("Ignoring lower-priority sibling config files")),
    ).toBeTrue();
  });

  test("lets --quiet-warnings suppress non-fatal config discovery notes", async () => {
    const cwd = await makeTempFixture("config-quiet-warnings");
    await writeTomlConfig(cwd, ["[output]", 'totalOf = ["emoji"]']);
    await writeJsonConfig(cwd, {
      output: {
        totalOf: ["words"],
      },
    });

    const noisy = await captureCli(["--format", "raw", "Hello there 👋!"], { cwd });
    const quiet = await captureCli(["--quiet-warnings", "--format", "raw", "Hello there 👋!"], {
      cwd,
    });

    expect(noisy.exitCode).toBe(0);
    expect(quiet.exitCode).toBe(0);
    expect(noisy.stdout).toEqual(["1"]);
    expect(quiet.stdout).toEqual(["1"]);
    expect(
      noisy.stderr.some((line) => line.includes("Ignoring lower-priority sibling config files")),
    ).toBeTrue();
    expect(
      quiet.stderr.some((line) => line.includes("Ignoring lower-priority sibling config files")),
    ).toBeFalse();
  });
});
