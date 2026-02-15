import type { SectionMode } from "../../markdown";
import { appendAll } from "../../utils/append-all";
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
  preserveCollectorSegments: boolean;
  debug: DebugChannel;
  progressReporter: BatchProgressReporter;
};

export async function runBatchCount(options: RunBatchCountOptions): Promise<BatchSummary> {
  const batchStartedAtMs = Date.now();
  const resolveStartedAtMs = Date.now();

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
  const resolveElapsedMs = Date.now() - resolveStartedAtMs;
  options.debug.emit("batch.resolve.complete", {
    files: resolved.files.length,
    skipped: resolved.skipped.length,
    elapsedMs: resolveElapsedMs,
  });
  options.debug.emit("batch.stage.timing", {
    stage: "resolve",
    elapsedMs: resolveElapsedMs,
  });

  const loadStartedAtMs = Date.now();
  options.debug.emit("batch.load.start", {
    files: resolved.files.length,
  });
  const loaded = await loadBatchInputs(resolved.files);
  const loadElapsedMs = Date.now() - loadStartedAtMs;
  options.debug.emit("batch.load.complete", {
    files: loaded.files.length,
    skipped: loaded.skipped.length,
    elapsedMs: loadElapsedMs,
  });
  options.debug.emit("batch.stage.timing", {
    stage: "load",
    elapsedMs: loadElapsedMs,
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
  const countStartedAtMs = Date.now();
  let finalizeStartedAtMs: number | null = null;
  let emittedCountTiming = false;
  try {
    summary = await buildBatchSummary(loaded.files, options.section, options.wcOptions, {
      onFileCounted: (snapshot) => {
        if (progressEnabled) {
          options.progressReporter.advance(snapshot);
        }
      },
      onFinalizeStart: () => {
        finalizeStartedAtMs = Date.now();
        if (progressEnabled) {
          options.progressReporter.startFinalizing();
        }

        const countElapsedMs = finalizeStartedAtMs - countStartedAtMs;
        options.debug.emit("batch.stage.timing", {
          stage: "count",
          elapsedMs: countElapsedMs,
        });
        emittedCountTiming = true;
      },
      preserveCollectorSegments: options.preserveCollectorSegments,
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

  if (!emittedCountTiming) {
    const countElapsedMs = Date.now() - countStartedAtMs;
    options.debug.emit("batch.stage.timing", {
      stage: "count",
      elapsedMs: countElapsedMs,
    });
  }

  const finalizeElapsedMs = finalizeStartedAtMs === null ? 0 : Date.now() - finalizeStartedAtMs;
  options.debug.emit("batch.stage.timing", {
    stage: "finalize",
    elapsedMs: finalizeElapsedMs,
  });

  appendAll(summary.skipped, resolved.skipped);
  appendAll(summary.skipped, loaded.skipped);
  options.debug.emit("batch.aggregate.complete", {
    files: summary.files.length,
    skipped: summary.skipped.length,
    total: summary.aggregate.total,
  });

  return summary;
}
