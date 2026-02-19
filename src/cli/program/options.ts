import { Command, Option } from "commander";
import type { SectionMode } from "../../markdown";
import { collectExtensionOption } from "../path/filter";
import { parseTotalOfOption } from "../total-of";
import type { PathMode } from "../types";
import type { OutputFormat } from "../runtime/types";
import type { WordCounterMode } from "../../wc";

const MODE_CHOICES: WordCounterMode[] = ["chunk", "segments", "collector", "char", "char-collector"];
const FORMAT_CHOICES: OutputFormat[] = ["standard", "raw", "json"];
const SECTION_CHOICES: SectionMode[] = [
  "all",
  "split",
  "frontmatter",
  "content",
  "per-key",
  "split-per-key",
];
const PATH_MODE_CHOICES: PathMode[] = ["auto", "manual"];

function collectPathValue(value: string, previous: string[] = []): string[] {
  return [...previous, value];
}

function collectLatinHintValue(value: string, previous: string[] = []): string[] {
  return [...previous, value];
}

function parseJobsOption(value: string): number {
  if (!/^\d+$/.test(value)) {
    throw new Error("`--jobs` must be an integer >= 1.");
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error("`--jobs` must be an integer >= 1.");
  }

  return parsed;
}

export function configureProgramOptions(
  program: Command,
  parseMode: (value: string) => WordCounterMode,
): void {
  program
    .addOption(
      new Option("-m, --mode <mode>", "breakdown mode")
        .choices(MODE_CHOICES)
        .argParser(parseMode)
        .default("chunk"),
    )
    .addOption(
      new Option("-f, --format <format>", "output format")
        .choices(FORMAT_CHOICES)
        .default("standard"),
    )
    .addOption(
      new Option("--section <section>", "document section mode")
        .choices(SECTION_CHOICES)
        .default("all"),
    )
    .addOption(
      new Option(
        "--path-mode <mode>",
        "path resolution mode: auto (default) expands directories; manual treats --path values as literal files",
      )
        .choices(PATH_MODE_CHOICES)
        .default("auto"),
    )
    .option("--latin-language <language>", "hint a language tag for Latin script text")
    .option("--latin-tag <tag>", "hint a BCP 47 tag for Latin script text")
    .option("--latin-locale <locale>", "legacy alias of --latin-language")
    .option(
      "--latin-hint <tag>=<pattern>",
      "add a custom Latin hint rule (repeatable)",
      collectLatinHintValue,
      [],
    )
    .option("--latin-hints-file <path>", "load custom Latin hint rules from a JSON file")
    .option("--no-default-latin-hints", "disable built-in Latin hint rules")
    .option("--han-language <language>", "hint a language tag for Han script text")
    .option("--han-tag <tag>", "hint a BCP 47 tag for Han script text")
    .option("--non-words", "collect emoji, symbols, and punctuation (excludes whitespace)")
    .option(
      "--include-whitespace",
      "include whitespace counts (implies with --non-words; same as --misc)",
    )
    .option("--misc", "collect non-words plus whitespace (alias for --include-whitespace)")
    .option(
      "--total-of <parts>",
      "override total composition (comma-separated): words,emoji,symbols,punctuation,whitespace",
      parseTotalOfOption,
    )
    .option("--pretty", "pretty print JSON output", false)
    .option("--debug", "enable debug diagnostics on stderr")
    .option("--verbose", "emit verbose per-file debug diagnostics (requires --debug)")
    .option("--debug-report [path]", "write debug diagnostics to a report file")
    .option("--debug-report-tee", "mirror debug diagnostics to both report file and stderr")
    .option("--debug-tee", "alias of --debug-report-tee")
    .option("--merged", "show merged aggregate output (default)")
    .option("--per-file", "show per-file output plus merged summary")
    .option("--jobs <n>", "concurrent file jobs in batch mode (default: 1)", parseJobsOption, 1)
    .option(
      "--experimental-load-count",
      "experimental: run load+count together in concurrent workers",
    )
    .option("--print-jobs-limit", "print suggested max --jobs for current host and exit")
    .option("--no-progress", "disable batch progress indicator")
    .option("--keep-progress", "keep final batch progress line visible in standard mode")
    .option("--no-recursive", "disable recursive directory traversal")
    .option("--quiet-skips", "hide skip diagnostics (applies when --debug is enabled)")
    .option(
      "--include-ext <exts>",
      "comma-separated extensions to include during directory scanning",
      collectExtensionOption,
      [],
    )
    .option(
      "--exclude-ext <exts>",
      "comma-separated extensions to exclude during directory scanning",
      collectExtensionOption,
      [],
    )
    .option(
      "--regex <pattern>",
      "regex filter for directory-scanned paths (applies to --path directories only)",
    )
    .option(
      "-p, --path <path>",
      "read input from file or directory (directories expand in auto mode by default)",
      collectPathValue,
      [],
    )
    .argument("[text...]", "text to count")
    .showHelpAfterError();
}
