import {
  assertDetectorModeImplemented,
  countSectionsWithDetector,
  createDetectorDebugSummary,
  createDetectorResult,
  DEFAULT_DETECTOR_MODE,
  DEFAULT_DETECTOR_RESULT_SOURCE,
  DETECTOR_MODES,
  DETECTOR_SOURCES,
  inspectTextWithDetector,
  inspectTextWithRegexDetector,
  inspectTextWithWasmDetector,
  mergeDetectorDebugSummaries,
  resolveDetectorMode,
  segmentTextByLocaleWithDetector,
  WASM_DETECTOR_RUNTIME_UNAVAILABLE_MESSAGE,
  wordCounterWithDetector,
} from "./index";

const cjsExports = {
  assertDetectorModeImplemented,
  countSectionsWithDetector,
  createDetectorDebugSummary,
  createDetectorResult,
  DEFAULT_DETECTOR_MODE,
  DEFAULT_DETECTOR_RESULT_SOURCE,
  DETECTOR_MODES,
  DETECTOR_SOURCES,
  inspectTextWithDetector,
  inspectTextWithRegexDetector,
  inspectTextWithWasmDetector,
  mergeDetectorDebugSummaries,
  resolveDetectorMode,
  segmentTextByLocaleWithDetector,
  WASM_DETECTOR_RUNTIME_UNAVAILABLE_MESSAGE,
  wordCounterWithDetector,
};

export = cjsExports;
