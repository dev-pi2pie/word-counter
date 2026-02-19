import type { BatchJobsStrategy } from "./types";

export function resolveBatchJobsStrategy(enableExperimentalLoadCount: boolean | undefined): BatchJobsStrategy {
  return enableExperimentalLoadCount ? "load-count-experimental" : "load-only";
}
