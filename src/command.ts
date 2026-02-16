import { Command, Option } from "commander";
import { readFileSync } from "node:fs";
import type { SectionMode, SectionedResult } from "./markdown";
import { countSections } from "./markdown";
import { runBatchCount } from "./cli/batch/run";
import { createDebugChannel } from "./cli/debug/channel";
import {
  buildDirectoryExtensionFilter,
  collectExtensionOption,
} from "./cli/path/filter";
import { createBatchProgressReporter, type ProgressOutputStream } from "./cli/progress/reporter";
import type { BatchOptions, BatchScope, BatchSummary, PathMode } from "./cli/types";
import {
  getTotalLabels,
  isSectionedResult,
  renderPerFileStandard,
  renderStandardResult,
  renderStandardSectionedResult,
  reportSkipped,
} from "./cli/output/render";
import {
  parseTotalOfOption,
  requiresNonWordCollection,
  requiresWhitespaceCollection,
  resolveTotalOfOverride,
  type TotalOfOverride,
  type TotalOfPart,
} from "./cli/total-of";
import wordCounter, {
  type WordCounterMode,
  type WordCounterResult,
} from "./wc";
import { normalizeMode } from "./wc/mode";
import pc from "picocolors";

type OutputFormat = "standard" | "raw" | "json";

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

function hasPathInput(pathValues: string[] | undefined): pathValues is string[] {
  return Array.isArray(pathValues) && pathValues.length > 0;
}

function normalizeWordCounterResultBase(result: WordCounterResult): WordCounterResult {
  result.total = result.counts?.words ?? result.total;
  delete result.counts;

  if (result.breakdown.mode === "collector") {
    delete result.breakdown.nonWords;
    return result;
  }

  if (result.breakdown.mode === "char") {
    for (const item of result.breakdown.items) {
      const nonWordCount =
        (item.nonWords?.counts.emoji ?? 0) +
        (item.nonWords?.counts.symbols ?? 0) +
        (item.nonWords?.counts.punctuation ?? 0) +
        (item.nonWords?.counts.whitespace ?? 0);
      item.chars = Math.max(0, item.chars - nonWordCount);
      delete item.nonWords;
    }
    return result;
  }

  for (const item of result.breakdown.items) {
    delete item.nonWords;
  }

  return result;
}

function normalizeSectionedResultBase(result: SectionedResult): SectionedResult {
  let total = 0;
  for (const item of result.items) {
    normalizeWordCounterResultBase(item.result);
    total += item.result.total;
  }
  result.total = total;
  return result;
}

function normalizeResultBase(
  result: WordCounterResult | SectionedResult,
): WordCounterResult | SectionedResult {
  if ("section" in result) {
    return normalizeSectionedResultBase(result);
  }
  return normalizeWordCounterResultBase(result);
}

function normalizeBatchSummaryBase(summary: BatchSummary): BatchSummary {
  for (const file of summary.files) {
    normalizeResultBase(file.result);
  }
  normalizeResultBase(summary.aggregate);
  return summary;
}

type RunCliOptions = {
  stderr?: ProgressOutputStream;
};

