import type { CliActionOptions } from "../runtime/types";
import type { ParsedInspectInvocation } from "../inspect/types";
import type { WordCounterConfig } from "./types";

export type CountCliSources = {
  detector: boolean;
  contentGate: boolean;
  pathMode: boolean;
  recursive: boolean;
  includeExt: boolean;
  excludeExt: boolean;
  totalOf: boolean;
  debug: boolean;
  verbose: boolean;
  debugReport: boolean;
  debugReportTee: boolean;
  progress: boolean;
  quietSkips: boolean;
};

function withConfigQuietSkips(
  currentQuietSkips: boolean | undefined,
  skippedFiles: boolean | undefined,
): boolean | undefined {
  if (skippedFiles === undefined) {
    return currentQuietSkips;
  }

  return skippedFiles ? false : true;
}

export function applyConfigToCountOptions(
  options: CliActionOptions,
  config: WordCounterConfig,
  sources: CountCliSources,
): CliActionOptions {
  const next: CliActionOptions = { ...options };

  if (!sources.detector && config.detector !== undefined) {
    next.detector = config.detector;
  }

  if (!sources.contentGate && config.contentGate?.mode !== undefined) {
    next.contentGate = config.contentGate.mode;
  }

  if (!sources.pathMode && config.path?.mode !== undefined) {
    next.pathMode = config.path.mode;
  }

  if (!sources.recursive && config.path?.recursive !== undefined) {
    next.recursive = config.path.recursive;
  }

  next.pathDetectBinary = config.path?.detectBinary ?? next.pathDetectBinary ?? true;

  if (!sources.includeExt && config.path?.includeExtensions !== undefined) {
    next.includeExt = [...config.path.includeExtensions];
  }

  if (!sources.excludeExt && config.path?.excludeExtensions !== undefined) {
    next.excludeExt = [...config.path.excludeExtensions];
  }

  if (!sources.totalOf && config.output?.totalOf !== undefined) {
    next.totalOf = [...config.output.totalOf];
  }

  if (!sources.debug && config.logging?.level !== undefined) {
    next.debug = config.logging.level === "debug";
  }

  const debugEnabled = next.debug === true;

  if (debugEnabled && !sources.verbose && config.logging?.verbosity !== undefined) {
    next.verbose = config.logging.verbosity === "verbose";
  }

  if (debugEnabled && !sources.debugReport && config.reporting?.debugReport?.path !== undefined) {
    next.debugReport = config.reporting.debugReport.path;
  }

  const debugReportEnabled = next.debugReport !== undefined && next.debugReport !== false;

  if (
    debugEnabled &&
    debugReportEnabled &&
    !sources.debugReportTee &&
    config.reporting?.debugReport?.tee !== undefined
  ) {
    next.debugReportTee = config.reporting.debugReport.tee;
  }

  if (!sources.progress && config.progress?.mode !== undefined) {
    next.progressMode = config.progress.mode;
  }

  if (!sources.quietSkips) {
    next.quietSkips = withConfigQuietSkips(next.quietSkips, config.reporting?.skippedFiles);
  }

  return next;
}

export function applyConfigToInspectInvocation(
  validated: ParsedInspectInvocation,
  config: WordCounterConfig,
): ParsedInspectInvocation {
  const next: ParsedInspectInvocation = {
    ...validated,
    includeExt: [...validated.includeExt],
    excludeExt: [...validated.excludeExt],
    sources: { ...validated.sources },
  };

  const detectorFromConfig = config.inspect?.detector ?? config.detector;
  if (!next.sources.detector && detectorFromConfig !== undefined) {
    next.detector = detectorFromConfig;
  }

  const contentGateFromConfig = config.inspect?.contentGate?.mode ?? config.contentGate?.mode;
  if (!next.sources.contentGate && contentGateFromConfig !== undefined) {
    next.contentGateMode = contentGateFromConfig;
  }

  if (!next.sources.pathMode && config.path?.mode !== undefined) {
    next.pathMode = config.path.mode;
  }

  if (!next.sources.recursive && config.path?.recursive !== undefined) {
    next.recursive = config.path.recursive;
  }

  next.pathDetectBinary = config.path?.detectBinary ?? next.pathDetectBinary ?? true;

  if (!next.sources.includeExt && config.path?.includeExtensions !== undefined) {
    next.includeExt = [...config.path.includeExtensions];
  }

  if (!next.sources.excludeExt && config.path?.excludeExtensions !== undefined) {
    next.excludeExt = [...config.path.excludeExtensions];
  }

  return next;
}
