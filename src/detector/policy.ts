import { DEFAULT_HAN_TAG, DEFAULT_LOCALE } from "../wc/locale-detect";

export const LATIN_WASM_MIN_SCRIPT_CHARS = 24;
export const HANI_WASM_MIN_SCRIPT_CHARS = 12;
export const LATIN_WASM_MIN_CONFIDENCE = 0.75;
export const HANI_WASM_MIN_CONFIDENCE = 0.9;
export const LATIN_WASM_CORROBORATED_MIN_CONFIDENCE = 0.7;

const LATIN_SCRIPT_REGEX = /\p{Script=Latin}/u;
const HAN_SCRIPT_REGEX = /\p{Script=Han}/u;

export type DetectorRouteTag = typeof DEFAULT_LOCALE | typeof DEFAULT_HAN_TAG;

export type DetectorRoutePolicy = {
  routeTag: DetectorRouteTag;
  minScriptChars: number;
  minConfidence: number;
  requireReliable: boolean;
};

export const DETECTOR_ROUTE_POLICIES: Record<DetectorRouteTag, DetectorRoutePolicy> = {
  [DEFAULT_LOCALE]: {
    routeTag: DEFAULT_LOCALE,
    minScriptChars: LATIN_WASM_MIN_SCRIPT_CHARS,
    minConfidence: LATIN_WASM_MIN_CONFIDENCE,
    requireReliable: true,
  },
  [DEFAULT_HAN_TAG]: {
    routeTag: DEFAULT_HAN_TAG,
    minScriptChars: HANI_WASM_MIN_SCRIPT_CHARS,
    minConfidence: HANI_WASM_MIN_CONFIDENCE,
    requireReliable: true,
  },
};

export function isAmbiguousDetectorRoute(locale: string): locale is DetectorRouteTag {
  return locale === DEFAULT_LOCALE || locale === DEFAULT_HAN_TAG;
}

export function countScriptBearingCharsForRoute(
  text: string,
  routeTag: DetectorRouteTag,
): number {
  const matcher = routeTag === DEFAULT_HAN_TAG ? HAN_SCRIPT_REGEX : LATIN_SCRIPT_REGEX;
  let count = 0;
  for (const char of text) {
    if (matcher.test(char)) {
      count += 1;
    }
  }
  return count;
}

export function shouldRunWasmDetector(text: string, routeTag: DetectorRouteTag): boolean {
  const policy = DETECTOR_ROUTE_POLICIES[routeTag];
  return countScriptBearingCharsForRoute(text, routeTag) >= policy.minScriptChars;
}

export function normalizeDetectorSampleForRoute(
  text: string,
  routeTag: DetectorRouteTag,
): string {
  const matcher = routeTag === DEFAULT_HAN_TAG ? HAN_SCRIPT_REGEX : LATIN_SCRIPT_REGEX;
  return [...text]
    .map((char) => {
      if (matcher.test(char)) {
        return char;
      }
      if (/\s/u.test(char)) {
        return " ";
      }
      return " ";
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}
