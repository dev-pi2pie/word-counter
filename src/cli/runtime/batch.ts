import type { SectionedResult } from "../../markdown";
import { runBatchCount } from "../batch/run";
import {
  clampRequestedJobs,
  formatJobsAdvisoryWarning,
  resolveBatchJobsLimit,
} from "../batch/jobs/limits";
import { resolveBatchJobsStrategy } from "../batch/jobs/strategy";
import type { DebugChannel } from "../debug/channel";
import {
  getTotalLabels,
  isSectionedResult,
  renderPerFileStandard,
  renderStandardResult,
  renderStandardSectionedResult,
  reportSkipped,
} from "../output/render";
import { normalizeBatchSummaryBase } from "../output/normalize-base";
import { buildDirectoryExtensionFilter } from "../path/filter";
import { createBatchProgressReporter } from "../progress/reporter";
import { resolveTotalOfOverride, type TotalOfOverride } from "../total-of";
import type { BatchOptions } from "../types";
import type { WordCounterResult } from "../../wc";
import { resolveBatchScope } from "./options";
import type { CliActionOptions, ResolvedCountRunOptions, RunCliOptions } from "./types";
import pc from "picocolors";

type ExecuteBatchCountOptions = {
  argv: string[];
  options: CliActionOptions;
  runtime: RunCliOptions;
  resolved: ResolvedCountRunOptions;
  debug: DebugChannel;
  teeEnabled: boolean;
};

