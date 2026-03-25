import { describe, expect, test } from "bun:test";
import { validateStandalonePrintJobsLimitUsage } from "../src/cli/runtime/options";
import { createCliHarness } from "./support/cli-harness";

const { captureCli } = createCliHarness();

describe("CLI doctor diagnostics", () => {
  test("prints human-readable doctor output by default", async () => {
    const output = await captureCli(["doctor"]);

    expect(output.exitCode).toBe(0);
    expect(output.stdout[0]?.includes("Doctor:")).toBeTrue();
    expect(output.stdout.some((line) => line.includes("Runtime"))).toBeTrue();
    expect(output.stdout.some((line) => line.includes("Segmenter"))).toBeTrue();
    expect(output.stdout.some((line) => line.includes("Batch jobs"))).toBeTrue();
    expect(output.stdout.some((line) => line.includes("Worker route"))).toBeTrue();
  });

  test("prints compact doctor JSON with the documented payload shape", async () => {
    const output = await captureCli(["doctor", "--format", "json"]);
    const parsed = JSON.parse(output.stdout[0] ?? "{}");

    expect(output.exitCode).toBe(0);
    expect(Object.keys(parsed)).toEqual([
      "status",
      "runtime",
      "segmenter",
      "jobs",
      "workerRoute",
      "warnings",
    ]);
    expect(Object.keys(parsed.runtime ?? {})).toEqual([
      "packageVersion",
      "buildChannel",
      "requiredNodeRange",
      "nodeVersion",
      "meetsProjectRequirement",
      "platform",
      "arch",
    ]);
    expect(Object.keys(parsed.segmenter ?? {})).toEqual([
      "available",
      "wordGranularity",
      "graphemeGranularity",
      "sampleWordSegmentation",
    ]);
    expect(Object.keys(parsed.jobs ?? {})).toEqual([
      "suggestedMaxJobs",
      "cpuLimit",
      "uvThreadpool",
      "ioLimit",
    ]);
    expect(Object.keys(parsed.workerRoute ?? {})).toEqual([
      "workerThreadsAvailable",
      "workerRouteDisabledByEnv",
      "disableWorkerJobsEnv",
      "workerPoolModuleLoadable",
      "workerEntryFound",
    ]);
    expect(Array.isArray(parsed.warnings)).toBeTrue();
    expect(output.stdout[0]?.includes("\n")).toBeFalse();
  });

  test("prints pretty doctor JSON only when --pretty is used", async () => {
    const output = await captureCli(["doctor", "--format", "json", "--pretty"]);

    expect(output.exitCode).toBe(0);
    expect(output.stdout[0]?.includes('\n  "status": ')).toBeTrue();
  });

  test("prints doctor help for explicit doctor help requests", async () => {
    const output = await captureCli(["doctor", "--help"]);

    expect(output.exitCode).toBe(0);
    expect(output.stderr).toEqual([]);
    expect(output.stdout[0]).toContain("Usage: word-counter doctor [options]");
  });

  test("returns fail with exit code 2 when Intl.Segmenter is unavailable", async () => {
    const output = await captureCli(["doctor", "--format", "json"], {
      doctorRuntime: {
        intl: {},
      },
    });
    const parsed = JSON.parse(output.stdout[0] ?? "{}");

    expect(output.exitCode).toBe(2);
    expect(parsed.status).toBe("fail");
    expect(parsed.segmenter.available).toBeFalse();
    expect(parsed.warnings).toContain("Intl.Segmenter is unavailable.");
  });

  test("returns fail with exit code 2 when Intl.Segmenter constructors are unusable", async () => {
    const output = await captureCli(["doctor", "--format", "json"], {
      doctorRuntime: {
        intl: {
          Segmenter: class {
            constructor() {
              throw new Error("boom");
            }
          } as never,
        },
      },
    });
    const parsed = JSON.parse(output.stdout[0] ?? "{}");

    expect(output.exitCode).toBe(2);
    expect(parsed.status).toBe("fail");
    expect(parsed.segmenter.available).toBeTrue();
    expect(parsed.segmenter.wordGranularity).toBeFalse();
    expect(parsed.segmenter.graphemeGranularity).toBeFalse();
  });

  test("returns fail when sample segmentation yields no segments", async () => {
    const output = await captureCli(["doctor", "--format", "json"], {
      doctorRuntime: {
        intl: {
          Segmenter: class {
            constructor(_locale: string, _options: { granularity: "word" | "grapheme" }) {}

            segment(): Iterable<unknown> {
              return [];
            }
          } as never,
        },
      },
    });
    const parsed = JSON.parse(output.stdout[0] ?? "{}");

    expect(output.exitCode).toBe(2);
    expect(parsed.status).toBe("fail");
    expect(parsed.segmenter.available).toBeTrue();
    expect(parsed.segmenter.wordGranularity).toBeTrue();
    expect(parsed.segmenter.graphemeGranularity).toBeTrue();
    expect(parsed.segmenter.sampleWordSegmentation).toBeFalse();
    expect(parsed.warnings).toContain("Intl.Segmenter sample segmentation failed.");
  });

  test("returns warn with exit code 0 when runtime policy fails but capability checks pass", async () => {
    const output = await captureCli(["doctor", "--format", "json"], {
      doctorRuntime: {
        nodeVersion: "v18.19.0",
      },
    });
    const parsed = JSON.parse(output.stdout[0] ?? "{}");

    expect(output.exitCode).toBe(0);
    expect(parsed.status).toBe("warn");
    expect(parsed.runtime.meetsProjectRequirement).toBeFalse();
    expect(
      parsed.warnings.includes("Node.js v18.19.0 is outside the supported range >=20."),
    ).toBeTrue();
  });

  test("reports rc builds as rc instead of stable", async () => {
    const output = await captureCli(["doctor", "--format", "json"], {
      doctorRuntime: {
        packageVersion: "0.1.5-rc.1",
      },
    });
    const parsed = JSON.parse(output.stdout[0] ?? "{}");

    expect(output.exitCode).toBe(0);
    expect(parsed.runtime.buildChannel).toBe("rc");
  });

  test("reports worker env toggles and jobs diagnostics from the current helpers", async () => {
    const output = await captureCli(["doctor", "--format", "json"], {
      doctorRuntime: {
        env: {
          UV_THREADPOOL_SIZE: "7",
          WORD_COUNTER_DISABLE_WORKER_JOBS: "1",
        },
      },
    });
    const parsed = JSON.parse(output.stdout[0] ?? "{}");

    expect(parsed.jobs.uvThreadpool).toBe(7);
    expect(parsed.jobs.ioLimit).toBe(14);
    expect(parsed.workerRoute.workerRouteDisabledByEnv).toBeTrue();
    expect(parsed.workerRoute.disableWorkerJobsEnv).toBe("1");
  });

  test("rejects --pretty without --format json", async () => {
    const output = await captureCli(["doctor", "--pretty"]);

    expect(output.exitCode).toBe(1);
    expect(output.stdout).toEqual([]);
    expect(output.stderr.some((line) => line.includes("`--pretty` requires `--format json`."))).toBeTrue();
  });

  test("rejects unsupported output modes", async () => {
    const output = await captureCli(["doctor", "--format", "raw"]);

    expect(output.exitCode).toBe(1);
    expect(output.stdout).toEqual([]);
    expect(
      output.stderr.some((line) =>
        line.includes("`doctor` only supports default text output or `--format json`."),
      ),
    ).toBeTrue();
  });

  test("rejects inherited batch flags for explicit doctor invocations", async () => {
    const withPath = await captureCli(["doctor", "--path", "/tmp/example"]);

    expect(withPath.exitCode).toBe(1);
    expect(
      withPath.stderr.some((line) => line.includes("`--path` is not supported by `doctor`.")),
    ).toBeTrue();
  });

  test("keeps root counting flows intact after adding the doctor subcommand", async () => {
    const output = await captureCli(["Hello", "world"]);

    expect(output.stdout[0]).toBe("Total words: 2");
  });

  test("keeps leading `doctor` text on the root counting path", async () => {
    const output = await captureCli(["doctor", "appointment"]);

    expect(output.exitCode).toBe(0);
    expect(output.stderr).toEqual([]);
    expect(output.stdout[0]).toBe("Total words: 2");
  });

  test("keeps root --print-jobs-limit behavior intact after adding the doctor subcommand", async () => {
    const output = await captureCli(["--print-jobs-limit"]);
    const parsed = JSON.parse(output.stdout[0] ?? "{}");

    expect(typeof parsed.suggestedMaxJobs).toBe("number");
    expect(output.stderr).toEqual([]);
  });

  test("keeps root --print-jobs-limit standalone validation unchanged", () => {
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
