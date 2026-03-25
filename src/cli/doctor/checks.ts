import { EMBEDDED_PACKAGE_VERSION } from "../program/version-embedded";
import { resolveBatchJobsLimit } from "../batch/jobs/limits";
import { resolveWorkerRoutePreflight } from "../batch/jobs/load-count-worker";
import type {
  DoctorBuildChannel,
  DoctorReport,
  DoctorRuntimeOverrides,
  DoctorSegmenterHealth,
  DoctorStatus,
  DoctorRuntimeSummary,
} from "./types";

const REQUIRED_NODE_RANGE = ">=20";
const REQUIRED_NODE_MAJOR = 20;
const SAMPLE_TEXT = "Hello 世界";

function normalizePackageVersion(value: string | undefined): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "0.0.0";
}

function deriveBuildChannel(packageVersion: string): DoctorBuildChannel {
  const prereleaseMatch = /(?:^|[.-])(alpha|beta|rc|canary)(?:[.-]|$)/i.exec(packageVersion);
  if (!prereleaseMatch) {
    return "stable";
  }

  const channel = prereleaseMatch[1]?.toLowerCase();
  if (channel === "alpha" || channel === "beta" || channel === "rc" || channel === "canary") {
    return channel;
  }

  return "stable";
}

function parseNodeMajor(version: string): number | null {
  const match = /^v?(\d+)(?:\.\d+){0,2}(?:[-+].*)?$/.exec(version.trim());
  if (!match) {
    return null;
  }

  const major = Number.parseInt(match[1] ?? "", 10);
  return Number.isFinite(major) ? major : null;
}

function resolveRuntimeSummary(overrides: DoctorRuntimeOverrides = {}): DoctorRuntimeSummary {
  const packageVersion = normalizePackageVersion(
    overrides.packageVersion ?? EMBEDDED_PACKAGE_VERSION,
  );
  const nodeVersion = overrides.nodeVersion ?? process.version;
  const major = parseNodeMajor(nodeVersion);

  return {
    packageVersion,
    buildChannel: deriveBuildChannel(packageVersion),
    requiredNodeRange: REQUIRED_NODE_RANGE,
    nodeVersion,
    meetsProjectRequirement: major !== null && major >= REQUIRED_NODE_MAJOR,
    platform: overrides.platform ?? process.platform,
    arch: overrides.arch ?? process.arch,
  };
}

function resolveSegmenterHealth(overrides: DoctorRuntimeOverrides = {}): DoctorSegmenterHealth {
  const intlLike = overrides.intl ?? Intl;
  const Segmenter = intlLike.Segmenter;
  const available = typeof Segmenter === "function";

  let wordGranularity = false;
  let graphemeGranularity = false;
  let sampleWordSegmentation = false;

  if (!available) {
    return {
      available,
      wordGranularity,
      graphemeGranularity,
      sampleWordSegmentation,
    };
  }

  try {
    const wordSegmenter = new Segmenter("en", { granularity: "word" });
    wordGranularity = true;
    for (const _segment of wordSegmenter.segment(SAMPLE_TEXT)) {
      sampleWordSegmentation = true;
      break;
    }
  } catch {
    wordGranularity = false;
    sampleWordSegmentation = false;
  }

  try {
    new Segmenter("en", { granularity: "grapheme" });
    graphemeGranularity = true;
  } catch {
    graphemeGranularity = false;
  }

  return {
    available,
    wordGranularity,
    graphemeGranularity,
    sampleWordSegmentation,
  };
}

function collectWarnings(
  runtime: DoctorRuntimeSummary,
  segmenter: DoctorSegmenterHealth,
  workerRoute: Awaited<ReturnType<typeof resolveWorkerRoutePreflight>>,
): string[] {
  const warnings: string[] = [];

  if (!runtime.meetsProjectRequirement) {
    warnings.push(
      `Node.js ${runtime.nodeVersion} is outside the supported range ${runtime.requiredNodeRange}.`,
    );
  }

  if (!segmenter.available) {
    warnings.push("Intl.Segmenter is unavailable.");
  } else {
    if (!segmenter.wordGranularity) {
      warnings.push("Intl.Segmenter word granularity is unusable.");
    }
    if (!segmenter.graphemeGranularity) {
      warnings.push("Intl.Segmenter grapheme granularity is unusable.");
    }
    if (!segmenter.sampleWordSegmentation) {
      warnings.push("Intl.Segmenter sample segmentation failed.");
    }
  }

  if (!workerRoute.workerThreadsAvailable) {
    warnings.push("Worker threads are unavailable on this runtime.");
  }
  if (workerRoute.workerRouteDisabledByEnv) {
    warnings.push("Worker route is disabled by environment.");
  }
  if (!workerRoute.workerPoolModuleLoadable) {
    warnings.push("Worker route preflight failed: worker-pool module could not be loaded.");
  } else if (!workerRoute.workerEntryFound) {
    warnings.push("Worker route preflight failed: count-worker entry file was not found.");
  }

  return warnings;
}

function resolveStatus(segmenter: DoctorSegmenterHealth, warnings: string[]): DoctorStatus {
  const hardFailure =
    !segmenter.available ||
    !segmenter.wordGranularity ||
    !segmenter.graphemeGranularity ||
    !segmenter.sampleWordSegmentation;

  if (hardFailure) {
    return "fail";
  }

  if (warnings.length > 0) {
    return "warn";
  }

  return "ok";
}

export async function createDoctorReport(
  overrides: DoctorRuntimeOverrides = {},
): Promise<DoctorReport> {
  const runtime = resolveRuntimeSummary(overrides);
  const segmenter = resolveSegmenterHealth(overrides);
  const env = overrides.env ?? process.env;
  const jobs = resolveBatchJobsLimit(env);
  const workerRoute = await resolveWorkerRoutePreflight(env);
  const warnings = collectWarnings(runtime, segmenter, workerRoute);

  return {
    status: resolveStatus(segmenter, warnings),
    runtime,
    segmenter,
    jobs,
    workerRoute,
    warnings,
  };
}

export { REQUIRED_NODE_RANGE };
