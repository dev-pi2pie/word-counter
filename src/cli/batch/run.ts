import type { SectionMode } from "../../markdown";
import type wordCounter from "../../wc";
import type { DebugChannel } from "../debug/channel";
import { type DirectoryExtensionFilter } from "../path/filter";
import { loadBatchInputs } from "../path/load";
import { resolveBatchFilePaths } from "../path/resolve";
import { type BatchProgressReporter } from "../progress/reporter";
import type { BatchOptions, BatchSummary } from "../types";
import { buildBatchSummary } from "./aggregate";

type RunBatchCountOptions = {
  pathInputs: string[];
  batchOptions: BatchOptions;
  extensionFilter: DirectoryExtensionFilter;
  section: SectionMode;
  wcOptions: Parameters<typeof wordCounter>[1];
  debug: DebugChannel;
  progressReporter: BatchProgressReporter;
};

export async function runBatchCount(options: RunBatchCountOptions): Promise<BatchSummary> {
  const batchStartedAtMs = Date.now();

  options.debug.emit("batch.resolve.start", {
    inputs: options.pathInputs.length,
    pathMode: options.batchOptions.pathMode,
    recursive: options.batchOptions.recursive,
  });

  const resolved = await resolveBatchFilePaths(options.pathInputs, {
    pathMode: options.batchOptions.pathMode,
    recursive: options.batchOptions.recursive,
    extensionFilter: options.extensionFilter,
  });
  options.debug.emit("batch.resolve.complete", {
    files: resolved.files.length,
    skipped: resolved.skipped.length,
  });

  options.debug.emit("batch.load.start", {
    files: resolved.files.length,
  });
  const loaded = await loadBatchInputs(resolved.files);
  options.debug.emit("batch.load.complete", {
    files: loaded.files.length,
    skipped: loaded.skipped.length,
  });

  const progressEnabled = options.progressReporter.enabled && loaded.files.length > 1;
  options.debug.emit("batch.progress.start", {
    enabled: progressEnabled,
    total: loaded.files.length,
  });

  if (progressEnabled) {
    options.progressReporter.start(loaded.files.length, batchStartedAtMs);
  }

  let summary: BatchSummary;
  try {
    summary = await buildBatchSummary(loaded.files, options.section, options.wcOptions, {
      onFileCounted: (snapshot) => {
        if (progressEnabled) {
          options.progressReporter.advance(snapshot);
        }
      },
    });
  } finally {
    if (progressEnabled) {
      options.progressReporter.finish();
    }
    options.debug.emit("batch.progress.complete", {
      enabled: progressEnabled,
      total: loaded.files.length,
    });
  }

  summary.skipped.push(...resolved.skipped, ...loaded.skipped);
  options.debug.emit("batch.aggregate.complete", {
    files: summary.files.length,
    skipped: summary.skipped.length,
    total: summary.aggregate.total,
  });

  return summary;
}
