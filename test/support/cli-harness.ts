import { afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "../../src/command";
import type { DoctorRuntimeOverrides } from "../../src/cli/doctor/types";
import type { ProgressOutputStream } from "../../src/cli/progress/reporter";

type CaptureCliOptions = {
  stderr?: ProgressOutputStream;
  doctorRuntime?: DoctorRuntimeOverrides;
  env?: NodeJS.ProcessEnv;
  cwd?: string;
};

type CaptureCliResult = {
  stdout: string[];
  stderr: string[];
  exitCode: number | undefined;
};

export function createCliHarness() {
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

  async function captureCli(
    args: string[],
    options: CaptureCliOptions = {},
  ): Promise<CaptureCliResult> {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const originalLog = console.log;
    const originalError = console.error;
    const originalStderrWrite = process.stderr.write.bind(process.stderr);
    const originalExitCode = process.exitCode;
    let exitCode: number | undefined;

    console.log = (...chunks: unknown[]) => {
      stdout.push(chunks.map((chunk) => String(chunk)).join(" "));
    };
    console.error = (...chunks: unknown[]) => {
      stderr.push(chunks.map((chunk) => String(chunk)).join(" "));
    };
    process.stderr.write = ((chunk: string | Uint8Array): boolean => {
      stderr.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));
      return true;
    }) as typeof process.stderr.write;
    process.exitCode = undefined;

    try {
      await runCli(["node", "word-counter", ...args], {
        stderr: options.stderr,
        doctor: options.doctorRuntime,
        env: options.env,
        cwd: options.cwd,
      });
    } finally {
      exitCode = process.exitCode;
      console.log = originalLog;
      console.error = originalError;
      process.stderr.write = originalStderrWrite as typeof process.stderr.write;
      process.exitCode = originalExitCode;
    }

    return { stdout, stderr, exitCode };
  }

  async function captureBatchJsonAcrossJobs(args: string[]): Promise<{
    noJobs: unknown;
    jobsOne: unknown;
    jobsFour: unknown;
  }> {
    const noJobs = await captureCli(args);
    const jobsOne = await captureCli([...args, "--jobs", "1"]);
    const jobsFour = await captureCli([...args, "--jobs", "4"]);

    return {
      noJobs: JSON.parse(noJobs.stdout[0] ?? "{}"),
      jobsOne: JSON.parse(jobsOne.stdout[0] ?? "{}"),
      jobsFour: JSON.parse(jobsFour.stdout[0] ?? "{}"),
    };
  }

  function createCapturedStream(isTTY: boolean): {
    stream: ProgressOutputStream;
    writes: string[];
  } {
    const writes: string[] = [];
    return {
      writes,
      stream: {
        isTTY,
        write(chunk) {
          writes.push(chunk);
          return true;
        },
      },
    };
  }

  function parseDebugEvents(stderr: string[]): Array<Record<string, unknown>> {
    return stderr
      .filter((line) => line.startsWith("[debug] "))
      .map((line) => JSON.parse(line.slice(8)) as Record<string, unknown>);
  }

  function listDebugEventNames(stderr: string[]): string[] {
    return parseDebugEvents(stderr)
      .map((item) => item.event)
      .filter((event): event is string => typeof event === "string");
  }

  function findDebugEvents(stderr: string[], eventName: string): Array<Record<string, unknown>> {
    return parseDebugEvents(stderr).filter((item) => item.event === eventName);
  }

  return {
    captureBatchJsonAcrossJobs,
    captureCli,
    createCapturedStream,
    findDebugEvents,
    listDebugEventNames,
    makeTempFixture,
    parseDebugEvents,
  };
}
