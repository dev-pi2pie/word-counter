import { appendAll } from "../../utils/append-all";
import wordCounter, { type NonWordCollection, type WordCounterResult } from "../../wc";
import { createNonWordCollection, mergeNonWordCollections } from "../../wc/non-words";

export function mergeWordCounterResult(
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

export function aggregateWordCounterResults(
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
