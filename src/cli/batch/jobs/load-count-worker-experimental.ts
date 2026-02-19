import { createResourceLimitError, resolveBatchJobsLimit } from "./limits";
import type { CountBatchWithJobsOptions, CountBatchWithJobsResult } from "./types";

export class WorkerRouteUnavailableError extends Error {}

function isFallbackFriendlyWorkerError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const code = "code" in error ? String(error.code) : "";
  if (
    code === "ERR_WORKER_PATH" ||
    code === "ERR_WORKER_UNSUPPORTED_EXTENSION" ||
    code === "ERR_UNKNOWN_FILE_EXTENSION" ||
    code === "ERR_MODULE_NOT_FOUND"
  ) {
    return true;
  }

  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("Unknown file extension") ||
    message.includes("Cannot find module") ||
    message.includes("Worker exited before completing assigned tasks")
  );
}

export async function countBatchInputsWithWorkerJobs(
  filePaths: string[],
  options: CountBatchWithJobsOptions,
): Promise<CountBatchWithJobsResult> {
  if (process.env.WORD_COUNTER_DISABLE_EXPERIMENTAL_WORKERS === "1") {
    throw new WorkerRouteUnavailableError("Worker route disabled by environment.");
  }

  let workerPoolModule: Awaited<typeof import("./worker-pool")>;
  try {
    workerPoolModule = await import("./worker-pool");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new WorkerRouteUnavailableError(`Worker route unavailable: ${message}`);
  }

  try {
    return await workerPoolModule.countBatchInputsWithWorkerPool({
      filePaths,
      jobs: options.jobs,
      section: options.section,
      wcOptions: options.wcOptions,
      onFileProcessed: options.onFileProcessed,
    });
  } catch (error) {
    if (error instanceof workerPoolModule.WorkerPoolTaskFatalError) {
      if (error.code === "EMFILE" || error.code === "ENFILE") {
        throw createResourceLimitError(
          error.path,
          { code: error.code, message: error.message },
          options.jobs,
          resolveBatchJobsLimit(),
        );
      }
      throw new Error(error.message);
    }

    if (
      error instanceof workerPoolModule.WorkerPoolUnavailableError ||
      isFallbackFriendlyWorkerError(error)
    ) {
      const message = error instanceof Error ? error.message : String(error);
      throw new WorkerRouteUnavailableError(`Worker route unavailable: ${message}`);
    }

    throw error;
  }
}
