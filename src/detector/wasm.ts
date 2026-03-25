import { segmentTextByLocale } from "../wc";
import { resolveLocaleDetectContext } from "../wc/locale-detect";
import { buildWordCounterResultFromChunks } from "./result-builder";
import { countSectionsWithResolvedDetector } from "./sections";
import {
  type DetectorWindow,
} from "./policy";
import { createInspectInput, segmentTextByLocaleWithTrace } from "./inspect-helpers";
import type { DetectorInspectOptions, DetectorInspectResult } from "./inspect-types";
import {
  buildEmptyEngineInspectResult,
  buildEmptyPipelineInspectResult,
  buildEngineInspectResult,
  buildPipelineInspectResult,
} from "./wasm-inspect";
import {
  createDeferredLatinPreSegmentOptions,
  reapplyDeferredLatinFallback,
  reapplyResolvedLatinHintRules,
} from "./wasm-presegment";
import { executeEngineSample } from "./wasm-engine";
import { resolveWindowLocale, type ResolvedDetectorWindow } from "./wasm-resolution";
import { buildDetectorWindows } from "./wasm-windows";
import { WASM_DETECTOR_RUNTIME_UNAVAILABLE_MESSAGE } from "./whatlang-wasm";
import type {
  DetectorCountSectionsOptions,
  DetectorLocaleOptions,
  DetectorWordCounterOptions,
} from "./types";

export { WASM_DETECTOR_RUNTIME_UNAVAILABLE_MESSAGE };

export async function segmentTextByLocaleWithWasmDetector(
  text: string,
  options: DetectorLocaleOptions = {},
) {
  // Validate the original hint configuration up front even though Latin hinting
  // is deferred until after detector routing in WASM mode.
  resolveLocaleDetectContext(options);

  const chunks = segmentTextByLocale(text, createDeferredLatinPreSegmentOptions(options));
  const resolved = [...chunks];
  const windows = buildDetectorWindows(chunks);

  for (const [windowIndex, window] of windows.entries()) {
    const resolution = await resolveWindowLocale(
      window,
      windowIndex,
      chunks,
      options,
      options.detectorDebug,
    );
    for (let index = window.startIndex; index <= window.endIndex; index += 1) {
      const chunk = resolved[index];
      if (!chunk) {
        continue;
      }
      resolved[index] = {
        ...chunk,
        locale: resolution.resolvedLocale,
      };
    }
  }

  options.detectorDebug?.emit?.("detector.summary", options.detectorDebug.summary, {
    verbosity: "compact",
  });
  const hintRelabeled = reapplyResolvedLatinHintRules(resolved, chunks, options);
  return reapplyDeferredLatinFallback(hintRelabeled, options);
}

export async function wordCounterWithWasmDetector(
  text: string,
  options: DetectorWordCounterOptions = {},
) {
  const chunks = await segmentTextByLocaleWithWasmDetector(text, options);
  return buildWordCounterResultFromChunks(chunks, options);
}

export async function countSectionsWithWasmDetector(
  input: string,
  section: Parameters<typeof countSectionsWithResolvedDetector>[1],
  options: DetectorCountSectionsOptions = {},
) {
  return countSectionsWithResolvedDetector(input, section, options);
}

export async function inspectTextWithWasmDetector(
  text: string,
  options: DetectorInspectOptions = {},
): Promise<DetectorInspectResult> {
  const input = createInspectInput(text, options.input);
  const tracedChunks = segmentTextByLocaleWithTrace(text, createDeferredLatinPreSegmentOptions(options));
  const chunks = tracedChunks.map(({ locale, text: chunkText }) => ({
    locale,
    text: chunkText,
  }));
  const windows = buildDetectorWindows(chunks);

  if (options.view === "engine") {
    if (windows.length === 0) {
      return buildEmptyEngineInspectResult(input);
    }

    const window = windows[0]!;
    return buildEngineInspectResult(input, window, chunks, executeEngineSample);
  }

  if (text.trim().length === 0) {
    return buildEmptyPipelineInspectResult(input);
  }

  const resolved = [...chunks];
  const resolvedWindows: Array<ResolvedDetectorWindow & { window: DetectorWindow; windowIndex: number }> = [];

  for (const [windowIndex, window] of windows.entries()) {
    const resolution = await resolveWindowLocale(window, windowIndex, chunks, options);
    resolvedWindows.push({
      ...resolution,
      window,
      windowIndex,
    });
    for (let index = window.startIndex; index <= window.endIndex; index += 1) {
      const chunk = resolved[index];
      if (!chunk) {
        continue;
      }
      resolved[index] = {
        ...chunk,
        locale: resolution.resolvedLocale,
      };
    }
  }

  const hintRelabeled = reapplyResolvedLatinHintRules(resolved, chunks, options);
  const finalResolved = reapplyDeferredLatinFallback(hintRelabeled, options);

  return buildPipelineInspectResult(input, tracedChunks, resolvedWindows, finalResolved);
}
