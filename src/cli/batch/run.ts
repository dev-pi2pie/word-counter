import type { SectionMode } from "../../markdown";
import { appendAll } from "../../utils/append-all";
import type wordCounter from "../../wc";
import type { DebugChannel } from "../debug/channel";
import { countBatchInputsWithJobs } from "./jobs/load-count-experimental";
import { loadBatchInputsWithJobs } from "./jobs/load-only";
import { finalizeBatchJobsSummary } from "./jobs/render";
import type { BatchJobsStrategy } from "./jobs/types";
import { type DirectoryExtensionFilter } from "../path/filter";
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
  jobs: number;
  jobsStrategy: BatchJobsStrategy;
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
    directoryRegexPattern: options.batchOptions.directoryRegexPattern,
    debug: options.debug,
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

  options.debug.emit("batch.jobs.strategy", {
    strategy: options.jobsStrategy,
    jobs: options.jobs,
  });

  let summary: BatchSummary;
  let routeSkips: BatchSummary["skipped"] = [];

  if (options.jobsStrategy === "load-only") {
    const loadStartedAtMs = Date.now();
    options.debug.emit("batch.load.start", {
      files: resolved.files.length,
      jobs: options.jobs,
      strategy: options.jobsStrategy,
    });
    const loaded = await loadBatchInputsWithJobs(resolved.files, {
      jobs: options.jobs,
    });
    const loadElapsedMs = Date.now() - loadStartedAtMs;
    options.debug.emit("batch.load.complete", {
      files: loaded.files.length,
      skipped: loaded.skipped.length,
      elapsedMs: loadElapsedMs,
      strategy: options.jobsStrategy,
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

    routeSkips = loaded.skipped;
  } else {
    options.debug.emit("batch.load.start", {
      files: resolved.files.length,
      jobs: options.jobs,
      strategy: options.jobsStrategy,
    });
    options.debug.emit("batch.load.complete", {
      files: 0,
      skipped: 0,
      elapsedMs: 0,
      strategy: options.jobsStrategy,
    });
    options.debug.emit("batch.stage.timing", {
      stage: "load",
      elapsedMs: 0,
    });

    const progressEnabled = options.progressReporter.enabled && resolved.files.length > 1;
    options.debug.emit("batch.progress.start", {
      enabled: progressEnabled,
      total: resolved.files.length,
    });

    if (progressEnabled) {
      options.progressReporter.start(resolved.files.length, batchStartedAtMs);
    }

    const countStartedAtMs = Date.now();
    let finalizeStartedAtMs: number | null = null;
    let emittedCountTiming = false;
    try {
      const counted = await countBatchInputsWithJobs(resolved.files, {
        jobs: options.jobs,
        section: options.section,
        wcOptions: options.wcOptions,
        onFileProcessed: (snapshot) => {
          if (progressEnabled) {
            options.progressReporter.advance(snapshot);
          }
        },
      });

      routeSkips = counted.skipped;
      summary = finalizeBatchJobsSummary(counted.files, options.section, options.wcOptions, {
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
        total: resolved.files.length,
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
  }

  appendAll(summary.skipped, resolved.skipped);
  appendAll(summary.skipped, routeSkips);
  options.debug.emit("batch.aggregate.complete", {
    files: summary.files.length,
    skipped: summary.skipped.length,
    total: summary.aggregate.total,
  });

  return summary;
}
