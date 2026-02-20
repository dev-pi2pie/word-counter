import { countSections } from "../../../markdown";
import wordCounter from "../../../wc";
import { compactCollectorSegmentsInCountResult } from "../aggregate";
import { resolveBatchJobsLimit } from "./limits";
import { runBoundedQueue } from "./queue";
import { readBatchInput } from "./read-input";
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
    const loaded = await readBatchInput(filePaths[index], {
      requestedJobs: options.jobs,
      limits,
    });
    if (loaded.type === "skip") {
      completed += 1;
      options.onFileProcessed?.({ completed, total });
      return {
        type: "skip",
        skip: { path: loaded.path, reason: loaded.reason },
      } satisfies CountBatchEntry;
    }

    const result =
      options.section === "all"
        ? wordCounter(loaded.content, options.wcOptions)
        : countSections(loaded.content, options.section, options.wcOptions);

    if (!options.preserveCollectorSegments) {
      compactCollectorSegmentsInCountResult(result);
    }

    completed += 1;
    options.onFileProcessed?.({ completed, total });
    return {
      type: "file",
      file: {
        path: loaded.path,
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
