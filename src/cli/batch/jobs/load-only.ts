import { readFile } from "node:fs/promises";
import { isProbablyBinary } from "../../path/load";
import { createResourceLimitError, isResourceLimitError, resolveBatchJobsLimit } from "./limits";
import { runBoundedQueue } from "./queue";
import type { LoadBatchInputsWithJobsOptions, LoadBatchInputsWithJobsResult } from "./types";

type LoadBatchEntry =
  | { type: "file"; path: string; content: string }
  | { type: "skip"; path: string; reason: string };

export async function loadBatchInputsWithJobs(
  filePaths: string[],
  options: LoadBatchInputsWithJobsOptions,
): Promise<LoadBatchInputsWithJobsResult> {
  const limits = resolveBatchJobsLimit();

  const entries = await runBoundedQueue(filePaths.length, options.jobs, async (index) => {
    const path = filePaths[index];
    if (!path) {
      return { type: "skip", path: "", reason: "not readable: missing path" } satisfies LoadBatchEntry;
    }

    let buffer: Buffer;
    try {
      buffer = await readFile(path);
    } catch (error) {
      if (isResourceLimitError(error)) {
        throw createResourceLimitError(path, error, options.jobs, limits);
      }
      const message = error instanceof Error ? error.message : String(error);
      return { type: "skip", path, reason: `not readable: ${message}` } satisfies LoadBatchEntry;
    }

    if (isProbablyBinary(buffer)) {
      return { type: "skip", path, reason: "binary file" } satisfies LoadBatchEntry;
    }

    return { type: "file", path, content: buffer.toString("utf8") } satisfies LoadBatchEntry;
  });

  const files: LoadBatchInputsWithJobsResult["files"] = [];
  const skipped: LoadBatchInputsWithJobsResult["skipped"] = [];

  for (const entry of entries) {
    if (entry.type === "file") {
      files.push({ path: entry.path, content: entry.content });
      continue;
    }
    skipped.push({ path: entry.path, reason: entry.reason });
  }

  return { files, skipped };
}
