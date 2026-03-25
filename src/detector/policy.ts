import { DEFAULT_HAN_TAG, DEFAULT_LOCALE } from "../wc/locale-detect";
import type { LocaleChunk } from "../wc/types";
import type { DetectorResult } from "./types";

export const LATIN_WASM_MIN_SCRIPT_CHARS = 24;
export const HANI_WASM_MIN_SCRIPT_CHARS = 12;
export const LATIN_WASM_MIN_CONFIDENCE = 0.75;
export const HANI_WASM_MIN_CONFIDENCE = 0.9;
export const LATIN_WASM_CORROBORATED_MIN_CONFIDENCE = 0.7;

const LATIN_SCRIPT_REGEX = /\p{Script=Latin}/u;
const HAN_SCRIPT_REGEX = /\p{Script=Han}/u;
const HANI_DIAGNOSTIC_SCRIPT_REGEX = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;
const LATIN_WORD_REGEX = /\p{Script=Latin}+/gu;
const WHITESPACE_REGEX = /\s/u;
const JAPANESE_CONTEXT_LOCALE = "ja";

export type DetectorRouteTag = typeof DEFAULT_LOCALE | typeof DEFAULT_HAN_TAG;
export type DetectorContentGatePolicy = "latinProse" | "none";
export type DetectorDiagnosticTextSource = "focus" | "borrowed-context";

export type DetectorWindow = {
  routeTag: DetectorRouteTag;
  startIndex: number;
  endIndex: number;
  text: string;
};

export type DetectorBorrowedContext = {
  leftChunkIndex?: number;
  rightChunkIndex?: number;
};

export type DetectorDiagnosticSample = {
  focusText: string;
  text: string;
  normalizedText: string;
  normalizedApplied: boolean;
  textSource: DetectorDiagnosticTextSource;
  borrowedContext?: DetectorBorrowedContext;
};

export type DetectorEligibilityResult = {
  scriptChars: number;
  minScriptChars: number;
  passed: boolean;
};

export type DetectorContentGateResult = {
  applied: boolean;
  passed: boolean;
  policy: DetectorContentGatePolicy;
};

export type DetectorCorroboratedAcceptance =
  | {
      accepted: true;
      confidence: number;
      hasReliableCorroboration: true;
    }
  | {
      accepted: false;
      confidence: number;
      hasReliableCorroboration: boolean;
      reason: "mismatch" | "belowThreshold" | "unreliable";
    };

export type DetectorRoutePolicy = {
  routeTag: DetectorRouteTag;
  eligibility: {
    minScriptChars: number;
    evaluate: (sample: DetectorDiagnosticSample) => DetectorEligibilityResult;
  };
  buildDiagnosticSample: (
    window: DetectorWindow,
    chunks: LocaleChunk[],
  ) => DetectorDiagnosticSample;
  evaluateContentGate: (sample: DetectorDiagnosticSample) => DetectorContentGateResult;
  accept: (candidate: DetectorResult) => boolean;
  acceptCorroborated?: (
    raw: DetectorResult,
    normalized: DetectorResult,
  ) => DetectorCorroboratedAcceptance;
  fallbackTag: string;
};

function countMatchingChars(text: string, matcher: RegExp): number {
  let count = 0;
  for (const char of text) {
    if (matcher.test(char)) {
      count += 1;
    }
  }
  return count;
}

function getSampleScriptMatcher(routeTag: DetectorRouteTag): RegExp {
  return routeTag === DEFAULT_HAN_TAG ? HAN_SCRIPT_REGEX : LATIN_SCRIPT_REGEX;
}

function getEligibilityScriptMatcher(routeTag: DetectorRouteTag): RegExp {
  return routeTag === DEFAULT_HAN_TAG ? HANI_DIAGNOSTIC_SCRIPT_REGEX : LATIN_SCRIPT_REGEX;
}

