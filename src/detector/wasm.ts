import { DEFAULT_HAN_TAG, DEFAULT_LOCALE } from "../wc/locale-detect";
import { segmentTextByLocale } from "../wc";
import { resolveLocaleDetectContext } from "../wc/locale-detect";
import type { LocaleChunk } from "../wc/types";
import { buildWordCounterResultFromChunks } from "./result-builder";
import {
  createDetectorEvidencePreview,
  recordDetectorAccepted,
  recordDetectorFallback,
  recordDetectorWindow,
  type DetectorFallbackReason,
} from "./debug";
import { countSectionsWithResolvedDetector } from "./sections";
import {
  DETECTOR_ROUTE_POLICIES,
  LATIN_WASM_CORROBORATED_MIN_CONFIDENCE,
  countScriptBearingCharsForRoute,
  isAmbiguousDetectorRoute,
  normalizeDetectorSampleForRoute,
  shouldAcceptLatinDetectorWindow,
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

function resolveFallbackDebugOutcome(
  window: DetectorWindow,
  options: DetectorLocaleOptions,
): {
  finalTag: string;
  finalLocales?: string[];
} {
  const fallbackTag = getDetectorFallbackTag(window.routeTag);
  if (window.routeTag !== DEFAULT_LOCALE) {
    return { finalTag: fallbackTag };
  }

  const relabeled = reapplyDeferredLatinFallback(
    [
      {
        locale: fallbackTag,
        text: window.text,
      },
    ],
    options,
  );
  const finalLocales = relabeled.map((chunk) => chunk.locale);
  if (finalLocales.length === 1) {
    return {
      finalTag: finalLocales[0]!,
    };
  }

  return finalLocales.length > 1
    ? {
        finalTag: fallbackTag,
        finalLocales,
      }
    : {
        finalTag: fallbackTag,
      };
}

function buildEvidenceSample(
  result: Awaited<ReturnType<typeof detectWithWhatlangWasm>> | null,
  remappedTag: string | null,
) {
  return {
    lang: result?.lang ?? null,
    script: result?.script ?? null,
    confidence: result?.confidence ?? null,
    reliable: result?.reliable ?? null,
    remappedTag,
  };
}

function emitDetectorWindowEvidence({
  window,
  windowIndex,
  normalizedSample,
  eligible,
  qualityGate,
  rawResult,
  rawRemappedTag,
  normalizedResult,
  normalizedRemappedTag,
  decision,
  debug,
}: {
  window: DetectorWindow;
  windowIndex: number;
  normalizedSample: string;
  eligible: boolean;
  qualityGate: boolean;
  rawResult: Awaited<ReturnType<typeof detectWithWhatlangWasm>> | null;
  rawRemappedTag: string | null;
  normalizedResult: Awaited<ReturnType<typeof detectWithWhatlangWasm>> | null;
  normalizedRemappedTag: string | null;
  decision: {
    accepted: boolean;
    path: "reliable" | "corroborated" | null;
    finalTag: string;
    finalLocales?: string[];
    fallbackReason: DetectorFallbackReason | null;
  };
  debug?: DetectorLocaleOptions["detectorDebug"];
}): void {
  const evidence = debug?.evidence;
  if (!evidence || !debug.emit) {
    return;
  }

  const routePolicy = DETECTOR_ROUTE_POLICIES[window.routeTag];
  const baseDetails = {
    engine: "whatlang-wasm",
    routeTag: window.routeTag,
    windowIndex,
    startIndex: window.startIndex,
    endIndex: window.endIndex,
    mode: evidence.mode,
    section: evidence.section,
    textLength: window.text.length,
    normalizedLength: normalizedSample.length,
    normalizedApplied: normalizedSample !== window.text,
    scriptChars: countScriptBearingCharsForRoute(window.text, window.routeTag),
    minScriptChars: routePolicy.minScriptChars,
    eligible,
    qualityGate,
    raw: buildEvidenceSample(rawResult, rawRemappedTag),
    normalized: buildEvidenceSample(normalizedResult, normalizedRemappedTag),
    decision,
  };

  if (evidence.verbosity === "verbose") {
    debug.emit(
      "detector.window.evidence",
      {
        ...baseDetails,
        text: window.text,
        normalizedText: normalizedSample,
      },
      { verbosity: "verbose" },
    );
    return;
  }

  const textPreview = createDetectorEvidencePreview(window.text);
  const normalizedPreview = createDetectorEvidencePreview(normalizedSample);
  debug.emit(
    "detector.window.evidence",
    {
      ...baseDetails,
      textPreview: textPreview.preview,
      textPreviewTruncated: textPreview.truncated,
      normalizedPreview: normalizedPreview.preview,
      normalizedPreviewTruncated: normalizedPreview.truncated,
    },
    { verbosity: "compact" },
  );
}

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

async function resolveWindowLocale(
  window: DetectorWindow,
  windowIndex: number,
  options: DetectorLocaleOptions,
  debug?: DetectorLocaleOptions["detectorDebug"],
): Promise<string> {
  recordDetectorWindow(debug?.summary, window.routeTag);
  debug?.emit?.(
    "detector.window.start",
    {
      routeTag: window.routeTag,
      startIndex: window.startIndex,
      endIndex: window.endIndex,
      textLength: window.text.length,
    },
    { verbosity: "verbose" },
  );

  const routePolicy = DETECTOR_ROUTE_POLICIES[window.routeTag];
  const scriptChars = countScriptBearingCharsForRoute(window.text, window.routeTag);
  const eligible = scriptChars >= routePolicy.minScriptChars;
  const normalizedSample = normalizeDetectorSampleForRoute(window.text, window.routeTag);
  const passesLatinQualityGate =
    window.routeTag !== DEFAULT_LOCALE || shouldAcceptLatinDetectorWindow(window.text, normalizedSample);

  if (!eligible) {
    recordDetectorFallback(debug?.summary, "notEligible");
    const fallbackDebugOutcome = resolveFallbackDebugOutcome(window, options);
    emitDetectorWindowEvidence({
      window,
      windowIndex,
      normalizedSample,
      eligible,
      qualityGate: passesLatinQualityGate,
      rawResult: null,
      rawRemappedTag: null,
      normalizedResult: null,
      normalizedRemappedTag: null,
      decision: {
        accepted: false,
        path: null,
        finalTag: fallbackDebugOutcome.finalTag,
        ...(fallbackDebugOutcome.finalLocales
          ? { finalLocales: fallbackDebugOutcome.finalLocales }
          : {}),
        fallbackReason: "notEligible",
      },
      debug,
    });
    debug?.emit?.("detector.window.fallback", {
      routeTag: window.routeTag,
      finalTag: fallbackDebugOutcome.finalTag,
      ...(fallbackDebugOutcome.finalLocales
        ? { finalLocales: fallbackDebugOutcome.finalLocales }
        : {}),
      reason: "notEligible",
    });
    return window.routeTag;
  }

  const rawResult = await detectWithWhatlangWasm(window.text, window.routeTag);
  const rawRemapped = rawResult ? remapWhatlangResult(rawResult, window.routeTag) : null;
  const normalizedResult =
    normalizedSample.length > 0 && normalizedSample !== window.text
      ? await detectWithWhatlangWasm(normalizedSample, window.routeTag)
      : null;
  debug?.emit?.(
    "detector.window.sample",
    {
      routeTag: window.routeTag,
      normalizedApplied: normalizedSample.length > 0 && normalizedSample !== window.text,
      normalizedLength: normalizedSample.length,
      qualityGate: passesLatinQualityGate,
      rawTag: rawRemapped?.tag ?? null,
      rawConfidence: rawRemapped?.confidence ?? null,
      rawReliable: rawRemapped?.reliable ?? null,
    },
    { verbosity: "verbose" },
  );
  const normalizedRemapped = normalizedResult
    ? remapWhatlangResult(normalizedResult, window.routeTag)
    : null;
  debug?.emit?.(
    "detector.window.candidates",
    {
      routeTag: window.routeTag,
      normalizedTag: normalizedRemapped?.tag ?? null,
      normalizedConfidence: normalizedRemapped?.confidence ?? null,
      normalizedReliable: normalizedRemapped?.reliable ?? null,
    },
    { verbosity: "verbose" },
  );

  const candidates = [rawRemapped, normalizedRemapped].filter((value) => value !== null);
  if (candidates.length === 0) {
    recordDetectorFallback(debug?.summary, "noCandidate");
    const fallbackDebugOutcome = resolveFallbackDebugOutcome(window, options);
    emitDetectorWindowEvidence({
      window,
      windowIndex,
      normalizedSample,
      eligible,
      qualityGate: passesLatinQualityGate,
      rawResult,
      rawRemappedTag: rawRemapped?.tag ?? null,
      normalizedResult,
      normalizedRemappedTag: normalizedRemapped?.tag ?? null,
      decision: {
        accepted: false,
        path: null,
        finalTag: fallbackDebugOutcome.finalTag,
        ...(fallbackDebugOutcome.finalLocales
          ? { finalLocales: fallbackDebugOutcome.finalLocales }
          : {}),
        fallbackReason: "noCandidate",
      },
      debug,
    });
    debug?.emit?.("detector.window.fallback", {
      routeTag: window.routeTag,
      finalTag: fallbackDebugOutcome.finalTag,
      ...(fallbackDebugOutcome.finalLocales
        ? { finalLocales: fallbackDebugOutcome.finalLocales }
        : {}),
      reason: "noCandidate",
    });
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
    recordDetectorAccepted(debug?.summary, "reliable");
    emitDetectorWindowEvidence({
      window,
      windowIndex,
      normalizedSample,
      eligible,
      qualityGate: passesLatinQualityGate,
      rawResult,
      rawRemappedTag: rawRemapped?.tag ?? null,
      normalizedResult,
      normalizedRemappedTag: normalizedRemapped?.tag ?? null,
      decision: {
        accepted: true,
        path: "reliable",
        finalTag: strongestCandidate.tag,
        fallbackReason: null,
      },
      debug,
    });
    debug?.emit?.("detector.window.accepted", {
      routeTag: window.routeTag,
      finalTag: strongestCandidate.tag,
      acceptancePath: "reliable",
      confidence: strongestCandidate.confidence ?? null,
      reliable: strongestCandidate.reliable ?? null,
    });
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
      recordDetectorAccepted(debug?.summary, "corroborated");
      emitDetectorWindowEvidence({
        window,
        windowIndex,
        normalizedSample,
        eligible,
        qualityGate: passesLatinQualityGate,
        rawResult,
        rawRemappedTag: rawRemapped.tag,
        normalizedResult,
        normalizedRemappedTag: normalizedRemapped.tag,
        decision: {
          accepted: true,
          path: "corroborated",
          finalTag: rawRemapped.tag,
          fallbackReason: null,
        },
        debug,
      });
      debug?.emit?.("detector.window.accepted", {
        routeTag: window.routeTag,
        finalTag: rawRemapped.tag,
        acceptancePath: "corroborated",
        confidence: corroboratedConfidence,
        reliable: hasReliableCorroboration,
      });
      return rawRemapped.tag;
    }

    if (!hasReliableCorroboration && corroboratedConfidence >= LATIN_WASM_CORROBORATED_MIN_CONFIDENCE) {
      recordDetectorFallback(debug?.summary, "corroborationUnreliable");
      const fallbackDebugOutcome = resolveFallbackDebugOutcome(window, options);
      emitDetectorWindowEvidence({
        window,
        windowIndex,
        normalizedSample,
        eligible,
        qualityGate: passesLatinQualityGate,
        rawResult,
        rawRemappedTag: rawRemapped.tag,
        normalizedResult,
        normalizedRemappedTag: normalizedRemapped.tag,
        decision: {
          accepted: false,
          path: null,
          finalTag: fallbackDebugOutcome.finalTag,
          ...(fallbackDebugOutcome.finalLocales
            ? { finalLocales: fallbackDebugOutcome.finalLocales }
            : {}),
          fallbackReason: "corroborationUnreliable",
        },
        debug,
      });
      debug?.emit?.("detector.window.fallback", {
        routeTag: window.routeTag,
        finalTag: fallbackDebugOutcome.finalTag,
        ...(fallbackDebugOutcome.finalLocales
          ? { finalLocales: fallbackDebugOutcome.finalLocales }
          : {}),
        reason: "corroborationUnreliable",
      });
      return getDetectorFallbackTag(window.routeTag);
    }
  }

  const fallbackReason = passesLatinQualityGate ? "belowThreshold" : "qualityGate";
  recordDetectorFallback(debug?.summary, fallbackReason);
  const fallbackDebugOutcome = resolveFallbackDebugOutcome(window, options);
  emitDetectorWindowEvidence({
    window,
    windowIndex,
    normalizedSample,
    eligible,
    qualityGate: passesLatinQualityGate,
    rawResult,
    rawRemappedTag: rawRemapped?.tag ?? null,
    normalizedResult,
    normalizedRemappedTag: normalizedRemapped?.tag ?? null,
    decision: {
      accepted: false,
      path: null,
      finalTag: fallbackDebugOutcome.finalTag,
      ...(fallbackDebugOutcome.finalLocales
        ? { finalLocales: fallbackDebugOutcome.finalLocales }
        : {}),
      fallbackReason,
    },
    debug,
  });
  debug?.emit?.("detector.window.fallback", {
    routeTag: window.routeTag,
    finalTag: fallbackDebugOutcome.finalTag,
    ...(fallbackDebugOutcome.finalLocales
      ? { finalLocales: fallbackDebugOutcome.finalLocales }
      : {}),
    reason: fallbackReason,
  });
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

  for (const [windowIndex, window] of windows.entries()) {
    const resolvedLocale = await resolveWindowLocale(window, windowIndex, options, options.detectorDebug);
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

  options.detectorDebug?.emit?.("detector.summary", options.detectorDebug.summary, {
    verbosity: "compact",
  });
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