export async function runCli(argv: string[] = process.argv, runtime: RunCliOptions = {}): Promise<void> {
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
        latinLanguage?: string;
        latinTag?: string;
        latinLocale?: string;
        hanLanguage?: string;
        hanTag?: string;
        nonWords?: boolean;
        includeWhitespace?: boolean;
        misc?: boolean;
        totalOf?: TotalOfPart[];
        path?: string[];
        pathMode: PathMode;
        recursive: boolean;
        progress: boolean;
        keepProgress?: boolean;
        quietSkips?: boolean;
        debug?: boolean;
        includeExt?: string[];
        excludeExt?: string[];
      },
    ) => {
      const useSection = options.section !== "all";
      const totalOfParts = options.totalOf;
      const requestedNonWords = Boolean(options.nonWords || options.includeWhitespace || options.misc);
      const collectNonWordsForOverride = requiresNonWordCollection(totalOfParts);
      const collectWhitespaceForOverride = requiresWhitespaceCollection(totalOfParts);
      const enableNonWords = Boolean(
        options.nonWords ||
          options.includeWhitespace ||
          options.misc ||
          collectNonWordsForOverride,
      );
      const enableWhitespace = Boolean(
        options.includeWhitespace ||
          options.misc ||
          collectWhitespaceForOverride,
      );
      const shouldNormalizeBaseOutput = !requestedNonWords && enableNonWords;
      const wcOptions = {
        mode: options.mode,
        latinLanguageHint: options.latinLanguage,
        latinTagHint: options.latinTag,
        latinLocaleHint: options.latinLocale,
        hanLanguageHint: options.hanLanguage,
        hanTagHint: options.hanTag,
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
        const totalOfOverride = resolveTotalOfOverride(result, totalOfParts);
        const displayResult = shouldNormalizeBaseOutput ? normalizeResultBase(result) : result;

        if (options.format === "raw") {
          console.log(totalOfOverride?.total ?? displayResult.total);
          return;
        }

        if (options.format === "json") {
          const spacing = options.pretty ? 2 : 0;
          if (!totalOfOverride) {
            console.log(JSON.stringify(displayResult, null, spacing));
            return;
          }
          console.log(
            JSON.stringify(
              {
                ...displayResult,
                meta: {
                  totalOf: totalOfOverride.parts,
                  totalOfOverride: totalOfOverride.total,
                },
              },
              null,
              spacing,
            ),
          );
          return;
        }

        const labels = getTotalLabels(options.mode, requestedNonWords);
        if (isSectionedResult(displayResult)) {
          renderStandardSectionedResult(displayResult, labels, totalOfOverride);
          return;
        }

        renderStandardResult(displayResult, labels.overall, totalOfOverride);
        return;
      }

      const batchOptions: BatchOptions = {
        scope: resolveBatchScope(argv),
        pathMode: options.pathMode,
        recursive: options.recursive,
        quietSkips: Boolean(options.quietSkips),
      };

      const debug = createDebugChannel(Boolean(options.debug));
      const extensionFilter = buildDirectoryExtensionFilter(options.includeExt, options.excludeExt);
      const summary = await runBatchCount({
        pathInputs: options.path,
        batchOptions,
        extensionFilter,
        section: options.section,
        wcOptions,
        preserveCollectorSegments: options.format === "json",
        debug,
        progressReporter: createBatchProgressReporter({
          enabled: options.format === "standard" && options.progress,
          stream: runtime.stderr ?? (process.stderr as unknown as ProgressOutputStream),
          clearOnFinish: !(options.debug || options.keepProgress),
        }),
      });

      const showSkipDiagnostics = Boolean(options.debug) && !batchOptions.quietSkips;
      debug.emit("batch.skips.policy", {
        enabled: showSkipDiagnostics,
        quietSkips: batchOptions.quietSkips,
      });
      if (showSkipDiagnostics) {
        debug.emit("batch.skips.report", {
          count: summary.skipped.length,
        });
        reportSkipped(summary.skipped);
      }

      if (summary.files.length === 0) {
        program.error(pc.red("No readable text-like inputs were found from --path."));
        return;
      }

      let aggregateTotalOfOverride: TotalOfOverride | undefined;
      let totalOfOverridesByResult: WeakMap<object, TotalOfOverride> | undefined;
      if (totalOfParts && totalOfParts.length > 0) {
        totalOfOverridesByResult = new WeakMap<object, TotalOfOverride>();
        const aggregateOverride = resolveTotalOfOverride(summary.aggregate, totalOfParts);
        if (aggregateOverride) {
          totalOfOverridesByResult.set(summary.aggregate as object, aggregateOverride);
          aggregateTotalOfOverride = aggregateOverride;
        }

        for (const file of summary.files) {
          const fileOverride = resolveTotalOfOverride(file.result, totalOfParts);
          if (!fileOverride) {
            continue;
          }
          totalOfOverridesByResult.set(file.result as object, fileOverride);
        }
      } else {
        aggregateTotalOfOverride = resolveTotalOfOverride(summary.aggregate, totalOfParts);
      }

      if (shouldNormalizeBaseOutput) {
        normalizeBatchSummaryBase(summary);
      }

      if (!aggregateTotalOfOverride && totalOfOverridesByResult) {
        aggregateTotalOfOverride = totalOfOverridesByResult.get(summary.aggregate as object);
      }

      if (options.format === "raw") {
        console.log(aggregateTotalOfOverride?.total ?? summary.aggregate.total);
        return;
      }

      if (options.format === "json") {
        const spacing = options.pretty ? 2 : 0;

        if (batchOptions.scope === "per-file") {
          const skipped = showSkipDiagnostics ? summary.skipped : undefined;
          const meta =
            totalOfParts && totalOfParts.length > 0
              ? {
                  totalOf: totalOfParts,
                  aggregateTotalOfOverride:
                    aggregateTotalOfOverride?.total ?? summary.aggregate.total,
                }
              : undefined;
          const payload = {
            scope: "per-file",
            files: summary.files.map((file) => ({
              path: file.path,
              result: file.result,
            })),
            ...(skipped ? { skipped } : {}),
            aggregate: summary.aggregate,
            ...(meta ? { meta } : {}),
          };
          console.log(JSON.stringify(payload, null, spacing));
          return;
        }

        if (!aggregateTotalOfOverride) {
          console.log(JSON.stringify(summary.aggregate, null, spacing));
          return;
        }
        console.log(
          JSON.stringify(
            {
              ...summary.aggregate,
              meta: {
                totalOf: aggregateTotalOfOverride.parts,
                totalOfOverride: aggregateTotalOfOverride.total,
              },
            },
            null,
            spacing,
          ),
        );
        return;
      }

      const labels = getTotalLabels(options.mode, requestedNonWords);
      const totalOfResolver =
        totalOfParts && totalOfParts.length > 0
          ? (result: WordCounterResult | SectionedResult) =>
              totalOfOverridesByResult?.get(result as object) ??
              resolveTotalOfOverride(result, totalOfParts)
          : undefined;

      if (batchOptions.scope === "per-file") {
        renderPerFileStandard(summary, labels, totalOfResolver);
        return;
      }

      if (isSectionedResult(summary.aggregate)) {
        renderStandardSectionedResult(summary.aggregate, labels, aggregateTotalOfOverride);
        return;
      }

      renderStandardResult(summary.aggregate, labels.overall, aggregateTotalOfOverride);
    },
  );

  await program.parseAsync(argv);
}

export { buildBatchSummary } from "./cli/batch/aggregate";
export { loadBatchInputs } from "./cli/path/load";
export { resolveBatchFilePaths } from "./cli/path/resolve";
