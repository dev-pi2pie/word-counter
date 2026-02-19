import { countSections } from "../../markdown";
import type { SectionMode, SectionedResult } from "../../markdown";
import { appendAll } from "../../utils/append-all";
import wordCounter, { type NonWordCollection, type WordCounterResult } from "../../wc";
import { createNonWordCollection, mergeNonWordCollections } from "../../wc/non-words";
import type { BatchFileInput, BatchFileResult, BatchSummary } from "../types";
import type { BatchProgressSnapshot } from "../progress/reporter";

type BuildBatchSummaryOptions = {
  onFileCounted?: (snapshot: BatchProgressSnapshot) => void;
  onFinalizeStart?: () => void;
  preserveCollectorSegments?: boolean;
};

type FinalizeBatchSummaryFromFileResultsOptions = {
  onFinalizeStart?: () => void;
  preserveCollectorSegments?: boolean;
};

function mergeWordCounterResult(
  left: WordCounterResult,
  right: WordCounterResult,
  preserveCollectorSegments: boolean,
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

  if (
    left.breakdown.mode === "char-collector" &&
    right.breakdown.mode === "char-collector"
  ) {
    const localeOrder: string[] = [];
    const mergedByLocale = new Map<
      string,
      {
        locale: string;
        chars: number;
        nonWords?: NonWordCollection;
      }
    >();

    const addItems = (items: typeof left.breakdown.items): void => {
      for (const item of items) {
        const existing = mergedByLocale.get(item.locale);
        if (existing) {
          existing.chars += item.chars;
          if (item.nonWords) {
            if (!existing.nonWords) {
              existing.nonWords = createNonWordCollection();
            }
            mergeNonWordCollections(existing.nonWords, item.nonWords);
          }
          continue;
        }

        localeOrder.push(item.locale);
        mergedByLocale.set(item.locale, {
          locale: item.locale,
          chars: item.chars,
          nonWords: item.nonWords
            ? mergeNonWordCollections(createNonWordCollection(), item.nonWords)
            : undefined,
        });
      }
    };

    addItems(left.breakdown.items);
    addItems(right.breakdown.items);

    return {
      total,
      counts,
      breakdown: {
        mode: "char-collector",
        items: localeOrder.map((locale) => {
          const value = mergedByLocale.get(locale);
          if (!value) {
            throw new Error(`Missing char-collector entry for locale: ${locale}`);
          }
          return value;
        }),
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
          if (preserveCollectorSegments) {
            appendAll(existing.segments, item.segments);
          }
          continue;
        }

        localeOrder.push(item.locale);
        mergedByLocale.set(item.locale, {
          locale: item.locale,
          words: item.words,
          segments: preserveCollectorSegments ? [...item.segments] : [],
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

function aggregateWordCounterResults(
  results: WordCounterResult[],
  preserveCollectorSegments: boolean,
): WordCounterResult {
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
    aggregate = mergeWordCounterResult(aggregate, current, preserveCollectorSegments);
  }

  return aggregate;
}

function buildSectionKey(name: string, source: "frontmatter" | "content"): string {
  return `${source}:${name}`;
}

function aggregateSectionedResults(
  results: SectionedResult[],
  preserveCollectorSegments: boolean,
): SectionedResult {
  if (results.length === 0) {
    return {
      section: "all",
      total: 0,
      frontmatterType: null,
      items: [],
    };
  }

  const section = results[0]?.section ?? "all";
  const grouped = new Map<
    string,
    {
      name: string;
      source: "frontmatter" | "content";
      items: WordCounterResult[];
    }
  >();
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
      result: aggregateWordCounterResults(entry.items, preserveCollectorSegments),
    }));

  return {
    section,
    total,
    frontmatterType,
    items,
  };
}

function stripCollectorSegmentsFromWordCounterResult(result: WordCounterResult): void {
  if (result.breakdown.mode !== "collector") {
    return;
  }

  for (const item of result.breakdown.items) {
    item.segments = [];
  }
}

function stripCollectorSegmentsFromSectionedResult(result: SectionedResult): void {
  for (const item of result.items) {
    stripCollectorSegmentsFromWordCounterResult(item.result);
  }
}

export function compactCollectorSegmentsInCountResult(
  result: WordCounterResult | SectionedResult,
): void {
  if ("section" in result) {
    stripCollectorSegmentsFromSectionedResult(result);
    return;
  }

  stripCollectorSegmentsFromWordCounterResult(result);
}

export async function buildBatchSummary(
  inputs: BatchFileInput[],
  section: SectionMode,
  wcOptions: Parameters<typeof wordCounter>[1],
  options: BuildBatchSummaryOptions = {},
): Promise<BatchSummary> {
  const preserveCollectorSegments = options.preserveCollectorSegments ?? true;
  const files: BatchFileResult[] = [];

  for (const input of inputs) {
    const result =
      section === "all"
        ? wordCounter(input.content, wcOptions)
        : countSections(input.content, section, wcOptions);

    if (!preserveCollectorSegments) {
      compactCollectorSegmentsInCountResult(result);
    }

    files.push({
      path: input.path,
      result,
    });

    options.onFileCounted?.({
      completed: files.length,
      total: inputs.length,
    });
  }

  return finalizeBatchSummaryFromFileResults(files, section, wcOptions, {
    onFinalizeStart: options.onFinalizeStart,
    preserveCollectorSegments: options.preserveCollectorSegments,
  });
}

export function finalizeBatchSummaryFromFileResults(
  files: BatchFileResult[],
  section: SectionMode,
  wcOptions: Parameters<typeof wordCounter>[1],
  options: FinalizeBatchSummaryFromFileResultsOptions = {},
): BatchSummary {
  const preserveCollectorSegments = options.preserveCollectorSegments ?? true;
  if (!preserveCollectorSegments) {
    for (const file of files) {
      compactCollectorSegmentsInCountResult(file.result);
    }
  }

  options.onFinalizeStart?.();
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
      ? aggregateWordCounterResults(
          files.map((file) => file.result as WordCounterResult),
          preserveCollectorSegments,
        )
      : aggregateSectionedResults(
          files.map((file) => file.result as SectionedResult),
          preserveCollectorSegments,
        );

  return {
    files,
    skipped: [],
    aggregate,
  };
}