function normalizeSampleText(text: string, routeTag: DetectorRouteTag): string {
  const matcher = getSampleScriptMatcher(routeTag);
  return [...text]
    .map((char) => {
      if (matcher.test(char) || WHITESPACE_REGEX.test(char)) {
        return char;
      }
      return " ";
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function buildFocusOnlyDiagnosticSample(window: DetectorWindow): DetectorDiagnosticSample {
  const normalizedText = normalizeSampleText(window.text, window.routeTag);
  return {
    focusText: window.text,
    text: window.text,
    normalizedText,
    normalizedApplied: normalizedText !== window.text,
    textSource: "focus",
  };
}

function buildHaniDiagnosticSample(
  window: DetectorWindow,
  chunks: LocaleChunk[],
): DetectorDiagnosticSample {
  const borrowedContext: DetectorBorrowedContext = {};
  const sampleParts: string[] = [];

  const leftChunk = chunks[window.startIndex - 1];
  if (leftChunk?.locale === JAPANESE_CONTEXT_LOCALE) {
    borrowedContext.leftChunkIndex = window.startIndex - 1;
    sampleParts.push(leftChunk.text);
  }

  sampleParts.push(window.text);

  const rightChunk = chunks[window.endIndex + 1];
  if (rightChunk?.locale === JAPANESE_CONTEXT_LOCALE) {
    borrowedContext.rightChunkIndex = window.endIndex + 1;
    sampleParts.push(rightChunk.text);
  }

  const text = sampleParts.join("");
  const normalizedText = normalizeSampleText(text, window.routeTag);
  const borrowed =
    borrowedContext.leftChunkIndex !== undefined || borrowedContext.rightChunkIndex !== undefined;

  return {
    focusText: window.text,
    text,
    normalizedText,
    normalizedApplied: normalizedText !== text,
    textSource: borrowed ? "borrowed-context" : "focus",
    ...(borrowed ? { borrowedContext } : {}),
  };
}

function countLatinWords(text: string): number {
  return text.match(LATIN_WORD_REGEX)?.length ?? 0;
}

function isTechnicalLikeLatinLine(line: string, latinWords: number): boolean {
  const trimmed = line.trim();
  if (!trimmed) {
    return false;
  }

  if (/^[>#$]/u.test(trimmed)) {
    return true;
  }

  if (/(^|\s)--[a-z0-9][a-z0-9-]*/iu.test(trimmed)) {
    return true;
  }

  if (/`[^`]+`/u.test(trimmed)) {
    return true;
  }

  if (/(^|[\s"'`])(?:\.{0,2}\/|\/)?[\w./-]+\.[a-z0-9]{1,6}(?=$|[\s"'`])/iu.test(trimmed)) {
    return true;
  }

  if (/^[-*\d.)\s]*[\p{L}\p{N}_.-]+:\s+\S/iu.test(trimmed) && latinWords <= 8) {
    return true;
  }

  return false;
}

function shouldTreatLatinProseBlockAsSentenceLike(
  latinWords: number,
  lineCount: number,
  hasSentencePunctuation: boolean,
): boolean {
  if (latinWords < 4) {
    return false;
  }

  if (hasSentencePunctuation) {
    return true;
  }

  return lineCount <= 1 ? latinWords >= 5 : latinWords >= 8;
}

function shouldAcceptLatinDetectorWindow(
  text: string,
  normalizedSample: string,
): boolean {
  const normalizedLatinWords = countLatinWords(normalizedSample);
  if (normalizedLatinWords < 4) {
    return false;
  }

  let proseWords = 0;
  let technicalWords = 0;
  let proseBlockWords = 0;
  let proseBlockLines = 0;
  let proseBlockHasSentencePunctuation = false;

  const flushProseBlock = () => {
    if (
      shouldTreatLatinProseBlockAsSentenceLike(
        proseBlockWords,
        proseBlockLines,
        proseBlockHasSentencePunctuation,
      )
    ) {
      proseWords += proseBlockWords;
    }

    proseBlockWords = 0;
    proseBlockLines = 0;
    proseBlockHasSentencePunctuation = false;
  };

  for (const rawLine of text.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line === "---" || line === "```") {
      flushProseBlock();
      continue;
    }

    const latinWords = countLatinWords(line);
    if (latinWords === 0) {
      continue;
    }

    const technicalLike = isTechnicalLikeLatinLine(line, latinWords);
    if (technicalLike) {
      flushProseBlock();
      technicalWords += latinWords;
      continue;
    }

    proseBlockWords += latinWords;
    proseBlockLines += 1;
    proseBlockHasSentencePunctuation ||= /[.!?]/u.test(line);
  }

  flushProseBlock();
  return proseWords >= 4 && proseWords >= technicalWords;
}

function evaluateEligibility(
  sample: DetectorDiagnosticSample,
  routeTag: DetectorRouteTag,
  minScriptChars: number,
): DetectorEligibilityResult {
  const scriptChars = countMatchingChars(sample.text, getEligibilityScriptMatcher(routeTag));
  return {
    scriptChars,
    minScriptChars,
    passed: scriptChars >= minScriptChars,
  };
}

function shouldAcceptCandidate(
  confidence: number | undefined,
  reliable: boolean | undefined,
  minConfidence: number,
): boolean {
  if (reliable !== true) {
    return false;
  }

  if (confidence === undefined) {
    return false;
  }

  return confidence >= minConfidence;
}

function evaluateLatinCorroboratedAcceptance(
  raw: DetectorResult,
  normalized: DetectorResult,
): DetectorCorroboratedAcceptance {
  if (raw.tag !== normalized.tag) {
    return {
      accepted: false,
      confidence: Math.max(raw.confidence ?? 0, normalized.confidence ?? 0),
      hasReliableCorroboration: raw.reliable === true || normalized.reliable === true,
      reason: "mismatch",
    };
  }

  const confidence = Math.max(raw.confidence ?? 0, normalized.confidence ?? 0);
  const hasReliableCorroboration = raw.reliable === true || normalized.reliable === true;

  if (!hasReliableCorroboration && confidence >= LATIN_WASM_CORROBORATED_MIN_CONFIDENCE) {
    return {
      accepted: false,
      confidence,
      hasReliableCorroboration,
      reason: "unreliable",
    };
  }

  if (confidence < LATIN_WASM_CORROBORATED_MIN_CONFIDENCE) {
    return {
      accepted: false,
      confidence,
      hasReliableCorroboration,
      reason: "belowThreshold",
    };
  }

  if (!hasReliableCorroboration) {
    return {
      accepted: false,
      confidence,
      hasReliableCorroboration,
      reason: "unreliable",
    };
  }

  return {
    accepted: true,
    confidence,
    hasReliableCorroboration: true,
  };
}

function createLatinRoutePolicy(): DetectorRoutePolicy {
  return {
    routeTag: DEFAULT_LOCALE,
    eligibility: {
      minScriptChars: LATIN_WASM_MIN_SCRIPT_CHARS,
      evaluate(sample) {
        return evaluateEligibility(sample, DEFAULT_LOCALE, LATIN_WASM_MIN_SCRIPT_CHARS);
      },
    },
    buildDiagnosticSample(window) {
      return buildFocusOnlyDiagnosticSample(window);
    },
    evaluateContentGate(sample) {
      return {
        applied: true,
        passed: shouldAcceptLatinDetectorWindow(sample.text, sample.normalizedText),
        policy: "latinProse",
      };
    },
    accept(candidate) {
      return shouldAcceptCandidate(
        candidate.confidence,
        candidate.reliable,
        LATIN_WASM_MIN_CONFIDENCE,
      );
    },
    acceptCorroborated(raw, normalized) {
      return evaluateLatinCorroboratedAcceptance(raw, normalized);
    },
    fallbackTag: DEFAULT_LOCALE,
  };
}

function createHaniRoutePolicy(): DetectorRoutePolicy {
  return {
    routeTag: DEFAULT_HAN_TAG,
    eligibility: {
      minScriptChars: HANI_WASM_MIN_SCRIPT_CHARS,
      evaluate(sample) {
        return evaluateEligibility(sample, DEFAULT_HAN_TAG, HANI_WASM_MIN_SCRIPT_CHARS);
      },
    },
    buildDiagnosticSample(window, chunks) {
      return buildHaniDiagnosticSample(window, chunks);
    },
    evaluateContentGate() {
      return {
        applied: false,
        passed: true,
        policy: "none",
      };
    },
    accept(candidate) {
      return shouldAcceptCandidate(
        candidate.confidence,
        candidate.reliable,
        HANI_WASM_MIN_CONFIDENCE,
      );
    },
    fallbackTag: DEFAULT_HAN_TAG,
  };
}

export const DETECTOR_ROUTE_POLICIES: Record<DetectorRouteTag, DetectorRoutePolicy> = {
  [DEFAULT_LOCALE]: createLatinRoutePolicy(),
  [DEFAULT_HAN_TAG]: createHaniRoutePolicy(),
};

export function isAmbiguousDetectorRoute(locale: string): locale is DetectorRouteTag {
  return locale === DEFAULT_LOCALE || locale === DEFAULT_HAN_TAG;
}

export function countScriptBearingCharsForRoute(
  text: string,
  routeTag: DetectorRouteTag,
): number {
  return countMatchingChars(text, getEligibilityScriptMatcher(routeTag));
}

export function normalizeDetectorSampleForRoute(
  text: string,
  routeTag: DetectorRouteTag,
): string {
  return normalizeSampleText(text, routeTag);
}