export async function executeBatchCount({
  argv,
  options,
  runtime,
  resolved,
  debug,
  teeEnabled,
}: ExecuteBatchCountOptions): Promise<void> {
  const warningsEnabled = !Boolean(options.quietWarnings);
  const emitWarning = (message: string): void => {
    if (!warningsEnabled) {
      return;
    }
    const warningLine = message.startsWith("Warning:") ? message : `Warning: ${message}`;
    console.error(pc.yellow(warningLine));
  };

  const batchOptions: BatchOptions = {
    scope: resolveBatchScope(argv),
    pathMode: options.pathMode,
    recursive: options.recursive,
    quietSkips: Boolean(options.quietSkips),
    directoryRegexPattern: options.regex,
  };

  const extensionFilter = buildDirectoryExtensionFilter(options.includeExt, options.excludeExt);
  const requestedJobs = options.jobs;
  const jobsLimit = resolveBatchJobsLimit();
  const jobs = clampRequestedJobs(requestedJobs, jobsLimit);
  if (requestedJobs > jobsLimit.suggestedMaxJobs) {
    emitWarning(formatJobsAdvisoryWarning(requestedJobs, jobs, jobsLimit));
  }
  const jobsStrategy = resolveBatchJobsStrategy(jobs);

  const debugEnabled = Boolean(options.debug);
  const mirrorDebugToTerminal = debugEnabled && (!debug.reportPath || teeEnabled);
  const summary = await runBatchCount({
    pathInputs: options.path ?? [],
    batchOptions,
    extensionFilter,
    section: options.section,
    wcOptions: resolved.wcOptions,
    preserveCollectorSegments: options.format === "json",
    debug,
    progressReporter: createBatchProgressReporter({
      enabled: options.format === "standard" && options.progress,
      stream: runtime.stderr ?? process.stderr,
      clearOnFinish: !(mirrorDebugToTerminal || options.keepProgress),
    }),
    jobs,
    jobsStrategy,
    emitWarning,
  });

  const showSkipDiagnostics = debugEnabled && !batchOptions.quietSkips;
  const showSkipItems = showSkipDiagnostics && Boolean(options.verbose);
  debug.emit("batch.skips.policy", {
    enabled: showSkipDiagnostics,
    items: showSkipItems,
    quietSkips: batchOptions.quietSkips,
  });
  if (showSkipDiagnostics) {
    debug.emit("batch.skips.report", {
      count: summary.skipped.length,
    });
    if (showSkipItems) {
      for (const skip of summary.skipped) {
        debug.emit(
          "batch.skips.item",
          {
            path: skip.path,
            reason: skip.reason,
          },
          { verbosity: "verbose" },
        );
      }
    }

    if (mirrorDebugToTerminal) {
      reportSkipped(summary.skipped);
    }
  }

  if (summary.files.length === 0) {
    throw new Error("No readable text-like inputs were found from --path.");
  }

  let aggregateTotalOfOverride: TotalOfOverride | undefined;
  let totalOfOverridesByResult: WeakMap<object, TotalOfOverride> | undefined;
  if (resolved.totalOfParts && resolved.totalOfParts.length > 0) {
    totalOfOverridesByResult = new WeakMap<object, TotalOfOverride>();
    const aggregateOverride = resolveTotalOfOverride(summary.aggregate, resolved.totalOfParts);
    if (aggregateOverride) {
      totalOfOverridesByResult.set(summary.aggregate as object, aggregateOverride);
      aggregateTotalOfOverride = aggregateOverride;
    }

    for (const file of summary.files) {
      const fileOverride = resolveTotalOfOverride(file.result, resolved.totalOfParts);
      if (!fileOverride) {
        continue;
      }
      totalOfOverridesByResult.set(file.result as object, fileOverride);
    }
  } else {
    aggregateTotalOfOverride = resolveTotalOfOverride(summary.aggregate, resolved.totalOfParts);
  }

  if (resolved.shouldNormalizeBaseOutput) {
    normalizeBatchSummaryBase(summary);
  }

  if (!aggregateTotalOfOverride && totalOfOverridesByResult) {
    aggregateTotalOfOverride = totalOfOverridesByResult.get(summary.aggregate as object);
  }

  if (options.format === "raw") {
    console.log(aggregateTotalOfOverride?.total ?? summary.aggregate.total);
    return;
  }

  if (options.format === "json") {
    const spacing = options.pretty ? 2 : 0;

    if (batchOptions.scope === "per-file") {
      const skipped = showSkipDiagnostics ? summary.skipped : undefined;
      const fileEntries = summary.files.map((file) => {
        const base = {
          path: file.path,
          result: file.result,
        };

        if (!resolved.totalOfParts || resolved.totalOfParts.length === 0) {
          return base;
        }

        const fileOverride =
          totalOfOverridesByResult?.get(file.result as object) ??
          resolveTotalOfOverride(file.result, resolved.totalOfParts);
        if (!fileOverride) {
          return base;
        }

        return {
          ...base,
          meta: {
            totalOf: fileOverride.parts,
            totalOfOverride: fileOverride.total,
          },
        };
      });
      const meta =
        resolved.totalOfParts && resolved.totalOfParts.length > 0
          ? {
              totalOf: resolved.totalOfParts,
              aggregateTotalOfOverride: aggregateTotalOfOverride?.total ?? summary.aggregate.total,
            }
          : undefined;
      const payload = {
        scope: "per-file",
        files: fileEntries,
        ...(skipped ? { skipped } : {}),
        aggregate: summary.aggregate,
        ...(meta ? { meta } : {}),
      };
      console.log(JSON.stringify(payload, null, spacing));
      return;
    }

    if (!aggregateTotalOfOverride) {
      console.log(JSON.stringify(summary.aggregate, null, spacing));
      return;
    }
    console.log(
      JSON.stringify(
        {
          ...summary.aggregate,
          meta: {
            totalOf: aggregateTotalOfOverride.parts,
            totalOfOverride: aggregateTotalOfOverride.total,
          },
        },
        null,
        spacing,
      ),
    );
    return;
  }

  const labels = getTotalLabels(options.mode, resolved.requestedNonWords);
  const totalOfResolver =
    resolved.totalOfParts && resolved.totalOfParts.length > 0
      ? (result: WordCounterResult | SectionedResult) =>
          totalOfOverridesByResult?.get(result as object) ??
          resolveTotalOfOverride(result, resolved.totalOfParts)
      : undefined;

  if (batchOptions.scope === "per-file") {
    renderPerFileStandard(summary, labels, totalOfResolver);
    return;
  }

  if (isSectionedResult(summary.aggregate)) {
    renderStandardSectionedResult(summary.aggregate, labels, aggregateTotalOfOverride);
    return;
  }

  renderStandardResult(summary.aggregate, labels.overall, aggregateTotalOfOverride);
}
