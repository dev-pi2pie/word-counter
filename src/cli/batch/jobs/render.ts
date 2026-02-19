import type { SectionMode } from "../../../markdown";
import type wordCounter from "../../../wc";
import { finalizeBatchSummaryFromFileResults } from "../aggregate";
import type { BatchFileResult, BatchSummary } from "../../types";

type FinalizeBatchJobsSummaryOptions = {
  onFinalizeStart?: () => void;
  preserveCollectorSegments?: boolean;
};

export function finalizeBatchJobsSummary(
  files: BatchFileResult[],
  section: SectionMode,
  wcOptions: Parameters<typeof wordCounter>[1],
  options: FinalizeBatchJobsSummaryOptions = {},
): BatchSummary {
  return finalizeBatchSummaryFromFileResults(files, section, wcOptions, {
    onFinalizeStart: options.onFinalizeStart,
    preserveCollectorSegments: options.preserveCollectorSegments,
  });
}
