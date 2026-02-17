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
      new Option("--path-mode <mode>", "path resolution mode")
        .choices(PATH_MODE_CHOICES)
        .default("auto"),
    )
    .option("--latin-language <language>", "hint a language tag for Latin script text")
    .option("--latin-tag <tag>", "hint a BCP 47 tag for Latin script text")
    .option("--latin-locale <locale>", "legacy alias of --latin-language")
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
    .option("-p, --path <path>", "read input from file or directory", collectPathValue, [])
    .argument("[text...]", "text to count")
    .showHelpAfterError();
}
