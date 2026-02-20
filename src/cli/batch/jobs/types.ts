import type { SectionMode } from "../../../markdown";
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
  wcOptions: Parameters<typeof wordCounter>[1];
  preserveCollectorSegments: boolean;
  onFileProcessed?: (snapshot: BatchProgressSnapshot) => void;
};

export type CountBatchWithJobsResult = {
  files: BatchFileResult[];
  skipped: BatchSkip[];
};
