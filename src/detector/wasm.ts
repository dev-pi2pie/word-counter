import { DEFAULT_LOCALE } from "../wc/locale-detect";
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
  isAmbiguousDetectorRoute,
  type DetectorContentGateResult,
  type DetectorDiagnosticSample,
  type DetectorEligibilityResult,
  type DetectorWindow,
  type DetectorRouteTag,
} from "./policy";
import { createInspectChunk, createInspectInput, createInspectPreview, segmentTextByLocaleWithTrace } from "./inspect-helpers";
import type { DetectorInspectOptions, DetectorInspectResult, DetectorInspectWindow } from "./inspect-types";
import { detectWithWhatlangWasm, WASM_DETECTOR_RUNTIME_UNAVAILABLE_MESSAGE } from "./whatlang-wasm";
import { getDetectorFallbackTag, remapWhatlangResult } from "./whatlang-map";
import type {
  DetectorCountSectionsOptions,
  DetectorResult,
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

function createRuleOnlyLatinOptions(
  options: DetectorLocaleOptions,
): DetectorLocaleOptions {
  return {
    ...options,
    latinLanguageHint: undefined,
    latinTagHint: undefined,
    latinLocaleHint: undefined,
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

function reapplyResolvedLatinHintRules(
  resolvedChunks: LocaleChunk[],
  originalChunks: LocaleChunk[],
  options: DetectorLocaleOptions,
): LocaleChunk[] {
  const relabeled: LocaleChunk[] = [];
  const ruleOnlyOptions = createRuleOnlyLatinOptions(options);

  for (let index = 0; index < resolvedChunks.length; index += 1) {
    const chunk = resolvedChunks[index];
    const originalChunk = originalChunks[index];
    if (!chunk || !originalChunk) {
      continue;
    }

    if (originalChunk.locale !== DEFAULT_LOCALE || chunk.locale === DEFAULT_LOCALE) {
      relabeled.push(chunk);
      continue;
    }

    const hintedChunks = segmentTextByLocale(chunk.text, ruleOnlyOptions).map((hintedChunk) => ({
      locale: hintedChunk.locale === DEFAULT_LOCALE ? chunk.locale : hintedChunk.locale,
      text: hintedChunk.text,
    }));
    relabeled.push(...hintedChunks);
  }

  return mergeAdjacentChunks(relabeled);
}

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

type ExecutedEngineSample = {
  rawResult: Awaited<ReturnType<typeof detectWithWhatlangWasm>> | null;
  rawRemapped: DetectorResult | null;
  normalizedResult: Awaited<ReturnType<typeof detectWithWhatlangWasm>> | null;
  normalizedRemapped: DetectorResult | null;
};

type ResolvedDetectorWindow = {
  resolvedLocale: string;
  sample: DetectorDiagnosticSample;
  eligibility: DetectorEligibilityResult;
  contentGate: DetectorContentGateResult;
  engineExecuted: boolean;
  engineReason?: "notEligible";
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
};

async function executeEngineSample(
  sample: DetectorDiagnosticSample,
  routeTag: DetectorRouteTag,
): Promise<ExecutedEngineSample> {
  const rawResult = await detectWithWhatlangWasm(sample.text, routeTag);
  const rawRemapped = rawResult ? remapWhatlangResult(rawResult, routeTag) : null;
  const normalizedResult =
    sample.normalizedApplied && sample.normalizedText.length > 0
      ? await detectWithWhatlangWasm(sample.normalizedText, routeTag)
      : null;
  const normalizedRemapped = normalizedResult
    ? remapWhatlangResult(normalizedResult, routeTag)
    : null;

  return {
    rawResult,
    rawRemapped,
    normalizedResult,
    normalizedRemapped,
  };
}

function emitDetectorWindowEvidence({
  window,
  windowIndex,
  sample,
  eligibility,
  contentGate,
  rawResult,
  rawRemappedTag,
  normalizedResult,
  normalizedRemappedTag,
  decision,
  debug,
}: {
  window: DetectorWindow;
  windowIndex: number;
  sample: DetectorDiagnosticSample;
  eligibility: DetectorEligibilityResult;
  contentGate: DetectorContentGateResult;
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

  const baseDetails = {
    engine: "whatlang-wasm",
    routeTag: window.routeTag,
    windowIndex,
    startIndex: window.startIndex,
    endIndex: window.endIndex,
    mode: evidence.mode,
    section: evidence.section,
    textLength: sample.text.length,
    focusTextLength: sample.focusText.length,
    normalizedLength: sample.normalizedText.length,
    normalizedApplied: sample.normalizedApplied,
    textSource: sample.textSource,
    scriptChars: eligibility.scriptChars,
    minScriptChars: eligibility.minScriptChars,
    eligible: eligibility.passed,
    contentGate,
    qualityGate: contentGate.passed,
    raw: buildEvidenceSample(rawResult, rawRemappedTag),
    normalized: buildEvidenceSample(normalizedResult, normalizedRemappedTag),
    decision,
    ...(sample.borrowedContext ? { borrowedContext: sample.borrowedContext } : {}),
  };

  if (evidence.verbosity === "verbose") {
    debug.emit(
      "detector.window.evidence",
      {
        ...baseDetails,
        text: sample.text,
        normalizedText: sample.normalizedText,
      },
      { verbosity: "verbose" },
    );
    return;
  }

  const textPreview = createDetectorEvidencePreview(sample.text);
  const normalizedPreview = createDetectorEvidencePreview(sample.normalizedText);
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
  chunks: LocaleChunk[],
  options: DetectorLocaleOptions,
  debug?: DetectorLocaleOptions["detectorDebug"],
): Promise<ResolvedDetectorWindow> {
  const routePolicy = DETECTOR_ROUTE_POLICIES[window.routeTag];
  const sample = routePolicy.buildDiagnosticSample(window, chunks);
  const eligibility = routePolicy.eligibility.evaluate(sample);
  const contentGate = routePolicy.evaluateContentGate(sample);

  recordDetectorWindow(debug?.summary, window.routeTag);
  debug?.emit?.(
    "detector.window.start",
    {
      routeTag: window.routeTag,
      startIndex: window.startIndex,
      endIndex: window.endIndex,
      textLength: window.text.length,
      sampleTextLength: sample.text.length,
      textSource: sample.textSource,
      ...(sample.borrowedContext ? { borrowedContext: sample.borrowedContext } : {}),
    },
    { verbosity: "verbose" },
  );

  if (!eligibility.passed) {
    recordDetectorFallback(debug?.summary, "notEligible");
    const fallbackDebugOutcome = resolveFallbackDebugOutcome(window, options);
    const resolution: ResolvedDetectorWindow = {
      resolvedLocale: getDetectorFallbackTag(window.routeTag),
      sample,
      eligibility,
      contentGate,
      engineExecuted: false,
      engineReason: "notEligible",
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
    };
    emitDetectorWindowEvidence({
      window,
      windowIndex,
      sample: resolution.sample,
      eligibility: resolution.eligibility,
      contentGate: resolution.contentGate,
      rawResult: resolution.rawResult,
      rawRemappedTag: resolution.rawRemappedTag,
      normalizedResult: resolution.normalizedResult,
      normalizedRemappedTag: resolution.normalizedRemappedTag,
      decision: resolution.decision,
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
    return resolution;
  }

  const { rawResult, rawRemapped, normalizedResult, normalizedRemapped } =
    await executeEngineSample(sample, window.routeTag);
  debug?.emit?.(
    "detector.window.sample",
    {
      routeTag: window.routeTag,
      normalizedApplied: sample.normalizedApplied,
      normalizedLength: sample.normalizedText.length,
      textSource: sample.textSource,
      contentGate,
      qualityGate: contentGate.passed,
      rawTag: rawRemapped?.tag ?? null,
      rawConfidence: rawRemapped?.confidence ?? null,
      rawReliable: rawRemapped?.reliable ?? null,
      ...(sample.borrowedContext ? { borrowedContext: sample.borrowedContext } : {}),
    },
    { verbosity: "verbose" },
  );
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
    const resolution: ResolvedDetectorWindow = {
      resolvedLocale: getDetectorFallbackTag(window.routeTag),
      sample,
      eligibility,
      contentGate,
      engineExecuted: true,
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
    };
    emitDetectorWindowEvidence({
      window,
      windowIndex,
      sample: resolution.sample,
      eligibility: resolution.eligibility,
      contentGate: resolution.contentGate,
      rawResult: resolution.rawResult,
      rawRemappedTag: resolution.rawRemappedTag,
      normalizedResult: resolution.normalizedResult,
      normalizedRemappedTag: resolution.normalizedRemappedTag,
      decision: resolution.decision,
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
    return resolution;
  }

  const strongestCandidate = candidates.reduce((best, current) => {
    if (!best) {
      return current;
    }
    return (current.confidence ?? 0) > (best.confidence ?? 0) ? current : best;
  }, candidates[0]);

  if (
    strongestCandidate &&
    contentGate.passed &&
    routePolicy.accept(strongestCandidate)
  ) {
    recordDetectorAccepted(debug?.summary, "reliable");
    const resolution: ResolvedDetectorWindow = {
      resolvedLocale: strongestCandidate.tag,
      sample,
      eligibility,
      contentGate,
      engineExecuted: true,
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
    };
    emitDetectorWindowEvidence({
      window,
      windowIndex,
      sample: resolution.sample,
      eligibility: resolution.eligibility,
      contentGate: resolution.contentGate,
      rawResult: resolution.rawResult,
      rawRemappedTag: resolution.rawRemappedTag,
      normalizedResult: resolution.normalizedResult,
      normalizedRemappedTag: resolution.normalizedRemappedTag,
      decision: resolution.decision,
      debug,
    });
    debug?.emit?.("detector.window.accepted", {
      routeTag: window.routeTag,
      finalTag: strongestCandidate.tag,
      acceptancePath: "reliable",
      confidence: strongestCandidate.confidence ?? null,
      reliable: strongestCandidate.reliable ?? null,
    });
    return resolution;
  }

  if (
    contentGate.passed &&
    routePolicy.acceptCorroborated &&
    rawRemapped &&
    normalizedRemapped
  ) {
    const corroborated = routePolicy.acceptCorroborated(rawRemapped, normalizedRemapped);
    if (corroborated.accepted) {
      recordDetectorAccepted(debug?.summary, "corroborated");
      const resolution: ResolvedDetectorWindow = {
        resolvedLocale: rawRemapped.tag,
        sample,
        eligibility,
        contentGate,
        engineExecuted: true,
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
      };
      emitDetectorWindowEvidence({
        window,
        windowIndex,
        sample: resolution.sample,
        eligibility: resolution.eligibility,
        contentGate: resolution.contentGate,
        rawResult: resolution.rawResult,
        rawRemappedTag: resolution.rawRemappedTag,
        normalizedResult: resolution.normalizedResult,
        normalizedRemappedTag: resolution.normalizedRemappedTag,
        decision: resolution.decision,
        debug,
      });
      debug?.emit?.("detector.window.accepted", {
        routeTag: window.routeTag,
        finalTag: rawRemapped.tag,
        acceptancePath: "corroborated",
        confidence: corroborated.confidence,
        reliable: corroborated.hasReliableCorroboration,
      });
      return resolution;
    }

    if (corroborated.reason === "unreliable") {
      recordDetectorFallback(debug?.summary, "corroborationUnreliable");
      const fallbackDebugOutcome = resolveFallbackDebugOutcome(window, options);
      const resolution: ResolvedDetectorWindow = {
        resolvedLocale: getDetectorFallbackTag(window.routeTag),
        sample,
        eligibility,
        contentGate,
        engineExecuted: true,
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
      };
      emitDetectorWindowEvidence({
        window,
        windowIndex,
        sample: resolution.sample,
        eligibility: resolution.eligibility,
        contentGate: resolution.contentGate,
        rawResult: resolution.rawResult,
        rawRemappedTag: resolution.rawRemappedTag,
        normalizedResult: resolution.normalizedResult,
        normalizedRemappedTag: resolution.normalizedRemappedTag,
        decision: resolution.decision,
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
      return resolution;
    }
  }

  const fallbackReason = contentGate.passed ? "belowThreshold" : "qualityGate";
  recordDetectorFallback(debug?.summary, fallbackReason);
  const fallbackDebugOutcome = resolveFallbackDebugOutcome(window, options);
  const resolution: ResolvedDetectorWindow = {
    resolvedLocale: getDetectorFallbackTag(window.routeTag),
    sample,
    eligibility,
    contentGate,
    engineExecuted: true,
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
  };
  emitDetectorWindowEvidence({
    window,
    windowIndex,
    sample: resolution.sample,
    eligibility: resolution.eligibility,
    contentGate: resolution.contentGate,
    rawResult: resolution.rawResult,
    rawRemappedTag: resolution.rawRemappedTag,
    normalizedResult: resolution.normalizedResult,
    normalizedRemappedTag: resolution.normalizedRemappedTag,
    decision: resolution.decision,
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
  return resolution;
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

    const window = windows[0]!;
    const sample = DETECTOR_ROUTE_POLICIES[window.routeTag].buildDiagnosticSample(window, chunks);
    const { rawResult, rawRemapped, normalizedResult, normalizedRemapped } =
      await executeEngineSample(sample, window.routeTag);

    if (!rawResult) {
      return {
        schemaVersion: 1,
        kind: "detector-inspect",
        view: "engine",
        detector: "wasm",
        input,
        routeTag: window.routeTag,
        sample: {
          text: sample.text,
          textLength: sample.text.length,
          normalizedText: sample.normalizedText,
          normalizedApplied: sample.normalizedApplied,
          textSource: sample.textSource,
          ...(sample.borrowedContext ? { borrowedContext: sample.borrowedContext } : {}),
        },
      };
    }

    return {
      schemaVersion: 1,
      kind: "detector-inspect",
      view: "engine",
      detector: "wasm",
      input,
      routeTag: window.routeTag,
      sample: {
        text: sample.text,
        textLength: sample.text.length,
        normalizedText: sample.normalizedText,
        normalizedApplied: sample.normalizedApplied,
        textSource: sample.textSource,
        ...(sample.borrowedContext ? { borrowedContext: sample.borrowedContext } : {}),
      },
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

  if (text.trim().length === 0) {
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
    windows: resolvedWindows.map(({ window, windowIndex, sample, eligibility, contentGate, engineExecuted, engineReason, decision }) => {
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
    }),
    resolvedChunks: finalResolved.map((chunk, index) => createInspectChunk(index, chunk)),
  };
}
