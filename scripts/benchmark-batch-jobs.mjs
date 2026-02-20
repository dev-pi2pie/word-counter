#!/usr/bin/env node

import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const DEFAULT_JOBS = [1, 2, 4, 8];
const DEFAULT_RUNS = 3;
const DEFAULT_FIXTURE = "examples/test-case-huge-logs";
const DEFAULT_BIN = "dist/esm/bin.mjs";

function parseInteger(value, name) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(`Invalid ${name}: ${value}`);
  }
  return parsed;
}

function parseArgs(argv) {
  const args = {
    jobs: DEFAULT_JOBS,
    runs: DEFAULT_RUNS,
    fixture: DEFAULT_FIXTURE,
    bin: DEFAULT_BIN,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token) {
      continue;
    }

    if (token === "--jobs") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("Missing value for --jobs");
      }
      args.jobs = value
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
        .map((item) => parseInteger(item, "--jobs"));
      index += 1;
      continue;
    }

    if (token === "--runs") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("Missing value for --runs");
      }
      args.runs = parseInteger(value, "--runs");
      index += 1;
      continue;
    }

    if (token === "--fixture") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("Missing value for --fixture");
      }
      args.fixture = value;
      index += 1;
      continue;
    }

    if (token === "--bin") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("Missing value for --bin");
      }
      args.bin = value;
      index += 1;
      continue;
    }

    throw new Error(`Unknown option: ${token}`);
  }

  return args;
}

function runNode(args) {
  const startedAt = process.hrtime.bigint();
  const result = spawnSync(process.execPath, args, {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      [
        `Command failed: node ${args.join(" ")}`,
        `status=${String(result.status)}`,
        result.stderr?.trim() || "(no stderr)",
      ].join("\n"),
    );
  }

  return {
    elapsedMs,
    stdout: result.stdout?.trim() ?? "",
  };
}

function median(values) {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }
  return sorted[middle];
}

function p95(values) {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil(sorted.length * 0.95) - 1;
  const index = Math.max(0, Math.min(sorted.length - 1, rank));
  return sorted[index];
}

function formatMs(value) {
  return `${value.toFixed(2)}ms`;
}

function resolveJobsLimit(binPath) {
  const { stdout } = runNode([binPath, "--print-jobs-limit"]);
  return JSON.parse(stdout);
}

function main() {
  const parsed = parseArgs(process.argv);
  const binPath = resolve(parsed.bin);
  const fixturePath = resolve(parsed.fixture);

  if (!existsSync(binPath)) {
    throw new Error(`CLI binary not found: ${binPath}. Run \`bun run build\` first.`);
  }

  if (!existsSync(fixturePath)) {
    throw new Error(`Fixture path not found: ${fixturePath}`);
  }

  const jobsLimit = resolveJobsLimit(binPath);
  const rows = [];
  const totals = new Set();

  for (const jobs of parsed.jobs) {
    const elapsedRuns = [];
    const totalRuns = [];

    for (let run = 1; run <= parsed.runs; run += 1) {
      const result = runNode([
        binPath,
        "--path",
        fixturePath,
        "--format",
        "raw",
        "--quiet-skips",
        "--no-progress",
        "--jobs",
        String(jobs),
      ]);

      const total = Number.parseInt(result.stdout, 10);
      if (!Number.isFinite(total)) {
        throw new Error(`Unexpected raw output for --jobs=${jobs}: ${result.stdout}`);
      }

      elapsedRuns.push(result.elapsedMs);
      totalRuns.push(total);
      totals.add(total);
      console.log(`jobs=${jobs} run=${run}/${parsed.runs} -> ${formatMs(result.elapsedMs)} total=${total}`);
    }

    rows.push({
      jobs,
      medianMs: median(elapsedRuns),
      p95Ms: p95(elapsedRuns),
      totals: totalRuns,
    });
  }

  const parity = totals.size === 1;
  const output = {
    benchmark: {
      fixture: fixturePath,
      runs: parsed.runs,
      jobs: parsed.jobs,
      command: "node dist/esm/bin.mjs --path <fixture> --format raw --quiet-skips --no-progress --jobs <n>",
    },
    hostLimit: jobsLimit,
    parity,
    parityTotal: parity ? [...totals][0] : null,
    rows,
  };

  console.log("\nSummary:");
  for (const row of rows) {
    console.log(
      `jobs=${row.jobs} median=${formatMs(row.medianMs)} p95=${formatMs(row.p95Ms)} totals=${row.totals.join(",")}`,
    );
  }
  console.log(`parity=${parity}${parity ? ` total=${String(output.parityTotal)}` : ""}`);
  console.log("\nJSON:");
  console.log(JSON.stringify(output, null, 2));
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
}
