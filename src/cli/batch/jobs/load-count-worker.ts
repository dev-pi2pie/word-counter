import { createResourceLimitError, resolveBatchJobsLimit } from "./limits";
import type { CountBatchWithJobsOptions, CountBatchWithJobsResult } from "./types";

export class WorkerRouteUnavailableError extends Error {}

export type WorkerRoutePreflight = {
  workerThreadsAvailable: boolean;
  workerRouteDisabledByEnv: boolean;
  disableWorkerJobsEnv: string | null;
  workerPoolModuleLoadable: boolean;
  workerEntryFound: boolean;
};

async function resolveWorkerThreadsAvailability(): Promise<boolean> {
  try {
    const workerThreads = await import("node:worker_threads");
    return typeof workerThreads.Worker === "function";
  } catch {
    return false;
  }
}

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
    message.includes("Cannot find module")
  );
}

export async function resolveWorkerRoutePreflight(
  env: NodeJS.ProcessEnv = process.env,
): Promise<WorkerRoutePreflight> {
  const disableWorkerJobsEnv = env.WORD_COUNTER_DISABLE_WORKER_JOBS ?? null;
  const workerRouteDisabledByEnv = disableWorkerJobsEnv === "1";
  const workerThreadsAvailable = await resolveWorkerThreadsAvailability();

  try {
    const workerPoolModule = await import("./worker-pool");
    return {
      workerThreadsAvailable,
      workerRouteDisabledByEnv,
      disableWorkerJobsEnv,
      workerPoolModuleLoadable: true,
      workerEntryFound: workerPoolModule.resolveWorkerEntryUrl() !== null,
    };
  } catch {
    return {
      workerThreadsAvailable,
      workerRouteDisabledByEnv,
      disableWorkerJobsEnv,
      workerPoolModuleLoadable: false,
      workerEntryFound: false,
    };
  }
}

export async function countBatchInputsWithWorkerJobs(
  filePaths: string[],
  options: CountBatchWithJobsOptions,
): Promise<CountBatchWithJobsResult> {
  const workerRouteDisabled = process.env.WORD_COUNTER_DISABLE_WORKER_JOBS === "1";
  if (workerRouteDisabled) {
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
      detectorMode: options.detectorMode ?? "regex",
      wcOptions: options.wcOptions,
      preserveCollectorSegments: options.preserveCollectorSegments,
      onFileProcessed: options.onFileProcessed,
      onDetectorDebugEvent: options.onDetectorDebugEvent,
      debugEnabled: options.onDetectorDebugEvent !== undefined,
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
