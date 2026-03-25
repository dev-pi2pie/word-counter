import type { SectionedResult } from "../../markdown";
import type { WordCounterResult } from "../../wc";

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
