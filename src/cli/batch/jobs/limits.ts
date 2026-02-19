import os from "node:os";
import type { BatchJobsLimit } from "./types";

const DEFAULT_UV_THREADPOOL_SIZE = 4;

function parsePositiveInteger(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }

  return parsed;
}

export function resolveBatchJobsLimit(env: NodeJS.ProcessEnv = process.env): BatchJobsLimit {
  const cpuLimit = Math.max(1, os.availableParallelism());
  const uvThreadpool = parsePositiveInteger(env.UV_THREADPOOL_SIZE) ?? DEFAULT_UV_THREADPOOL_SIZE;
  const ioLimit = Math.max(1, uvThreadpool * 2);
  const suggestedMaxJobs = Math.max(1, Math.min(cpuLimit, ioLimit));

  return {
    suggestedMaxJobs,
    cpuLimit,
    uvThreadpool,
    ioLimit,
  };
}

export function clampRequestedJobs(requestedJobs: number, limits: BatchJobsLimit): number {
  return Math.max(1, Math.min(requestedJobs, limits.suggestedMaxJobs));
}

export function formatJobsAdvisoryWarning(
  requestedJobs: number,
  effectiveJobs: number,
  limits: BatchJobsLimit,
): string {
  return [
    `Warning: requested --jobs=${requestedJobs} exceeds suggested host limit (${limits.suggestedMaxJobs}).`,
    `Running with --jobs=${effectiveJobs} as a safety cap.`,
    `Host limits: cpuLimit=${limits.cpuLimit}, uvThreadpool=${limits.uvThreadpool}, ioLimit=${limits.ioLimit}.`,
  ].join(" ");
}

export function isResourceLimitError(error: unknown): error is NodeJS.ErrnoException {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const code = "code" in error ? error.code : undefined;
  return code === "EMFILE" || code === "ENFILE";
}

export function createResourceLimitError(
  path: string,
  error: unknown,
  requestedJobs: number,
  limits: BatchJobsLimit,
): Error {
  const message = error instanceof Error ? error.message : String(error);
  const code =
    typeof error === "object" && error !== null && "code" in error ? String(error.code) : "UNKNOWN";

  return new Error(
    [
      `Resource limit reached while processing: ${path} (${code}: ${message}).`,
      `Requested --jobs=${requestedJobs}; suggested host limit is ${limits.suggestedMaxJobs}.`,
      "Reduce --jobs or raise OS file descriptor limits before retrying.",
    ].join(" "),
  );
}
