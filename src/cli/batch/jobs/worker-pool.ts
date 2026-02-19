import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";
import type { SectionMode } from "../../../markdown";
import type wordCounter from "../../../wc";
import type { BatchProgressSnapshot } from "../../progress/reporter";
import type { BatchFileResult, BatchSkip } from "../../types";
import type {
  WorkerRequestMessage,
  WorkerResponseMessage,
  WorkerTaskMessage,
} from "./worker/protocol";

type CountBatchInputsWithWorkerPoolOptions = {
  filePaths: string[];
  jobs: number;
  section: SectionMode;
  wcOptions: Parameters<typeof wordCounter>[1];
  preserveCollectorSegments: boolean;
  onFileProcessed?: (snapshot: BatchProgressSnapshot) => void;
};

export class WorkerPoolUnavailableError extends Error {}
export class WorkerPoolTaskFatalError extends Error {
  path: string;
  code?: string;

  constructor(path: string, code: string | undefined, message: string) {
    super(message);
    this.path = path;
    this.code = code;
  }
}

type CompletedEntry =
  | {
      kind: "file";
      file: BatchFileResult;
    }
  | {
      kind: "skip";
      skip: BatchSkip;
    };

type PendingTask = {
  index: number;
  path: string;
  workerIndex: number;
};

function resolveWorkerEntryUrl(): URL | null {
  const candidates = [
    new URL("./worker/count-worker.mjs", import.meta.url),
    new URL("./worker/count-worker.js", import.meta.url),
    new URL("./worker/count-worker.ts", import.meta.url),
  ];

  for (const candidate of candidates) {
    if (existsSync(fileURLToPath(candidate))) {
      return candidate;
    }
  }

  return null;
}

function isWorkerResponseMessage(value: unknown): value is WorkerResponseMessage {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  if (!("type" in value)) {
    return false;
  }

  const type = (value as { type?: unknown }).type;
  return type === "result" || type === "fatal";
}

export async function countBatchInputsWithWorkerPool(
  options: CountBatchInputsWithWorkerPoolOptions,
): Promise<{ files: BatchFileResult[]; skipped: BatchSkip[] }> {
  if (options.filePaths.length === 0) {
    return { files: [], skipped: [] };
  }

  const workerEntryUrl = resolveWorkerEntryUrl();
  if (!workerEntryUrl) {
    throw new WorkerPoolUnavailableError(
      "Worker pool unavailable: count-worker entry file was not found.",
    );
  }

  const safeRequestedJobs = Number.isFinite(options.jobs) ? Math.floor(options.jobs) : 1;
  const workerCount = Math.max(1, Math.min(options.filePaths.length, safeRequestedJobs));
  const workers: Worker[] = [];
  const completedEntries: Array<CompletedEntry | undefined> = new Array(options.filePaths.length);
  const pendingTasks = new Map<number, PendingTask>();
  const requestedShutdownWorkers = new Set<number>();
  let nextIndex = 0;
  let nextTaskId = 1;
  let completed = 0;
  let settled = false;

  const teardownWorkers = async (): Promise<void> => {
    await Promise.allSettled(workers.map((worker) => worker.terminate()));
  };

  return new Promise((resolve, reject) => {
    const fail = async (error: Error): Promise<void> => {
      if (settled) {
        return;
      }
      settled = true;
      await teardownWorkers();
      reject(error);
    };

    const complete = async (): Promise<void> => {
      if (settled) {
        return;
      }
      settled = true;
      await teardownWorkers();

      const files: BatchFileResult[] = [];
      const skipped: BatchSkip[] = [];
      for (const entry of completedEntries) {
        if (!entry) {
          reject(new Error("Worker pool finalize failed: missing completed entry."));
          return;
        }
        if (entry.kind === "file") {
          files.push(entry.file);
          continue;
        }
        skipped.push(entry.skip);
      }

      resolve({ files, skipped });
    };

    const assignNextTask = (worker: Worker, workerIndex: number): void => {
      if (settled) {
        return;
      }

      if (nextIndex >= options.filePaths.length) {
        requestedShutdownWorkers.add(workerIndex);
        const shutdown: WorkerRequestMessage = { type: "shutdown" };
        worker.postMessage(shutdown);
        return;
      }

      const index = nextIndex;
      nextIndex += 1;
      const path = options.filePaths[index];
      if (!path) {
        void fail(new Error(`Worker pool dispatch failed: missing path at index ${index}.`));
        return;
      }

      const taskId = nextTaskId;
      nextTaskId += 1;
      pendingTasks.set(taskId, { index, path, workerIndex });

      const message: WorkerTaskMessage = {
        type: "task",
        taskId,
        index,
        path,
      };
      worker.postMessage(message);
    };

    for (let workerIndex = 0; workerIndex < workerCount; workerIndex += 1) {
      let worker: Worker;
      try {
        worker = new Worker(workerEntryUrl, {
          workerData: {
            section: options.section,
            wcOptions: options.wcOptions,
            preserveCollectorSegments: options.preserveCollectorSegments,
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        void fail(new WorkerPoolUnavailableError(`Worker pool initialization failed: ${message}`));
        return;
      }

      workers.push(worker);

      worker.on("message", (value: unknown) => {
        if (!isWorkerResponseMessage(value)) {
          void fail(new Error("Worker protocol mismatch: received unknown response payload."));
          return;
        }

        const pending = pendingTasks.get(value.taskId);
        if (!pending) {
          void fail(new Error(`Worker protocol mismatch: unknown task id ${value.taskId}.`));
          return;
        }

        pendingTasks.delete(value.taskId);
        if (value.index !== pending.index) {
          void fail(
            new Error(
              `Worker protocol mismatch: task index mismatch for ${value.taskId} (expected ${pending.index}, got ${value.index}).`,
            ),
          );
          return;
        }

        if (value.type === "fatal") {
          void fail(
            new WorkerPoolTaskFatalError(
              value.path,
              value.code,
              `Worker task failed for ${value.path} (${value.code ?? "UNKNOWN"}): ${value.message}`,
            ),
          );
          return;
        }

        if (value.payload.kind === "file") {
          completedEntries[pending.index] = {
            kind: "file",
            file: value.payload.file,
          };
        } else {
          completedEntries[pending.index] = {
            kind: "skip",
            skip: value.payload.skip,
          };
        }

        completed += 1;
        options.onFileProcessed?.({
          completed,
          total: options.filePaths.length,
        });

        if (completed >= options.filePaths.length) {
          void complete();
          return;
        }

        assignNextTask(worker, workerIndex);
      });

      worker.on("error", (error) => {
        const message = error instanceof Error ? error.message : String(error);
        void fail(new Error(`Worker runtime failed: ${message}`));
      });

      worker.on("exit", (code) => {
        if (settled) {
          return;
        }

        const hasPendingTask = [...pendingTasks.values()].some(
          (task) => task.workerIndex === workerIndex,
        );
        const requestedShutdown = requestedShutdownWorkers.has(workerIndex);

        if (hasPendingTask) {
          void fail(new Error(`Worker exited before completing assigned tasks (code ${code}).`));
          return;
        }

        if (code !== 0) {
          void fail(new Error(`Worker exited unexpectedly with code ${code}.`));
          return;
        }

        if (!requestedShutdown && completed < options.filePaths.length) {
          void fail(new Error("Worker exited unexpectedly before completion."));
        }
      });

      assignNextTask(worker, workerIndex);
    }
  });
}
