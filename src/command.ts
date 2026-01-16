import { Command, Option } from "commander";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve as resolvePath } from "node:path";
import { showSingularOrPluralWord } from "./utils";
import wordCounter, {
  type NonWordCollection,
  type WordCounterMode,
  type WordCounterResult,
} from "./wc";
import { countSections } from "./markdown";
import type { SectionMode, SectionedResult } from "./markdown";
import pc from "picocolors";

type OutputFormat = "standard" | "raw" | "json";

const MODE_CHOICES: WordCounterMode[] = ["chunk", "segments", "collector"];
const FORMAT_CHOICES: OutputFormat[] = ["standard", "raw", "json"];
const SECTION_CHOICES: SectionMode[] = [
  "all",
  "split",
  "frontmatter",
  "content",
  "per-key",
  "split-per-key",
];

function getPackageVersion(): string {
  const packageUrl = new URL("../../package.json", import.meta.url);
  const raw = readFileSync(packageUrl, "utf8");
  const data = JSON.parse(raw) as { version?: string };
  const version = data.version ?? "0.0.0";
  return pc.bgBlack(pc.bold(pc.italic(` word-counter ${pc.cyanBright(`ver.${version}`)} `)));
}

function renderChunkBreakdown(
  items: Array<{ locale: string; words: number; nonWords?: NonWordCollection }>,
): void {
  for (const item of items) {
    console.log(`Locale ${item.locale}: ${showSingularOrPluralWord(item.words, "word")}`);
    renderNonWords(item.nonWords, false);
  }
}

function renderSegmentBreakdown(
  items: Array<{ locale: string; words: number; segments: string[]; nonWords?: NonWordCollection }>,
): void {
  for (const item of items) {
    console.log(
      `Locale ${item.locale}: ${JSON.stringify(item.segments)} (${showSingularOrPluralWord(item.words, "word")})`,
    );
    renderNonWords(item.nonWords, true);
  }
}

function renderCollectorBreakdown(items: Array<{ locale: string; words: number }>): void {
  for (const item of items) {
    console.log(`Locale ${item.locale}: ${showSingularOrPluralWord(item.words, "word")}`);
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
    renderNonWords(result.breakdown.nonWords, false);
    return;
  }

  renderChunkBreakdown(result.breakdown.items);
}

function buildSectionLabel(
  sectionName: string,
  sectionMode: SectionMode,
  source: "frontmatter" | "content",
): string {
  if (sectionMode === "frontmatter") {
    return `[Frontmatter] (total)`;
  }

  if (sectionMode === "content") {
    return `[Content] (total)`;
  }

  if (sectionMode === "split") {
    if (source === "frontmatter") {
      return `[Frontmatter] (total)`;
    }
    return `[Content] (total)`;
  }

  if (sectionMode === "per-key") {
    return `[Frontmatter] ${sectionName} (total)`;
  }

  if (sectionMode === "split-per-key") {
    if (source === "content") {
      return `[Content] (total)`;
    }
    return `[Frontmatter] ${sectionName} (total)`;
  }

  return `[Section] ${sectionName} (total)`;
}

function renderStandardSectionedResult(result: SectionedResult): void {
  console.log(`Total words: ${result.total}`);

  for (const item of result.items) {
    const label = buildSectionLabel(item.name, result.section, item.source);
    console.log(pc.cyan(pc.bold(`${label}: ${showSingularOrPluralWord(item.result.total, "word")}`)));

    if (item.result.breakdown.mode === "segments") {
      renderSegmentBreakdown(item.result.breakdown.items);
      continue;
    }

    if (item.result.breakdown.mode === "collector") {
      renderCollectorBreakdown(item.result.breakdown.items);
      renderNonWords(item.result.breakdown.nonWords, false);
      continue;
    }

    renderChunkBreakdown(item.result.breakdown.items);
  }
}

function isSectionedResult(
  result: WordCounterResult | SectionedResult,
): result is SectionedResult {
  return "section" in result;
}

function renderNonWords(nonWords: NonWordCollection | undefined, verbose: boolean): void {
  if (!nonWords || !hasNonWords(nonWords)) {
    return;
  }
  if (verbose) {
    console.log(
      pc.yellow(
        `Non-words: emoji=${JSON.stringify(nonWords.emoji)} symbols=${JSON.stringify(
          nonWords.symbols,
        )} punctuation=${JSON.stringify(nonWords.punctuation)}`,
      ),
    );
    return;
  }
  console.log(
    pc.yellow(
      `Non-words: emoji ${nonWords.counts.emoji}, symbols ${nonWords.counts.symbols}, punctuation ${nonWords.counts.punctuation}`,
    ),
  );
}

function hasNonWords(nonWords: NonWordCollection): boolean {
  return (
    nonWords.counts.emoji > 0 ||
    nonWords.counts.symbols > 0 ||
    nonWords.counts.punctuation > 0
  );
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
      new Option("-m, --mode <mode>", "breakdown mode").choices(MODE_CHOICES).default("chunk"),
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
    .option("--latin-locale <locale>", "hint the locale for Latin script text")
    .option("--non-words", "collect emoji, symbols, and punctuation")
    .option("--pretty", "pretty print JSON output", false)
    .option("-p, --path <file>", "read input from a text file")
    .argument("[text...]", "text to count")
    .showHelpAfterError();

  program.action(
    async (
      textTokens: string[],
      options: {
        mode: WordCounterMode;
        format: OutputFormat;
        pretty: boolean;
        section: SectionMode;
        latinLocale?: string;
        nonWords?: boolean;
        path?: string;
      },
    ) => {
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
        program.error(pc.red("No input provided. Pass text, pipe stdin, or use --path."));
        return;
      }

      const useSection = options.section !== "all";
      const wcOptions = {
        mode: options.mode,
        latinLocaleHint: options.latinLocale,
        nonWords: options.nonWords,
      };
      const result: WordCounterResult | SectionedResult = useSection
        ? countSections(trimmed, options.section, wcOptions)
        : wordCounter(trimmed, wcOptions);

      if (options.format === "raw") {
        console.log(result.total);
        return;
      }

      if (options.format === "json") {
        const spacing = options.pretty ? 2 : 0;
        console.log(JSON.stringify(result, null, spacing));
        return;
      }

      if (isSectionedResult(result)) {
        renderStandardSectionedResult(result);
        return;
      }

      renderStandardResult(result);
    },
  );

  await program.parseAsync(argv);
}
