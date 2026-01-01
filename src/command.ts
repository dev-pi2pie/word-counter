import { Command, Option } from "commander";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve as resolvePath } from "node:path";
import { showSingularOrPluralWord } from "./utils";
import wordCounter, { type WordCounterMode, type WordCounterResult } from "./wc";

type OutputFormat = "standard" | "raw" | "json";

const MODE_CHOICES: WordCounterMode[] = ["chunk", "segments", "collector"];
const FORMAT_CHOICES: OutputFormat[] = ["standard", "raw", "json"];

function getPackageVersion(): string {
  const packageUrl = new URL("../../package.json", import.meta.url);
  const raw = readFileSync(packageUrl, "utf8");
  const data = JSON.parse(raw) as { version?: string };
  return data.version ?? "0.0.0";
}

function renderChunkBreakdown(items: Array<{ locale: string; words: number }>): void {
  for (const item of items) {
    console.log(
      `Locale ${item.locale}: ${showSingularOrPluralWord(item.words, "word")}`
    );
  }
}

function renderSegmentBreakdown(
  items: Array<{ locale: string; words: number; segments: string[] }>
): void {
  for (const item of items) {
    console.log(
      `Locale ${item.locale}: ${JSON.stringify(item.segments)} (${showSingularOrPluralWord(item.words, "word")})`
    );
  }
}

function renderCollectorBreakdown(items: Array<{ locale: string; words: number }>): void {
  for (const item of items) {
    console.log(
      `Locale ${item.locale}: ${showSingularOrPluralWord(item.words, "word")}`
    );
  }
}

function renderStandardResult(result: WordCounterResult): void {
  console.log(`Total words: ${result.total}`);

  if (result.breakdown.mode === "segments") {
    renderSegmentBreakdown(result.breakdown.items);
    return;
  }

  if (result.breakdown.mode === "collector") {
    renderCollectorBreakdown(result.breakdown.items);
    return;
  }

  renderChunkBreakdown(result.breakdown.items);
}

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) {
    return "";
  }

  return new Promise<string>((resolve, reject) => {
    const chunks: string[] = [];
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => chunks.push(String(chunk)));
    process.stdin.on("end", () => resolve(chunks.join("")));
    process.stdin.on("error", (error) => reject(error));
    process.stdin.resume();
  });
}

async function resolveInput(textTokens: string[], pathInput?: string): Promise<string> {
  if (pathInput) {
    const resolved = resolvePath(pathInput);
    return readFile(resolved, "utf8");
  }

  if (textTokens.length > 0) {
    return textTokens.join(" ");
  }

  return readStdin();
}

export async function runCli(argv: string[] = process.argv): Promise<void> {
  const program = new Command();

  program
    .name("word-counter")
    .description("Locale-aware word counting powered by Intl.Segmenter.")
    .version(getPackageVersion(), "-v, --version", "output the version number")
    .addOption(
      new Option("-m, --mode <mode>", "breakdown mode")
        .choices(MODE_CHOICES)
        .default("chunk")
    )
    .addOption(
      new Option("--format <format>", "output format")
        .choices(FORMAT_CHOICES)
        .default("standard")
    )
    .option("--pretty", "pretty print JSON output", false)
    .option("-p, --path <file>", "read input from a text file")
    .argument("[text...]", "text to count")
    .showHelpAfterError();

  program.action(async (textTokens: string[], options: {
    mode: WordCounterMode;
    format: OutputFormat;
    pretty: boolean;
    path?: string;
  }) => {
    let input: string;
    try {
      input = await resolveInput(textTokens, options.path);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      program.error(`Failed to read input: ${message}`);
      return;
    }

    const trimmed = input.trim();
    if (!trimmed) {
      program.error("No input provided. Pass text, pipe stdin, or use --path.");
      return;
    }

    const result = wordCounter(trimmed, { mode: options.mode });

    if (options.format === "raw") {
      console.log(result.total);
      return;
    }

    if (options.format === "json") {
      const spacing = options.pretty ? 2 : 0;
      console.log(JSON.stringify(result, null, spacing));
      return;
    }

    renderStandardResult(result);
  });

  await program.parseAsync(argv);
}
