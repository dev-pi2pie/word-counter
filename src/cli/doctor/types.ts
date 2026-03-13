import type { BatchJobsLimit } from "../batch/jobs/types";

export type DoctorOutputFormat = "standard" | "json";
export type DoctorStatus = "ok" | "warn" | "fail";
export type DoctorBuildChannel = "stable" | "canary";

export type SegmenterConstructor = new (
  locale: string,
  options: { granularity: "word" | "grapheme" },
) => {
  segment(input: string): Iterable<unknown>;
};

export type SegmenterIntlLike = {
  Segmenter?: SegmenterConstructor;
};

export type DoctorRuntimeSummary = {
  packageVersion: string;
  buildChannel: DoctorBuildChannel;
  requiredNodeRange: string;
  nodeVersion: string;
  meetsProjectRequirement: boolean;
  platform: NodeJS.Platform;
  arch: string;
};

export type DoctorSegmenterHealth = {
  available: boolean;
  wordGranularity: boolean;
  graphemeGranularity: boolean;
  sampleWordSegmentation: boolean;
};

export type DoctorWorkerRouteHealth = {
  workerThreadsAvailable: boolean;
  workerRouteDisabledByEnv: boolean;
  disableWorkerJobsEnv: string | null;
  workerPoolModuleLoadable: boolean;
  workerEntryFound: boolean;
};

export type DoctorReport = {
  status: DoctorStatus;
  runtime: DoctorRuntimeSummary;
  segmenter: DoctorSegmenterHealth;
  jobs: BatchJobsLimit;
  workerRoute: DoctorWorkerRouteHealth;
  warnings: string[];
};

export type DoctorRuntimeOverrides = {
  packageVersion?: string;
  nodeVersion?: string;
  platform?: NodeJS.Platform;
  arch?: string;
  env?: NodeJS.ProcessEnv;
  intl?: SegmenterIntlLike;
};
