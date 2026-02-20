import type { BatchJobsStrategy } from "./types";

export function resolveBatchJobsStrategy(_jobs: number): BatchJobsStrategy {
  return "load-count";
}
