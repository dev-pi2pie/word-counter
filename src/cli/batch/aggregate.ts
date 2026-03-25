import { countSections } from "../../markdown";
import type { SectionMode, SectionedResult } from "../../markdown";
import wordCounter, { type WordCounterResult } from "../../wc";
import type { BatchFileInput, BatchFileResult, BatchSummary } from "../types";
import type { BatchProgressSnapshot } from "../progress/reporter";
import { compactCollectorSegmentsInCountResult } from "./aggregate-compact";
import { aggregateSectionedResults } from "./aggregate-sections";
import { aggregateWordCounterResults } from "./aggregate-word-counter";

type BuildBatchSummaryOptions = {
  onFileCounted?: (snapshot: BatchProgressSnapshot) => void;
  onFinalizeStart?: () => void;
  preserveCollectorSegments?: boolean;
};

type FinalizeBatchSummaryFromFileResultsOptions = {
  onFinalizeStart?: () => void;
  preserveCollectorSegments?: boolean;
};

export { compactCollectorSegmentsInCountResult } from "./aggregate-compact";

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
