#!/usr/bin/env node

import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const TARGET_DIR = join(SCRIPT_DIR, "test-case-huge-logs");

const DEFAULT_RANDOM_WORDS_MIN = 120;
const DEFAULT_RANDOM_WORDS_MAX = 480;

const WORD_POOL = [
  "alpha",
  "beta",
  "gamma",
  "delta",
  "epsilon",
  "zeta",
  "eta",
  "theta",
  "iota",
  "kappa",
  "lambda",
  "mu",
  "nova",
  "orbit",
  "pulse",
  "spark",
  "drift",
  "vector",
  "cloud",
  "horizon",
  "matrix",
  "signal",
  "stream",
  "packet",
  "kernel",
  "buffer",
  "index",
  "cache",
  "queue",
  "cluster",
  "beacon",
  "ledger",
  "metric",
  "random",
  "sample",
  "output",
  "input",
  "worker",
  "runner",
  "monitor",
];

function usage() {
  console.log(`Usage:
  node examples/manage-huge-logs.mjs create <file-count> [words]
  node examples/manage-huge-logs.mjs clean
  node examples/manage-huge-logs.mjs reset <file-count> [words]

words:
  <number>         fixed words per file (e.g. 300)
  random           random words per file (${DEFAULT_RANDOM_WORDS_MIN}-${DEFAULT_RANDOM_WORDS_MAX})
  <min>-<max>      random words per file within a range (e.g. 200-700)

Examples:
  node examples/manage-huge-logs.mjs create 500
  bun examples/manage-huge-logs.mjs create 1200 400
  bun examples/manage-huge-logs.mjs create 900 random
  node examples/manage-huge-logs.mjs create 200 150-450
  node examples/manage-huge-logs.mjs clean
  node examples/manage-huge-logs.mjs reset 800 250-600`);
}

function isPositiveInt(value) {
  return /^[1-9][0-9]*$/.test(value);
}

function parsePositiveInt(label, value) {
  if (!isPositiveInt(value)) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
  return Number(value);
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function parseWordsSpec(rawValue) {
  if (!rawValue || rawValue === "random") {
    return {
      mode: "random",
      min: DEFAULT_RANDOM_WORDS_MIN,
      max: DEFAULT_RANDOM_WORDS_MAX,
      label: `${DEFAULT_RANDOM_WORDS_MIN}-${DEFAULT_RANDOM_WORDS_MAX} random words/file`,
    };
  }

  if (isPositiveInt(rawValue)) {
    const fixed = Number(rawValue);
    return {
      mode: "fixed",
      value: fixed,
      label: `${fixed} words/file`,
    };
  }

  const rangeMatch = rawValue.match(/^([1-9][0-9]*)-([1-9][0-9]*)$/);
  if (rangeMatch) {
    const min = Number(rangeMatch[1]);
    const max = Number(rangeMatch[2]);
    if (min > max) {
      throw new Error(`Invalid words range: ${rawValue} (min > max)`);
    }
    return {
      mode: "random",
      min,
      max,
      label: `${min}-${max} random words/file`,
    };
  }

  throw new Error(`Invalid words value: ${rawValue}`);
}

function pickWordCount(wordsSpec) {
  if (wordsSpec.mode === "fixed") {
    return wordsSpec.value;
  }
  return randomInt(wordsSpec.min, wordsSpec.max);
}

function buildContent(fileIndex, wordsPerFile) {
  const lines = [];
  lines.push(`log-file: ${String(fileIndex).padStart(5, "0")}`);
  lines.push("generated-by: manage-huge-logs.mjs");
  lines.push(`word-count: ${wordsPerFile}`);
  lines.push("");

  const words = [];
  for (let index = 0; index < wordsPerFile; index += 1) {
    words.push(WORD_POOL[randomInt(0, WORD_POOL.length - 1)]);
  }

  for (let index = 0; index < words.length; index += 16) {
    lines.push(words.slice(index, index + 16).join(" "));
  }

  lines.push("");
  return lines.join("\n");
}

async function ensureTargetDir() {
  await mkdir(TARGET_DIR, { recursive: true });
  const gitignorePath = join(TARGET_DIR, ".gitignore");
  try {
    await writeFile(gitignorePath, "*\n!.gitignore\n", { flag: "wx" });
  } catch (error) {
    const errorCode = typeof error === "object" && error ? error.code : undefined;
    if (errorCode !== "EEXIST") {
      throw error;
    }
  }
}

async function cleanLogs() {
  await ensureTargetDir();
  const entries = await readdir(TARGET_DIR, { withFileTypes: true });
  await Promise.all(
    entries
      .filter((entry) => entry.name !== ".gitignore")
      .map((entry) => rm(join(TARGET_DIR, entry.name), { recursive: true, force: true })),
  );
  console.log(`Cleaned: ${TARGET_DIR}`);
}

async function createLogs(fileCountRaw, wordsRaw) {
  const fileCount = parsePositiveInt("<file-count>", fileCountRaw);
  const wordsSpec = parseWordsSpec(wordsRaw);
  await ensureTargetDir();

  for (let index = 1; index <= fileCount; index += 1) {
    const wordsPerFile = pickWordCount(wordsSpec);
    const outputPath = join(TARGET_DIR, `log-${String(index).padStart(5, "0")}.txt`);
    await writeFile(outputPath, buildContent(index, wordsPerFile), "utf8");
  }

  console.log(`Created ${fileCount} files in ${TARGET_DIR} (${wordsSpec.label}).`);
}

async function main() {
  const [, , command, ...args] = process.argv;

  try {
    switch (command) {
      case "create": {
        if (!args[0]) {
          throw new Error("Missing <file-count> for create.");
        }
        await createLogs(args[0], args[1]);
        break;
      }
      case "clean": {
        await cleanLogs();
        break;
      }
      case "reset": {
        if (!args[0]) {
          throw new Error("Missing <file-count> for reset.");
        }
        await cleanLogs();
        await createLogs(args[0], args[1]);
        break;
      }
      case "-h":
      case "--help":
      case "help": {
        usage();
        break;
      }
      default: {
        throw new Error(`Unknown command: ${command ?? "(empty)"}`);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    console.error("");
    usage();
    process.exitCode = 1;
  }
}

await main();
