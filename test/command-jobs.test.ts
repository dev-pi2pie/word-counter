import { describe, expect, test } from "bun:test";
import { validateStandalonePrintJobsLimitUsage } from "../src/cli/runtime/options";
import { createCliHarness } from "./support/cli-harness";

const { captureCli } = createCliHarness();

describe("CLI jobs diagnostics", () => {
  test("prints jobs limit summary as JSON", async () => {
    const output = await captureCli(["--print-jobs-limit"]);
    const parsed = JSON.parse(output.stdout[0] ?? "{}");

    expect(typeof parsed.suggestedMaxJobs).toBe("number");
    expect(typeof parsed.cpuLimit).toBe("number");
    expect(typeof parsed.uvThreadpool).toBe("number");
    expect(typeof parsed.ioLimit).toBe("number");
    expect(parsed.suggestedMaxJobs >= 1).toBeTrue();
  });

  test("enforces standalone usage for --print-jobs-limit", () => {
    expect(() =>
      validateStandalonePrintJobsLimitUsage([
        "node",
        "word-counter",
        "--print-jobs-limit",
        "--format",
        "json",
      ]),
    ).toThrow("`--print-jobs-limit` must be used alone.");
  });
});
