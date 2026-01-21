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
import { normalizeMode } from "./wc/mode";
import { countSections } from "./markdown";
import type { SectionMode, SectionedResult } from "./markdown";
import pc from "picocolors";

type OutputFormat = "standard" | "raw" | "json";
type CountUnit = "word" | "character";

const MODE_CHOICES: WordCounterMode[] = ["chunk", "segments", "collector", "char"];
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

type CountBreakdownItem = {
  locale: string;
  count: number;
  nonWords?: NonWordCollection;
};

function renderCountBreakdown(items: CountBreakdownItem[], unit: CountUnit): void {
  for (const item of items) {
    console.log(`Locale ${item.locale}: ${showSingularOrPluralWord(item.count, unit)}`);
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

type TotalLabels = {
  overall: string;
  section: string;
};

function getCountUnit(mode: WordCounterMode): CountUnit {
  return mode === "char" ? "character" : "word";
}

function getTotalLabels(mode: WordCounterMode, includeNonWords: boolean): TotalLabels {
  const unit = mode === "char" ? "characters" : "words";
  if (includeNonWords) {
    return { overall: "Total count", section: "total count" };
  }
  return { overall: `Total ${unit}`, section: `total ${unit}` };
}

function renderStandardResult(result: WordCounterResult, totalLabel: string): void {
  console.log(`${totalLabel}: ${result.total}`);

  if (result.breakdown.mode === "segments") {
    renderSegmentBreakdown(result.breakdown.items);
    return;
  }

  if (result.breakdown.mode === "collector") {
    renderCollectorBreakdown(result.breakdown.items);
    renderNonWords(result.breakdown.nonWords, false);
    return;
  }

  if (result.breakdown.mode === "char") {
    renderCountBreakdown(
      result.breakdown.items.map((item) => ({
        locale: item.locale,
        count: item.chars,
        nonWords: item.nonWords,
      })),
      getCountUnit(result.breakdown.mode),
    );
    return;
  }

  renderCountBreakdown(
    result.breakdown.items.map((item) => ({
      locale: item.locale,
      count: item.words,
      nonWords: item.nonWords,
    })),
    getCountUnit(result.breakdown.mode),
  );
}

function buildSectionLabel(
  sectionName: string,
  sectionMode: SectionMode,
  source: "frontmatter" | "content",
  totalLabel: string,
): string {
  if (sectionMode === "frontmatter") {
    return `[Frontmatter] (${totalLabel})`;
  }

  if (sectionMode === "content") {
    return `[Content] (${totalLabel})`;
  }

  if (sectionMode === "split") {
    if (source === "frontmatter") {
      return `[Frontmatter] (${totalLabel})`;
    }
    return `[Content] (${totalLabel})`;
  }

  if (sectionMode === "per-key") {
    return `[Frontmatter] ${sectionName} (${totalLabel})`;
  }

  if (sectionMode === "split-per-key") {
    if (source === "content") {
      return `[Content] (${totalLabel})`;
    }
    return `[Frontmatter] ${sectionName} (${totalLabel})`;
  }

  return `[Section] ${sectionName} (${totalLabel})`;
}

function renderStandardSectionedResult(result: SectionedResult, labels: TotalLabels): void {
  console.log(`${labels.overall}: ${result.total}`);

  for (const item of result.items) {
    const label = buildSectionLabel(item.name, result.section, item.source, labels.section);
    const unit = getCountUnit(item.result.breakdown.mode);
    console.log(pc.cyan(pc.bold(`${label}: ${showSingularOrPluralWord(item.result.total, unit)}`)));

    if (item.result.breakdown.mode === "segments") {
      renderSegmentBreakdown(item.result.breakdown.items);
      continue;
    }

    if (item.result.breakdown.mode === "collector") {
      renderCollectorBreakdown(item.result.breakdown.items);
      renderNonWords(item.result.breakdown.nonWords, false);
      continue;
    }

    if (item.result.breakdown.mode === "char") {
      renderCountBreakdown(
        item.result.breakdown.items.map((chunk) => ({
          locale: chunk.locale,
          count: chunk.chars,
          nonWords: chunk.nonWords,
        })),
        unit,
      );
      continue;
    }

    renderCountBreakdown(
      item.result.breakdown.items.map((chunk) => ({
        locale: chunk.locale,
        count: chunk.words,
        nonWords: chunk.nonWords,
      })),
      unit,
    );
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
  const parseMode = (value: string): WordCounterMode => {
    const normalized = normalizeMode(value);
    if (!normalized) {
      throw new Error(`Invalid mode: ${value}`);
    }
    return normalized;
  };

  program
    .name("word-counter")
    .description("Locale-aware word counting powered by Intl.Segmenter.")
    .version(getPackageVersion(), "-v, --version", "output the version number")
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

      const labels = getTotalLabels(options.mode, Boolean(options.nonWords));
      if (isSectionedResult(result)) {
        renderStandardSectionedResult(result, labels);
        return;
      }

      renderStandardResult(result, labels.overall);
    },
  );

  await program.parseAsync(argv);
}
