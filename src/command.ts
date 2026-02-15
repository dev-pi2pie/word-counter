import { Command, Option } from "commander";
import { type Dirent, readFileSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import { extname, relative as relativePath, resolve as resolvePath } from "node:path";
import { countSections } from "./markdown";
import type { SectionMode, SectionedResult } from "./markdown";
import { showSingularOrPluralWord } from "./utils";
import wordCounter, {
  type NonWordCollection,
  type WordCounterMode,
  type WordCounterResult,
} from "./wc";
import { normalizeMode } from "./wc/mode";
import { createNonWordCollection, mergeNonWordCollections } from "./wc/non-words";
import pc from "picocolors";

type OutputFormat = "standard" | "raw" | "json";
type CountUnit = "word" | "character";

type BatchScope = "merged" | "per-file";
type PathMode = "auto" | "manual";

type BatchSkip = {
  path: string;
  reason: string;
};

type BatchFileInput = {
  path: string;
  content: string;
};

type BatchFileResult = {
  path: string;
  result: WordCounterResult | SectionedResult;
};

type BatchOptions = {
  scope: BatchScope;
  pathMode: PathMode;
  recursive: boolean;
  quietSkips: boolean;
};

type BatchSummary = {
  files: BatchFileResult[];
  skipped: BatchSkip[];
  aggregate: WordCounterResult | SectionedResult;
};

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
const PATH_MODE_CHOICES: PathMode[] = ["auto", "manual"];
const DEFAULT_INCLUDE_EXTENSIONS = new Set([".md", ".markdown", ".mdx", ".mdc", ".txt"]);

function getPackageVersion(): string {
  const packageCandidates = [
    new URL("../package.json", import.meta.url),
    new URL("../../package.json", import.meta.url),
  ];

  let version = "0.0.0";
  for (const packageUrl of packageCandidates) {
    try {
      const raw = readFileSync(packageUrl, "utf8");
      const data = JSON.parse(raw) as { version?: string };
      if (data.version) {
        version = data.version;
        break;
      }
    } catch {
      continue;
    }
  }

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
    const whitespace = nonWords.whitespace ? ` whitespace=${JSON.stringify(nonWords.whitespace)}` : "";
    console.log(
      pc.yellow(
        `Non-words: emoji=${JSON.stringify(nonWords.emoji)} symbols=${JSON.stringify(
          nonWords.symbols,
        )} punctuation=${JSON.stringify(nonWords.punctuation)}${whitespace}`,
      ),
    );
    return;
  }
  const whitespaceCount = nonWords.counts.whitespace ?? 0;
  const whitespaceLabel = whitespaceCount > 0 ? `, whitespace ${whitespaceCount}` : "";
  console.log(
    pc.yellow(
      `Non-words: emoji ${nonWords.counts.emoji}, symbols ${nonWords.counts.symbols}, punctuation ${nonWords.counts.punctuation}${whitespaceLabel}`,
    ),
  );
}

