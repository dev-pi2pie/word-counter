import { readFile } from "node:fs/promises";
import { countSections } from "../../../markdown";
import wordCounter from "../../../wc";
import { compactCollectorSegmentsInCountResult } from "../aggregate";
import { isProbablyBinary } from "../../path/load";
import { createResourceLimitError, isResourceLimitError, resolveBatchJobsLimit } from "./limits";
import { runBoundedQueue } from "./queue";
import type { CountBatchWithJobsOptions, CountBatchWithJobsResult } from "./types";

type CountBatchEntry =
  | {
      type: "file";
      file: CountBatchWithJobsResult["files"][number];
    }
  | {
      type: "skip";
      skip: CountBatchWithJobsResult["skipped"][number];
    };

export async function countBatchInputsWithJobs(
  filePaths: string[],
  options: CountBatchWithJobsOptions,
): Promise<CountBatchWithJobsResult> {
  const limits = resolveBatchJobsLimit();
  const total = filePaths.length;
  let completed = 0;

  const entries = await runBoundedQueue(filePaths.length, options.jobs, async (index) => {
    const path = filePaths[index];
    if (!path) {
      completed += 1;
      options.onFileProcessed?.({ completed, total });
      return {
        type: "skip",
        skip: { path: "", reason: "not readable: missing path" },
      } satisfies CountBatchEntry;
    }

    let buffer: Buffer;
    try {
      buffer = await readFile(path);
    } catch (error) {
      if (isResourceLimitError(error)) {
        throw createResourceLimitError(path, error, options.jobs, limits);
      }
      const message = error instanceof Error ? error.message : String(error);
      completed += 1;
      options.onFileProcessed?.({ completed, total });
      return {
        type: "skip",
        skip: { path, reason: `not readable: ${message}` },
      } satisfies CountBatchEntry;
    }

    if (isProbablyBinary(buffer)) {
      completed += 1;
      options.onFileProcessed?.({ completed, total });
      return {
        type: "skip",
        skip: { path, reason: "binary file" },
      } satisfies CountBatchEntry;
    }

    const content = buffer.toString("utf8");
    const result =
      options.section === "all"
        ? wordCounter(content, options.wcOptions)
        : countSections(content, options.section, options.wcOptions);

    if (!options.preserveCollectorSegments) {
      compactCollectorSegmentsInCountResult(result);
    }

    completed += 1;
    options.onFileProcessed?.({ completed, total });
    return {
      type: "file",
      file: {
        path,
        result,
      },
    } satisfies CountBatchEntry;
  });

  const files: CountBatchWithJobsResult["files"] = [];
  const skipped: CountBatchWithJobsResult["skipped"] = [];
  for (const entry of entries) {
    if (entry.type === "file") {
      files.push(entry.file);
      continue;
    }
    skipped.push(entry.skip);
  }

  return { files, skipped };
}
