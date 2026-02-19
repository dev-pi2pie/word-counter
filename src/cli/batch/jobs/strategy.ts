import type { BatchJobsStrategy } from "./types";

export function resolveBatchJobsStrategy(jobs: number): BatchJobsStrategy {
  return jobs > 1 ? "load-count" : "load-only";
}
