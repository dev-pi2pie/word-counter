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

const REQUIRED_NODE_RANGE = ">=22.18.0";
const REQUIRED_NODE_VERSION = {
  major: 22,
  minor: 18,
  patch: 0,
} as const;
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

function parseNodeVersion(version: string): {
  major: number;
  minor: number;
  patch: number;
} | null {
  const match = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:[-+].*)?$/.exec(version.trim());
  if (!match) {
    return null;
  }

  const major = Number.parseInt(match[1] ?? "", 10);
  const minor = Number.parseInt(match[2] ?? "0", 10);
  const patch = Number.parseInt(match[3] ?? "0", 10);

  if (!Number.isFinite(major) || !Number.isFinite(minor) || !Number.isFinite(patch)) {
    return null;
  }

  return { major, minor, patch };
}

function meetsRequiredNodeVersion(version: {
  major: number;
  minor: number;
  patch: number;
} | null): boolean {
  if (!version) {
    return false;
  }

  if (version.major !== REQUIRED_NODE_VERSION.major) {
    return version.major > REQUIRED_NODE_VERSION.major;
  }
  if (version.minor !== REQUIRED_NODE_VERSION.minor) {
    return version.minor > REQUIRED_NODE_VERSION.minor;
  }
  return version.patch >= REQUIRED_NODE_VERSION.patch;
}

function resolveRuntimeSummary(overrides: DoctorRuntimeOverrides = {}): DoctorRuntimeSummary {
  const packageVersion = normalizePackageVersion(
    overrides.packageVersion ?? EMBEDDED_PACKAGE_VERSION,
  );
  const nodeVersion = overrides.nodeVersion ?? process.version;
  const parsedNodeVersion = parseNodeVersion(nodeVersion);

  return {
    packageVersion,
    buildChannel: deriveBuildChannel(packageVersion),
    requiredNodeRange: REQUIRED_NODE_RANGE,
    nodeVersion,
    meetsProjectRequirement: meetsRequiredNodeVersion(parsedNodeVersion),
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
