import type { SectionMode } from "../markdown";
import type { LocaleChunk } from "../wc/types";
import {
  countSectionsWithRegexDetector,
  inspectTextWithRegexDetector,
  segmentTextByLocaleWithRegexDetector,
  wordCounterWithRegexDetector,
} from "./none";
import {
  countSectionsWithWasmDetector,
  inspectTextWithWasmDetector,
  segmentTextByLocaleWithWasmDetector,
  WASM_DETECTOR_RUNTIME_UNAVAILABLE_MESSAGE,
  wordCounterWithWasmDetector,
} from "./wasm";
import { inspectTextWithDetector } from "./inspect";
import { createDetectorDebugSummary, mergeDetectorDebugSummaries } from "./debug";
import type {
  DetectorContentGateMode,
  DetectorContentGateOptions,
  DetectorCountSectionsOptions,
  DetectorLocaleOptions,
  DetectorMode,
  DetectorResult,
  DetectorSource,
  DetectorWordCounterOptions,
} from "./types";

export type {
  DetectorContentGateMode,
  DetectorContentGateOptions,
  DetectorCountSections,
  DetectorCountSectionsOptions,
  DetectorCountResult,
  DetectorLocaleOptions,
  DetectorMode,
  DetectorResult,
  DetectorRuntimeOptions,
  DetectorSource,
  DetectorWordCounterOptions,
} from "./types";
export type {
  DetectorInspectChunk,
  DetectorInspectDecision,
  DetectorInspectEngine,
  DetectorInspectEngineRaw,
  DetectorInspectEngineResult,
  DetectorInspectInput,
  DetectorInspectInputOptions,
  DetectorInspectInputSourceType,
  DetectorInspectKind,
  DetectorInspectOptions,
  DetectorInspectPipelineResult,
  DetectorInspectResult,
  DetectorInspectSample,
  DetectorInspectSchemaVersion,
  DetectorInspectView,
  DetectorInspectWindow,
} from "./inspect-types";
export type {
  DetectorDebugContext,
  DetectorDebugSummary,
  DetectorDebugVerbosity,
  DetectorEvidenceConfig,
  DetectorFallbackReason,
} from "./debug";

export const DETECTOR_MODES: DetectorMode[] = ["regex", "wasm"];
export const DEFAULT_DETECTOR_MODE: DetectorMode = "regex";

export function resolveDetectorMode(mode?: DetectorMode): DetectorMode {
  return mode ?? DEFAULT_DETECTOR_MODE;
}

export function assertDetectorModeImplemented(mode?: DetectorMode): void {
  void mode;
}

export async function segmentTextByLocaleWithDetector(
  text: string,
  options: DetectorLocaleOptions = {},
): Promise<LocaleChunk[]> {
  const mode = resolveDetectorMode(options.detector);
  if (mode === "wasm") {
    return segmentTextByLocaleWithWasmDetector(text, options);
  }
  return segmentTextByLocaleWithRegexDetector(text, options);
}

export async function wordCounterWithDetector(
  text: string,
  options: DetectorWordCounterOptions = {},
) {
  const mode = resolveDetectorMode(options.detector);
  if (mode === "wasm") {
    return wordCounterWithWasmDetector(text, options);
  }
  return wordCounterWithRegexDetector(text, options);
}

export async function countSectionsWithDetector(
  input: string,
  section: SectionMode,
  options: DetectorCountSectionsOptions = {},
) {
  const mode = resolveDetectorMode(options.detector);
  if (mode === "wasm") {
    return countSectionsWithWasmDetector(input, section, options);
  }
  return countSectionsWithRegexDetector(input, section, options);
}

export const DETECTOR_SOURCES: DetectorSource[] = ["script", "hint", "wasm"];
export const DEFAULT_DETECTOR_RESULT_SOURCE: DetectorSource = "script";
export { WASM_DETECTOR_RUNTIME_UNAVAILABLE_MESSAGE };
export {
  createDetectorDebugSummary,
  inspectTextWithDetector,
  inspectTextWithRegexDetector,
  inspectTextWithWasmDetector,
  mergeDetectorDebugSummaries,
};

export function createDetectorResult(
  tag: string,
  source: DetectorSource = DEFAULT_DETECTOR_RESULT_SOURCE,
  confidence?: number,
  reliable?: boolean,
): DetectorResult {
  return {
    tag,
    source,
    ...(confidence === undefined ? {} : { confidence }),
    ...(reliable === undefined ? {} : { reliable }),
  };
}
