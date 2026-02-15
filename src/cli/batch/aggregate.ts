import { countSections } from "../../markdown";
import type { SectionMode, SectionedResult } from "../../markdown";
import wordCounter, { type NonWordCollection, type WordCounterResult } from "../../wc";
import { createNonWordCollection, mergeNonWordCollections } from "../../wc/non-words";
import type { BatchFileInput, BatchFileResult, BatchSummary } from "../types";
import type { BatchProgressSnapshot } from "../progress/reporter";

type BuildBatchSummaryOptions = {
  onFileCounted?: (snapshot: BatchProgressSnapshot) => void;
};

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
      result: aggregateWordCounterResults(entry.items),
    }));

  return {
    section,
    total,
    frontmatterType,
    items,
  };
}

export async function buildBatchSummary(
  inputs: BatchFileInput[],
  section: SectionMode,
  wcOptions: Parameters<typeof wordCounter>[1],
  options: BuildBatchSummaryOptions = {},
): Promise<BatchSummary> {
  const files: BatchFileResult[] = [];

  for (const input of inputs) {
    const result =
      section === "all"
        ? wordCounter(input.content, wcOptions)
        : countSections(input.content, section, wcOptions);

    files.push({
      path: input.path,
      result,
    });

    options.onFileCounted?.({
      completed: files.length,
      total: inputs.length,
    });
  }

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
