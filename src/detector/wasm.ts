import { DEFAULT_HAN_TAG, DEFAULT_LOCALE } from "../wc/locale-detect";
import { segmentTextByLocale } from "../wc";
import type { LocaleChunk } from "../wc/types";
import { buildWordCounterResultFromChunks } from "./result-builder";
import { countSectionsWithResolvedDetector } from "./sections";
import {
  DETECTOR_ROUTE_POLICIES,
  isAmbiguousDetectorRoute,
  shouldRunWasmDetector,
  type DetectorRouteTag,
} from "./policy";
import { detectWithWhatlangWasm, WASM_DETECTOR_RUNTIME_UNAVAILABLE_MESSAGE } from "./whatlang-wasm";
import { getDetectorFallbackTag, remapWhatlangResult } from "./whatlang-map";
import type {
  DetectorCountSectionsOptions,
  DetectorLocaleOptions,
  DetectorWordCounterOptions,
} from "./types";

function shouldAcceptDetectorTag(
  routeTag: DetectorRouteTag,
  confidence: number | undefined,
  reliable: boolean | undefined,
): boolean {
  const policy = DETECTOR_ROUTE_POLICIES[routeTag];
  if (policy.requireReliable && reliable !== true) {
    return false;
  }

  if (confidence === undefined) {
    return false;
  }

  return confidence >= policy.minConfidence;
}

async function resolveChunkWithWasmDetector(chunk: LocaleChunk): Promise<LocaleChunk> {
  if (!isAmbiguousDetectorRoute(chunk.locale)) {
    return chunk;
  }

  if (!shouldRunWasmDetector(chunk.text, chunk.locale)) {
    return chunk;
  }

  const rawResult = await detectWithWhatlangWasm(chunk.text, chunk.locale);
  if (!rawResult) {
    return {
      ...chunk,
      locale: getDetectorFallbackTag(chunk.locale),
    };
  }

  const remapped = remapWhatlangResult(rawResult, chunk.locale);
  if (!remapped) {
    return {
      ...chunk,
      locale: getDetectorFallbackTag(chunk.locale),
    };
  }

  if (!shouldAcceptDetectorTag(chunk.locale, remapped.confidence, remapped.reliable)) {
    return {
      ...chunk,
      locale: getDetectorFallbackTag(chunk.locale),
    };
  }

  return {
    ...chunk,
    locale: remapped.tag,
  };
}

export { WASM_DETECTOR_RUNTIME_UNAVAILABLE_MESSAGE };

export async function segmentTextByLocaleWithWasmDetector(
  text: string,
  options: DetectorLocaleOptions = {},
) {
  const chunks = segmentTextByLocale(text, options);
  const resolved = await Promise.all(chunks.map((chunk) => resolveChunkWithWasmDetector(chunk)));
  return resolved;
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
