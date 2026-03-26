import type { SectionMode } from "../../../markdown";
import type { DetectorMode } from "../../../detector";
import type { DetectorDebugContext, DetectorDebugVerbosity } from "../../../detector/debug";
import type wordCounter from "../../../wc";
import type { BatchFileResult, BatchSkip } from "../../types";
import type { BatchProgressSnapshot } from "../../progress/reporter";

export type BatchJobsStrategy = "load-count";

export type BatchJobsLimit = {
  suggestedMaxJobs: number;
  cpuLimit: number;
  uvThreadpool: number;
  ioLimit: number;
};

export type CountBatchWithJobsOptions = {
  jobs: number;
  section: SectionMode;
  detectorMode?: DetectorMode;
  wcOptions: Parameters<typeof wordCounter>[1];
  detectBinary?: boolean;
  preserveCollectorSegments: boolean;
  detectorEvidence?: boolean;
  debugVerbosity?: DetectorDebugVerbosity;
  onFileProcessed?: (snapshot: BatchProgressSnapshot) => void;
  createDetectorDebugContext?: (input: { path: string }) => DetectorDebugContext | undefined;
  onDetectorDebugEvent?: (
    event: string,
    details?: Record<string, unknown>,
    options?: { verbosity?: "compact" | "verbose" },
  ) => void;
};

export type CountBatchWithJobsResult = {
  files: BatchFileResult[];
  skipped: BatchSkip[];
};
