import type { SectionedResult } from "../../markdown";
import type { BatchSummary } from "../types";
import type { WordCounterResult } from "../../wc";

function normalizeWordCounterResultBase(result: WordCounterResult): WordCounterResult {
  result.total = result.counts?.words ?? result.total;
  delete result.counts;

  if (result.breakdown.mode === "collector") {
    delete result.breakdown.nonWords;
    return result;
  }

  if (result.breakdown.mode === "char" || result.breakdown.mode === "char-collector") {
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

export function normalizeResultBase(
  result: WordCounterResult | SectionedResult,
): WordCounterResult | SectionedResult {
  if ("section" in result) {
    return normalizeSectionedResultBase(result);
  }
  return normalizeWordCounterResultBase(result);
}

export function normalizeBatchSummaryBase(summary: BatchSummary): BatchSummary {
  for (const file of summary.files) {
    normalizeResultBase(file.result);
  }
  normalizeResultBase(summary.aggregate);
  return summary;
}
