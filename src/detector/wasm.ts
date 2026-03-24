import { DEFAULT_HAN_TAG, DEFAULT_LOCALE } from "../wc/locale-detect";
import { segmentTextByLocale } from "../wc";
import { resolveLocaleDetectContext } from "../wc/locale-detect";
import type { LocaleChunk } from "../wc/types";
import { buildWordCounterResultFromChunks } from "./result-builder";
import { countSectionsWithResolvedDetector } from "./sections";
import {
  DETECTOR_ROUTE_POLICIES,
  LATIN_WASM_CORROBORATED_MIN_CONFIDENCE,
  isAmbiguousDetectorRoute,
  normalizeDetectorSampleForRoute,
  shouldAcceptLatinDetectorWindow,
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

function createDeferredLatinPreSegmentOptions(
  options: DetectorLocaleOptions,
): DetectorLocaleOptions {
  return {
    ...options,
    latinLanguageHint: undefined,
    latinTagHint: undefined,
    latinLocaleHint: undefined,
    latinHintRules: undefined,
    useDefaultLatinHints: false,
  };
}

function mergeAdjacentChunks(chunks: LocaleChunk[]): LocaleChunk[] {
  if (chunks.length === 0) {
    return chunks;
  }

  const merged: LocaleChunk[] = [];
  let last = chunks[0]!;

  for (let index = 1; index < chunks.length; index += 1) {
    const chunk = chunks[index]!;
    if (chunk.locale === last.locale) {
      last = {
        locale: last.locale,
        text: last.text + chunk.text,
      };
      continue;
    }
    merged.push(last);
    last = chunk;
  }

  merged.push(last);
  return merged;
}

function reapplyDeferredLatinFallback(
  chunks: LocaleChunk[],
  options: DetectorLocaleOptions,
): LocaleChunk[] {
  const relabeled: LocaleChunk[] = [];

  for (const chunk of chunks) {
    if (chunk.locale !== DEFAULT_LOCALE) {
      relabeled.push(chunk);
      continue;
    }

    relabeled.push(...segmentTextByLocale(chunk.text, options));
  }

  return mergeAdjacentChunks(relabeled);
}

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

type DetectorWindow = {
  routeTag: DetectorRouteTag;
  startIndex: number;
  endIndex: number;
  text: string;
};

function buildDetectorWindows(chunks: LocaleChunk[]): DetectorWindow[] {
  const windows: DetectorWindow[] = [];

  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    if (!chunk || !isAmbiguousDetectorRoute(chunk.locale)) {
      continue;
    }

    const previousWindow = windows[windows.length - 1];
    if (
      previousWindow &&
      previousWindow.routeTag === chunk.locale &&
      previousWindow.endIndex === index - 1
    ) {
      previousWindow.endIndex = index;
      previousWindow.text += chunk.text;
      continue;
    }

    windows.push({
      routeTag: chunk.locale,
      startIndex: index,
      endIndex: index,
      text: chunk.text,
    });
  }

  return windows;
}

async function resolveWindowLocale(window: DetectorWindow): Promise<string> {
  if (!shouldRunWasmDetector(window.text, window.routeTag)) {
    return window.routeTag;
  }

  const rawResult = await detectWithWhatlangWasm(window.text, window.routeTag);
  const rawRemapped = rawResult ? remapWhatlangResult(rawResult, window.routeTag) : null;

  const normalizedSample = normalizeDetectorSampleForRoute(window.text, window.routeTag);
  const passesLatinQualityGate =
    window.routeTag !== DEFAULT_LOCALE || shouldAcceptLatinDetectorWindow(window.text, normalizedSample);
  const normalizedResult =
    normalizedSample.length > 0 && normalizedSample !== window.text
      ? await detectWithWhatlangWasm(normalizedSample, window.routeTag)
      : null;
  const normalizedRemapped = normalizedResult
    ? remapWhatlangResult(normalizedResult, window.routeTag)
    : null;

  const candidates = [rawRemapped, normalizedRemapped].filter((value) => value !== null);
  if (candidates.length === 0) {
    return getDetectorFallbackTag(window.routeTag);
  }

  const strongestCandidate = candidates.reduce((best, current) => {
    if (!best) {
      return current;
    }
    return (current.confidence ?? 0) > (best.confidence ?? 0) ? current : best;
  }, candidates[0]);

  if (
    strongestCandidate &&
    passesLatinQualityGate &&
    shouldAcceptDetectorTag(
      window.routeTag,
      strongestCandidate.confidence,
      strongestCandidate.reliable,
    )
  ) {
    return strongestCandidate.tag;
  }

  if (
    window.routeTag === DEFAULT_LOCALE &&
    passesLatinQualityGate &&
    rawRemapped &&
    normalizedRemapped &&
    rawRemapped.tag === normalizedRemapped.tag
  ) {
    const corroboratedConfidence = Math.max(
      rawRemapped.confidence ?? 0,
      normalizedRemapped.confidence ?? 0,
    );
    const hasReliableCorroboration =
      rawRemapped.reliable === true || normalizedRemapped.reliable === true;
    if (
      hasReliableCorroboration &&
      corroboratedConfidence >= LATIN_WASM_CORROBORATED_MIN_CONFIDENCE
    ) {
      return rawRemapped.tag;
    }
  }

  return getDetectorFallbackTag(window.routeTag);
}

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

  for (const window of windows) {
    const resolvedLocale = await resolveWindowLocale(window);
    for (let index = window.startIndex; index <= window.endIndex; index += 1) {
      const chunk = resolved[index];
      if (!chunk) {
        continue;
      }
      resolved[index] = {
        ...chunk,
        locale: resolvedLocale,
      };
    }
  }

  return reapplyDeferredLatinFallback(resolved, options);
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
