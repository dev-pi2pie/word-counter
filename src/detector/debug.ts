import type { SectionMode } from "../markdown";
import { DEFAULT_HAN_TAG, DEFAULT_LOCALE } from "../wc/locale-detect";
import type { WordCounterMode } from "../wc/types";
import type { DetectorRouteTag } from "./policy";
import type { DetectorMode } from "./types";

export type DetectorDebugVerbosity = "compact" | "verbose";
export const DETECTOR_EVIDENCE_PREVIEW_LIMIT = 160;

export type DetectorEvidenceConfig = {
  verbosity: DetectorDebugVerbosity;
  mode: WordCounterMode;
  section: SectionMode;
};

export type DetectorDebugSummary = {
  mode: DetectorMode;
  engine: "none" | "whatlang-wasm";
  windowsTotal: number;
  accepted: number;
  fallback: number;
  routes: {
    latin: number;
    han: number;
  };
  acceptancePaths: {
    reliable: number;
    corroborated: number;
  };
  fallbackReasons: {
    notEligible: number;
    noCandidate: number;
    belowThreshold: number;
    qualityGate: number;
    corroborationUnreliable: number;
  };
};

export type DetectorDebugContext = {
  emit?: (
    event: string,
    details?: Record<string, unknown>,
    options?: { verbosity?: DetectorDebugVerbosity },
  ) => void;
  summary?: DetectorDebugSummary;
  evidence?: DetectorEvidenceConfig;
};

export type DetectorFallbackReason =
  | "notEligible"
  | "noCandidate"
  | "belowThreshold"
  | "qualityGate"
  | "corroborationUnreliable";

export function createDetectorDebugSummary(
  mode: DetectorMode,
  engine: DetectorDebugSummary["engine"] = mode === "wasm" ? "whatlang-wasm" : "none",
): DetectorDebugSummary {
  return {
    mode,
    engine,
    windowsTotal: 0,
    accepted: 0,
    fallback: 0,
    routes: {
      latin: 0,
      han: 0,
    },
    acceptancePaths: {
      reliable: 0,
      corroborated: 0,
    },
    fallbackReasons: {
      notEligible: 0,
      noCandidate: 0,
      belowThreshold: 0,
      qualityGate: 0,
      corroborationUnreliable: 0,
    },
  };
}

export function mergeDetectorDebugSummaries(
  summaries: Array<DetectorDebugSummary | undefined>,
): DetectorDebugSummary | undefined {
  const present = summaries.filter(
    (summary): summary is DetectorDebugSummary => summary !== undefined,
  );
  if (present.length === 0) {
    return undefined;
  }

  const first = present[0]!;
  const merged = createDetectorDebugSummary(first.mode, first.engine);
  for (const summary of present) {
    merged.windowsTotal += summary.windowsTotal;
    merged.accepted += summary.accepted;
    merged.fallback += summary.fallback;
    merged.routes.latin += summary.routes.latin;
    merged.routes.han += summary.routes.han;
    merged.acceptancePaths.reliable += summary.acceptancePaths.reliable;
    merged.acceptancePaths.corroborated += summary.acceptancePaths.corroborated;
    merged.fallbackReasons.notEligible += summary.fallbackReasons.notEligible;
    merged.fallbackReasons.noCandidate += summary.fallbackReasons.noCandidate;
    merged.fallbackReasons.belowThreshold += summary.fallbackReasons.belowThreshold;
    merged.fallbackReasons.qualityGate += summary.fallbackReasons.qualityGate;
    merged.fallbackReasons.corroborationUnreliable +=
      summary.fallbackReasons.corroborationUnreliable;
  }

  return merged;
}

export function recordDetectorWindow(
  summary: DetectorDebugSummary | undefined,
  routeTag: DetectorRouteTag,
): void {
  if (!summary) {
    return;
  }

  summary.windowsTotal += 1;
  if (routeTag === DEFAULT_LOCALE) {
    summary.routes.latin += 1;
    return;
  }
  if (routeTag === DEFAULT_HAN_TAG) {
    summary.routes.han += 1;
  }
}

export function recordDetectorAccepted(
  summary: DetectorDebugSummary | undefined,
  path: "reliable" | "corroborated",
): void {
  if (!summary) {
    return;
  }

  summary.accepted += 1;
  if (path === "reliable") {
    summary.acceptancePaths.reliable += 1;
    return;
  }

  summary.acceptancePaths.corroborated += 1;
}

export function recordDetectorFallback(
  summary: DetectorDebugSummary | undefined,
  reason: DetectorFallbackReason,
): void {
  if (!summary) {
    return;
  }

  summary.fallback += 1;
  summary.fallbackReasons[reason] += 1;
}

export function createDetectorEvidencePreview(text: string): {
  preview: string;
  truncated: boolean;
} {
  const collapsed = text.replace(/\s+/gu, " ").trim();
  const codePoints = Array.from(collapsed);
  if (codePoints.length <= DETECTOR_EVIDENCE_PREVIEW_LIMIT) {
    return {
      preview: collapsed,
      truncated: false,
    };
  }

  return {
    preview: codePoints.slice(0, DETECTOR_EVIDENCE_PREVIEW_LIMIT).join(""),
    truncated: true,
  };
}
