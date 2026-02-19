import type { SectionMode } from "../../../markdown";
import type wordCounter from "../../../wc";
import type { BatchFileInput, BatchFileResult, BatchSkip } from "../../types";
import type { BatchProgressSnapshot } from "../../progress/reporter";

export type BatchJobsStrategy = "load-only" | "load-count";

export type BatchJobsLimit = {
  suggestedMaxJobs: number;
  cpuLimit: number;
  uvThreadpool: number;
  ioLimit: number;
};

export type LoadBatchInputsWithJobsOptions = {
  jobs: number;
};

export type LoadBatchInputsWithJobsResult = {
  files: BatchFileInput[];
  skipped: BatchSkip[];
};

export type CountBatchWithJobsOptions = {
  jobs: number;
  section: SectionMode;
  wcOptions: Parameters<typeof wordCounter>[1];
  preserveCollectorSegments: boolean;
  onFileProcessed?: (snapshot: BatchProgressSnapshot) => void;
};

export type CountBatchWithJobsResult = {
  files: BatchFileResult[];
  skipped: BatchSkip[];
};