function hasNonWords(nonWords: NonWordCollection): boolean {
  const whitespaceCount = nonWords.counts.whitespace ?? 0;
  return (
    nonWords.counts.emoji > 0 ||
    nonWords.counts.symbols > 0 ||
    nonWords.counts.punctuation > 0 ||
    whitespaceCount > 0
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

async function resolveInput(textTokens: string[]): Promise<string> {
  if (textTokens.length > 0) {
    return textTokens.join(" ");
  }

  return readStdin();
}

function collectPathValue(value: string, previous: string[] = []): string[] {
  return [...previous, value];
}

function resolveBatchScope(argv: string[]): BatchScope {
  let scope: BatchScope = "merged";
  for (const token of argv) {
    if (token === "--merged") {
      scope = "merged";
      continue;
    }
    if (token === "--per-file") {
      scope = "per-file";
    }
  }
  return scope;
}

function toDisplayPath(inputPath: string): string {
  const relative = relativePath(process.cwd(), inputPath);
  if (relative && !relative.startsWith("..")) {
    return relative || ".";
  }
  return inputPath;
}

function shouldIncludeFromDirectory(filePath: string): boolean {
  const ext = extname(filePath).toLowerCase();
  return DEFAULT_INCLUDE_EXTENSIONS.has(ext);
}

function isProbablyBinary(buffer: Buffer): boolean {
  if (buffer.length === 0) {
    return false;
  }

  const sampleSize = Math.min(buffer.length, 1024);
  let suspicious = 0;

  for (let index = 0; index < sampleSize; index += 1) {
    const byte = buffer[index] ?? 0;
    if (byte === 0) {
      return true;
    }
    if (byte === 9 || byte === 10 || byte === 13) {
      continue;
    }
    if (byte >= 32 && byte <= 126) {
      continue;
    }
    if (byte >= 128) {
      continue;
    }
    suspicious += 1;
  }

  return suspicious / sampleSize > 0.3;
}

async function expandDirectory(
  directoryPath: string,
  recursive: boolean,
  skipped: BatchSkip[],
): Promise<string[]> {
  let entries: Dirent[];
  try {
    entries = await readdir(directoryPath, { withFileTypes: true, encoding: "utf8" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    skipped.push({ path: directoryPath, reason: `directory read failed: ${message}` });
    return [];
  }

  const sortedEntries = entries.slice().sort((left, right) => left.name.localeCompare(right.name));
  const files: string[] = [];

  for (const entry of sortedEntries) {
    const entryPath = resolvePath(directoryPath, entry.name);
    if (entry.isFile()) {
      if (!shouldIncludeFromDirectory(entryPath)) {
        skipped.push({ path: entryPath, reason: "extension excluded" });
        continue;
      }
      files.push(entryPath);
      continue;
    }

    if (!entry.isDirectory()) {
      continue;
    }

    if (!recursive) {
      continue;
    }

    const nested = await expandDirectory(entryPath, recursive, skipped);
    files.push(...nested);
  }

  return files;
}

export async function resolveBatchFilePaths(
  pathInputs: string[],
  options: Pick<BatchOptions, "pathMode" | "recursive">,
): Promise<{ files: string[]; skipped: BatchSkip[] }> {
  const skipped: BatchSkip[] = [];
  const resolvedFiles: string[] = [];

  for (const rawPath of pathInputs) {
    const target = resolvePath(rawPath);
    let metadata: Awaited<ReturnType<typeof stat>>;

    try {
      metadata = await stat(target);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      skipped.push({ path: target, reason: `not readable: ${message}` });
      continue;
    }

    if (metadata.isDirectory() && options.pathMode === "auto") {
      const files = await expandDirectory(target, options.recursive, skipped);
      resolvedFiles.push(...files);
      continue;
    }

    if (!metadata.isFile()) {
      skipped.push({ path: target, reason: "not a regular file" });
      continue;
    }

    resolvedFiles.push(target);
  }

  resolvedFiles.sort((left, right) => left.localeCompare(right));

  return { files: resolvedFiles, skipped };
}

export async function loadBatchInputs(
  filePaths: string[],
): Promise<{ files: BatchFileInput[]; skipped: BatchSkip[] }> {
  const files: BatchFileInput[] = [];
  const skipped: BatchSkip[] = [];

  for (const filePath of filePaths) {
    let buffer: Buffer;
    try {
      buffer = await readFile(filePath);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      skipped.push({ path: filePath, reason: `not readable: ${message}` });
      continue;
    }

    if (isProbablyBinary(buffer)) {
      skipped.push({ path: filePath, reason: "binary file" });
      continue;
    }

    files.push({ path: filePath, content: buffer.toString("utf8") });
  }

  return { files, skipped };
}

function mergeWordCounterResult(
  left: WordCounterResult,
  right: WordCounterResult,
): WordCounterResult {
  if (left.breakdown.mode !== right.breakdown.mode) {
    throw new Error("Cannot merge different breakdown modes.");
  }

  const total = left.total + right.total;
  const counts =
    left.counts || right.counts
      ? {
          words: (left.counts?.words ?? 0) + (right.counts?.words ?? 0),
          nonWords: (left.counts?.nonWords ?? 0) + (right.counts?.nonWords ?? 0),
          total: (left.counts?.total ?? 0) + (right.counts?.total ?? 0),
        }
      : undefined;

  if (left.breakdown.mode === "chunk" && right.breakdown.mode === "chunk") {
    return {
      total,
      counts,
      breakdown: {
        mode: "chunk",
        items: [...left.breakdown.items, ...right.breakdown.items],
      },
    };
  }

  if (left.breakdown.mode === "segments" && right.breakdown.mode === "segments") {
    return {
      total,
      counts,
      breakdown: {
        mode: "segments",
        items: [...left.breakdown.items, ...right.breakdown.items],
      },
    };
  }

  if (left.breakdown.mode === "char" && right.breakdown.mode === "char") {
    return {
      total,
      counts,
      breakdown: {
        mode: "char",
        items: [...left.breakdown.items, ...right.breakdown.items],
      },
    };
  }

  if (left.breakdown.mode === "collector" && right.breakdown.mode === "collector") {
    const localeOrder: string[] = [];
    const mergedByLocale = new Map<
      string,
      {
        locale: string;
        words: number;
        segments: string[];
      }
    >();

    const addItems = (items: typeof left.breakdown.items): void => {
      for (const item of items) {
        const existing = mergedByLocale.get(item.locale);
        if (existing) {
          existing.words += item.words;
          existing.segments.push(...item.segments);
          continue;
        }
        localeOrder.push(item.locale);
        mergedByLocale.set(item.locale, {
          locale: item.locale,
          words: item.words,
          segments: [...item.segments],
        });
      }
    };

    addItems(left.breakdown.items);
    addItems(right.breakdown.items);

    let mergedNonWords: NonWordCollection | undefined;
    if (left.breakdown.nonWords || right.breakdown.nonWords) {
      mergedNonWords = createNonWordCollection();
      if (left.breakdown.nonWords) {
        mergeNonWordCollections(mergedNonWords, left.breakdown.nonWords);
      }
      if (right.breakdown.nonWords) {
        mergeNonWordCollections(mergedNonWords, right.breakdown.nonWords);
      }
    }

    return {
      total,
      counts,
      breakdown: {
        mode: "collector",
        items: localeOrder.map((locale) => {
          const value = mergedByLocale.get(locale);
          if (!value) {
            throw new Error(`Missing collector entry for locale: ${locale}`);
          }
          return value;
        }),
        nonWords: mergedNonWords,
      },
    };
  }

  return {
    total,
    counts,
    breakdown: left.breakdown,
  };
}

function aggregateWordCounterResults(results: WordCounterResult[]): WordCounterResult {
  if (results.length === 0) {
    return wordCounter("", { mode: "chunk" });
  }

  const first = results[0];
  if (!first) {
    return wordCounter("", { mode: "chunk" });
  }

  let aggregate = first;
  for (let index = 1; index < results.length; index += 1) {
    const current = results[index];
    if (!current) {
      continue;
    }
    aggregate = mergeWordCounterResult(aggregate, current);
  }
  return aggregate;
}

function buildSectionKey(name: string, source: "frontmatter" | "content"): string {
  return `${source}:${name}`;
}

function aggregateSectionedResults(results: SectionedResult[]): SectionedResult {
  if (results.length === 0) {
    return {
      section: "all",
      total: 0,
      frontmatterType: null,
      items: [],
    };
  }

  const section = results[0]?.section ?? "all";
  const grouped = new Map<string, { name: string; source: "frontmatter" | "content"; items: WordCounterResult[] }>();
  let total = 0;
  let frontmatterType = results[0]?.frontmatterType ?? null;

  for (const result of results) {
    total += result.total;

    if (result.section !== section) {
      throw new Error("Cannot aggregate section results with different section modes.");
    }

    if (frontmatterType !== result.frontmatterType) {
      frontmatterType = null;
    }

    for (const item of result.items) {
      const key = buildSectionKey(item.name, item.source);
      const existing = grouped.get(key);
      if (!existing) {
        grouped.set(key, {
          name: item.name,
          source: item.source,
          items: [item.result],
        });
        continue;
      }
      existing.items.push(item.result);
    }
  }

  const sourceOrder = new Map<"frontmatter" | "content", number>([
    ["frontmatter", 0],
    ["content", 1],
  ]);

  const items = [...grouped.values()]
    .sort((left, right) => {
      const sourceDiff = (sourceOrder.get(left.source) ?? 0) - (sourceOrder.get(right.source) ?? 0);
      if (sourceDiff !== 0) {
        return sourceDiff;
      }
      return left.name.localeCompare(right.name);
    })
    .map((entry) => ({
      name: entry.name,
      source: entry.source,
      result: aggregateWordCounterResults(entry.items),
    }));

  return {
    section,
    total,
    frontmatterType,
    items,
  };
}

function reportSkipped(skipped: BatchSkip[]): void {
  if (skipped.length === 0) {
    return;
  }

  console.error(pc.yellow(`Skipped ${skipped.length} path(s):`));
  for (const item of skipped) {
    console.error(pc.yellow(`- ${toDisplayPath(item.path)} (${item.reason})`));
  }
}

function renderPerFileStandard(
  summary: BatchSummary,
  labels: TotalLabels,
): void {
  for (const file of summary.files) {
    console.log(pc.bold(`[File] ${toDisplayPath(file.path)}`));
    if (isSectionedResult(file.result)) {
      renderStandardSectionedResult(file.result, labels);
      continue;
    }
    renderStandardResult(file.result, labels.overall);
  }

  console.log(pc.bold(`[Merged] ${summary.files.length} file(s)`));
  if (isSectionedResult(summary.aggregate)) {
    renderStandardSectionedResult(summary.aggregate, labels);
    return;
  }
  renderStandardResult(summary.aggregate, labels.overall);
}

export async function buildBatchSummary(
  inputs: BatchFileInput[],
  section: SectionMode,
  wcOptions: Parameters<typeof wordCounter>[1],
): Promise<BatchSummary> {
  const files: BatchFileResult[] = inputs.map((input) => {
    const result =
      section === "all"
        ? wordCounter(input.content, wcOptions)
        : countSections(input.content, section, wcOptions);
    return { path: input.path, result };
  });

  if (files.length === 0) {
    return {
      files,
      skipped: [],
      aggregate:
        section === "all"
          ? wordCounter("", wcOptions)
          : {
              section,
              total: 0,
              frontmatterType: null,
              items: [],
            },
    };
  }

  const aggregate =
    section === "all"
      ? aggregateWordCounterResults(files.map((file) => file.result as WordCounterResult))
      : aggregateSectionedResults(files.map((file) => file.result as SectionedResult));

  return {
    files,
    skipped: [],
    aggregate,
  };
}

function hasPathInput(pathValues: string[] | undefined): pathValues is string[] {
  return Array.isArray(pathValues) && pathValues.length > 0;
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
    .addOption(
      new Option("--path-mode <mode>", "path resolution mode")
        .choices(PATH_MODE_CHOICES)
        .default("auto"),
    )
    .option("--latin-locale <locale>", "hint the locale for Latin script text")
    .option("--non-words", "collect emoji, symbols, and punctuation (excludes whitespace)")
    .option(
      "--include-whitespace",
      "include whitespace counts (implies with --non-words; same as --misc)",
    )
    .option("--misc", "collect non-words plus whitespace (alias for --include-whitespace)")
    .option("--pretty", "pretty print JSON output", false)
    .option("--merged", "show merged aggregate output (default)")
    .option("--per-file", "show per-file output plus merged summary")
    .option("--no-recursive", "disable recursive directory traversal")
    .option("--quiet-skips", "hide unreadable/skipped path reporting")
    .option("-p, --path <path>", "read input from file or directory", collectPathValue, [])
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
        includeWhitespace?: boolean;
        misc?: boolean;
        path?: string[];
        pathMode: PathMode;
        recursive: boolean;
        quietSkips?: boolean;
      },
    ) => {
      const useSection = options.section !== "all";
      const enableNonWords = Boolean(options.nonWords || options.includeWhitespace || options.misc);
      const enableWhitespace = Boolean(options.includeWhitespace || options.misc);
      const wcOptions = {
        mode: options.mode,
        latinLocaleHint: options.latinLocale,
        nonWords: enableNonWords,
        includeWhitespace: enableWhitespace,
      };

      if (!hasPathInput(options.path)) {
        let input: string;
        try {
          input = await resolveInput(textTokens);
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

        const labels = getTotalLabels(options.mode, enableNonWords);
        if (isSectionedResult(result)) {
          renderStandardSectionedResult(result, labels);
          return;
        }

        renderStandardResult(result, labels.overall);
        return;
      }

      const batchOptions: BatchOptions = {
        scope: resolveBatchScope(argv),
        pathMode: options.pathMode,
        recursive: options.recursive,
        quietSkips: Boolean(options.quietSkips),
      };

      const resolved = await resolveBatchFilePaths(options.path, {
        pathMode: batchOptions.pathMode,
        recursive: batchOptions.recursive,
      });
      const loaded = await loadBatchInputs(resolved.files);
      const summary = await buildBatchSummary(loaded.files, options.section, wcOptions);
      summary.skipped.push(...resolved.skipped, ...loaded.skipped);

      if (!batchOptions.quietSkips) {
        reportSkipped(summary.skipped);
      }

      if (summary.files.length === 0) {
        program.error(pc.red("No readable text-like inputs were found from --path."));
        return;
      }

      if (options.format === "raw") {
        console.log(summary.aggregate.total);
        return;
      }

      if (options.format === "json") {
        const spacing = options.pretty ? 2 : 0;

        if (batchOptions.scope === "per-file") {
          const payload = {
            scope: "per-file",
            files: summary.files.map((file) => ({
              path: file.path,
              result: file.result,
            })),
            skipped: summary.skipped,
            aggregate: summary.aggregate,
          };
          console.log(JSON.stringify(payload, null, spacing));
          return;
        }

        console.log(JSON.stringify(summary.aggregate, null, spacing));
        return;
      }

      const labels = getTotalLabels(options.mode, enableNonWords);

      if (batchOptions.scope === "per-file") {
        renderPerFileStandard(summary, labels);
        return;
      }

      if (isSectionedResult(summary.aggregate)) {
        renderStandardSectionedResult(summary.aggregate, labels);
        return;
      }

      renderStandardResult(summary.aggregate, labels.overall);
    },
  );

  await program.parseAsync(argv);
}
