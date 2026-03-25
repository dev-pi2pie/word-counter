import { createDetectorEvidencePreview, recordDetectorAccepted, recordDetectorFallback, recordDetectorWindow, type DetectorFallbackReason } from "./debug";
import {
  DETECTOR_ROUTE_POLICIES,
  type DetectorContentGateResult,
  type DetectorDiagnosticSample,
  type DetectorEligibilityResult,
  type DetectorRouteTag,
  type DetectorWindow,
} from "./policy";
import type { LocaleChunk } from "../wc/types";
import { getDetectorFallbackTag } from "./whatlang-map";
import type { DetectorLocaleOptions } from "./types";
import { buildEvidenceSample, executeEngineSample } from "./wasm-engine";
import { resolveFallbackDebugOutcome } from "./wasm-presegment";

export type ResolvedDetectorWindow = {
  resolvedLocale: string;
  sample: DetectorDiagnosticSample;
  eligibility: DetectorEligibilityResult;
  contentGate: DetectorContentGateResult;
  engineExecuted: boolean;
  engineReason?: "notEligible";
  rawResult: Awaited<ReturnType<typeof executeEngineSample>>["rawResult"];
  rawRemappedTag: string | null;
  normalizedResult: Awaited<ReturnType<typeof executeEngineSample>>["normalizedResult"];
  normalizedRemappedTag: string | null;
  decision: {
    accepted: boolean;
    path: "reliable" | "corroborated" | null;
    finalTag: string;
    finalLocales?: string[];
    fallbackReason: DetectorFallbackReason | null;
  };
};

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
  rawResult: ResolvedDetectorWindow["rawResult"];
  rawRemappedTag: string | null;
  normalizedResult: ResolvedDetectorWindow["normalizedResult"];
  normalizedRemappedTag: string | null;
  decision: ResolvedDetectorWindow["decision"];
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

export async function resolveWindowLocale(
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

  if (strongestCandidate && contentGate.passed && routePolicy.accept(strongestCandidate)) {
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

  if (contentGate.passed && routePolicy.acceptCorroborated && rawRemapped && normalizedRemapped) {
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
