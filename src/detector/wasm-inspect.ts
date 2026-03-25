import { DETECTOR_ROUTE_POLICIES, type DetectorWindow } from "./policy";
import {
  createInspectChunk,
  createInspectPreview,
  type TracedLocaleChunk,
} from "./inspect-helpers";
import type {
  DetectorInspectResult,
  DetectorInspectWindow,
} from "./inspect-types";
import type { ResolvedDetectorWindow } from "./wasm-resolution";
import type { ExecutedEngineSample } from "./wasm-engine";

function buildInspectSample(sample: ResolvedDetectorWindow["sample"] | {
  text: string;
  normalizedText: string;
  normalizedApplied: boolean;
  textSource: "focus" | "borrowed-context";
  borrowedContext?: ResolvedDetectorWindow["sample"]["borrowedContext"];
}) {
  return {
    text: sample.text,
    textLength: sample.text.length,
    normalizedText: sample.normalizedText,
    normalizedApplied: sample.normalizedApplied,
    textSource: sample.textSource,
    ...(sample.borrowedContext ? { borrowedContext: sample.borrowedContext } : {}),
  };
}

export function buildEmptyEngineInspectResult(
  input: DetectorInspectResult["input"],
): DetectorInspectResult {
  return {
    schemaVersion: 1,
    kind: "detector-inspect",
    view: "engine",
    detector: "wasm",
    input,
    sample: {
      text: "",
      textLength: 0,
      normalizedText: "",
      normalizedApplied: false,
      textSource: "focus",
    },
    decision: {
      kind: "empty",
      notes: ["No detector-eligible content was present."],
    },
  };
}

export async function buildEngineInspectResult(
  input: DetectorInspectResult["input"],
  window: DetectorWindow,
  chunks: Array<{ locale: string; text: string }>,
  executeEngine: (
    sample: ReturnType<typeof DETECTOR_ROUTE_POLICIES[typeof window.routeTag]["buildDiagnosticSample"]>,
    routeTag: typeof window.routeTag,
  ) => Promise<ExecutedEngineSample>,
): Promise<DetectorInspectResult> {
  const sample = DETECTOR_ROUTE_POLICIES[window.routeTag].buildDiagnosticSample(window, chunks);
  const { rawResult, rawRemapped, normalizedResult, normalizedRemapped } =
    await executeEngine(sample, window.routeTag);

  if (!rawResult) {
    return {
      schemaVersion: 1,
      kind: "detector-inspect",
      view: "engine",
      detector: "wasm",
      input,
      routeTag: window.routeTag,
      sample: buildInspectSample(sample),
    };
  }

  return {
    schemaVersion: 1,
    kind: "detector-inspect",
    view: "engine",
    detector: "wasm",
    input,
    routeTag: window.routeTag,
    sample: buildInspectSample(sample),
    engine: {
      name: "whatlang-wasm",
      raw: rawResult,
      ...(normalizedResult ? { normalized: normalizedResult } : {}),
      remapped: {
        rawTag: rawRemapped?.tag ?? null,
        normalizedTag: normalizedRemapped?.tag ?? null,
      },
    },
  };
}

export function buildEmptyPipelineInspectResult(
  input: DetectorInspectResult["input"],
): DetectorInspectResult {
  return {
    schemaVersion: 1,
    kind: "detector-inspect",
    view: "pipeline",
    detector: "wasm",
    input,
    chunks: [],
    windows: [],
    decision: {
      kind: "empty",
      notes: ["No detector-eligible content was present."],
    },
    resolvedChunks: [],
  };
}

export function buildPipelineInspectResult(
  input: DetectorInspectResult["input"],
  tracedChunks: TracedLocaleChunk[],
  resolvedWindows: Array<ResolvedDetectorWindow & { window: DetectorWindow; windowIndex: number }>,
  finalResolved: Array<{ locale: string; text: string }>,
): DetectorInspectResult {
  return {
    schemaVersion: 1,
    kind: "detector-inspect",
    view: "pipeline",
    detector: "wasm",
    input,
    chunks: tracedChunks.map((chunk, index) =>
      createInspectChunk(index, chunk, {
        source: chunk.source,
      }),
    ),
    windows: resolvedWindows.map(
      ({ window, windowIndex, sample, eligibility, contentGate, engineExecuted, engineReason, decision }) => {
        const focusPreview = createInspectPreview(sample.focusText);
        const samplePreview = createInspectPreview(sample.text);
        const normalizedPreview = createInspectPreview(sample.normalizedText);
        const inspectWindow: DetectorInspectWindow = {
          windowIndex,
          routeTag: window.routeTag,
          chunkRange: {
            start: window.startIndex,
            end: window.endIndex,
          },
          focusTextPreview: focusPreview.textPreview,
          focusTextPreviewTruncated: focusPreview.textPreviewTruncated,
          diagnosticSample: {
            textPreview: samplePreview.textPreview,
            textPreviewTruncated: samplePreview.textPreviewTruncated,
            normalizedTextPreview: normalizedPreview.textPreview,
            normalizedTextPreviewTruncated: normalizedPreview.textPreviewTruncated,
            normalizedApplied: sample.normalizedApplied,
            ...(sample.borrowedContext ? { borrowedContext: sample.borrowedContext } : {}),
          },
          eligibility,
          contentGate,
          engine: {
            executed: engineExecuted,
            ...(engineReason ? { reason: engineReason } : {}),
          },
          decision,
        };
        return inspectWindow;
      },
    ),
    resolvedChunks: finalResolved.map((chunk, index) => createInspectChunk(index, chunk)),
  };
}
