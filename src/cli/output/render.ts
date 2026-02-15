import { relative as relativePath } from "node:path";
import type { SectionMode, SectionedResult } from "../../markdown";
import { showSingularOrPluralWord } from "../../utils";
import type { NonWordCollection, WordCounterMode, WordCounterResult } from "../../wc";
import type { BatchSkip, BatchSummary } from "../types";
import pc from "picocolors";

type CountUnit = "word" | "character";

type CountBreakdownItem = {
  locale: string;
  count: number;
  nonWords?: NonWordCollection;
};

export type TotalLabels = {
  overall: string;
  section: string;
};

function getCountUnit(mode: WordCounterMode): CountUnit {
  return mode === "char" ? "character" : "word";
}

export function getTotalLabels(mode: WordCounterMode, includeNonWords: boolean): TotalLabels {
  const unit = mode === "char" ? "characters" : "words";
  if (includeNonWords) {
    return { overall: "Total count", section: "total count" };
  }
  return { overall: `Total ${unit}`, section: `total ${unit}` };
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

export function renderStandardResult(result: WordCounterResult, totalLabel: string): void {
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
    return source === "frontmatter"
      ? `[Frontmatter] (${totalLabel})`
      : `[Content] (${totalLabel})`;
  }

  if (sectionMode === "per-key") {
    return `[Frontmatter] ${sectionName} (${totalLabel})`;
  }

  if (sectionMode === "split-per-key") {
    return source === "content"
      ? `[Content] (${totalLabel})`
      : `[Frontmatter] ${sectionName} (${totalLabel})`;
  }

  return `[Section] ${sectionName} (${totalLabel})`;
}

export function renderStandardSectionedResult(result: SectionedResult, labels: TotalLabels): void {
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

export function isSectionedResult(
  result: WordCounterResult | SectionedResult,
): result is SectionedResult {
  return "section" in result;
}

function toDisplayPath(inputPath: string): string {
  const relative = relativePath(process.cwd(), inputPath);
  if (relative && !relative.startsWith("..")) {
    return relative || ".";
  }
  return inputPath;
}

export function reportSkipped(skipped: BatchSkip[]): void {
  if (skipped.length === 0) {
    return;
  }

  console.error(pc.yellow(`Skipped ${skipped.length} path(s):`));
  for (const item of skipped) {
    console.error(pc.yellow(`- ${toDisplayPath(item.path)} (${item.reason})`));
  }
}

export function renderPerFileStandard(summary: BatchSummary, labels: TotalLabels): void {
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
